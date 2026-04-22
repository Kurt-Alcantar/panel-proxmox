import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AuthGuard } from '../guards/auth.guard';
import { AuditService } from '../services/audit.service';
import { KeycloakAdminService } from '../services/keycloak-admin.service';
import { PrismaService } from '../services/prisma.service';
import { ProxmoxService } from '../services/proxmox.service';
import { AssetsService } from '../services/assets.service';

interface AuthenticatedRequest {
  user?: {
    sub?: string;
    [key: string]: any;
  };
}

@Controller('admin')
@UseGuards(AuthGuard)
export class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly proxmox: ProxmoxService,
    private readonly keycloakAdmin: KeycloakAdminService,
    private readonly assetsService: AssetsService

  ) {}

  private isUuid(value?: string) {
    return !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  }

  private toNullableString(value: any) {
    if (value === undefined) return undefined;
    if (value === null) return null;
    const text = String(value).trim();
    return text.length ? text : null;
  }

  private toNullableBoolean(value: any) {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (typeof value === 'boolean') return value;
    if (value === 'true') return true;
    if (value === 'false') return false;
    return Boolean(value);
  }

  private async getAdminContext(keycloakId?: string) {
    if (!keycloakId) {
      throw new ForbiddenException('Token sin subject');
    }

    const user = await this.prisma.users.findFirst({
      where: { keycloak_id: keycloakId },
    });

    if (!user) {
      throw new ForbiddenException('Usuario interno no encontrado');
    }

    const roles = await this.prisma.$queryRaw<Array<{ code: string }>>`
      SELECT r.code
      FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = ${user.id}::uuid
    `;

    const roleCodes = roles.map((row) => row.code);
    if (!roleCodes.includes('platform_admin')) {
      throw new ForbiddenException('Se requiere rol platform_admin');
    }

    return { user, roleCodes };
  }

  private async loadRoles() {
    return this.prisma.$queryRaw<Array<{ id: string; code: string }>>`
      SELECT id::text AS id, code
      FROM roles
      ORDER BY code ASC
    `;
  }

  private async loadUsers() {
    const [users, tenantGroups, tenants, roleMappings] = await Promise.all([
      this.prisma.users.findMany({ orderBy: { created_at: 'desc' } }),
      this.prisma.tenant_groups.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.tenants.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.$queryRaw<Array<{ user_id: string; role_id: string; code: string }>>`
        SELECT ur.user_id::text AS user_id, r.id::text AS role_id, r.code
        FROM user_roles ur
        JOIN roles r ON r.id = ur.role_id
      `,
    ]);

    const tenantById = new Map(tenants.map((row) => [row.id, row]));
    const groupById = new Map(tenantGroups.map((row) => [row.id, row]));
    const rolesByUserId = new Map<string, Array<{ id: string; code: string }>>();

    for (const role of roleMappings) {
      if (!rolesByUserId.has(role.user_id)) rolesByUserId.set(role.user_id, []);
      rolesByUserId.get(role.user_id)!.push({ id: role.role_id, code: role.code });
    }

    return users.map((user) => {
      const group = user.tenant_group_id ? groupById.get(user.tenant_group_id) : null;
      // Prioridad: tenant_id directo del usuario, luego via tenant_group
      const directTenant = (user as any).tenant_id ? tenantById.get((user as any).tenant_id) : null;
      const groupTenant = group?.tenant_id ? tenantById.get(group.tenant_id) : null;
      const tenant = directTenant || groupTenant;

      return {
        ...user,
        roles: rolesByUserId.get(user.id) || [],
        tenant_id: (user as any).tenant_id || null,
        tenant_name: tenant?.name || null,
        tenant_type: (tenant as any)?.type || null,
        tenant_group: group
          ? {
              id: group.id,
              code: group.code,
              name: group.name,
            }
          : null,
        tenant: tenant
          ? {
              id: tenant.id,
              code: tenant.code,
              name: tenant.name,
              type: (tenant as any).type || null,
            }
          : null,
      };
    });
  }

  private async loadTenantGroupsWithPools() {
    const [tenantGroups, tenants, bindings, pools] = await Promise.all([
      this.prisma.tenant_groups.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.tenants.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.tenant_group_pools.findMany(),
      this.prisma.proxmox_pools.findMany({ orderBy: { name: 'asc' } }),
    ]);

    const tenantById = new Map(tenants.map((row) => [row.id, row]));
    const poolById = new Map(pools.map((row) => [row.id, row]));
    const poolIdsByGroupId = new Map<string, string[]>();

    for (const binding of bindings) {
      if (!poolIdsByGroupId.has(binding.tenant_group_id)) {
        poolIdsByGroupId.set(binding.tenant_group_id, []);
      }
      poolIdsByGroupId.get(binding.tenant_group_id)!.push(binding.proxmox_pool_id);
    }

    return tenantGroups.map((group) => {
      const tenant = tenantById.get(group.tenant_id);
      const boundPoolIds = poolIdsByGroupId.get(group.id) || [];

      return {
        ...group,
        tenant: tenant
          ? {
              id: tenant.id,
              code: tenant.code,
              name: tenant.name,
            }
          : null,
        pools: boundPoolIds
          .map((poolId) => poolById.get(poolId))
          .filter(Boolean)
          .map((pool) => ({
            id: pool!.id,
            name: pool!.name,
            external_id: pool!.external_id,
          })),
      };
    });
  }

  private serializeVm(vm: any) {
    return {
      ...vm,
      memory: vm.memory !== null && vm.memory !== undefined ? vm.memory.toString() : null,
      disk: vm.disk !== null && vm.disk !== undefined ? vm.disk.toString() : null,
    };
  }

  private async syncPoolsInternal() {
    const pools = await this.proxmox.getPools();

    for (const pool of pools) {
      await this.prisma.proxmox_pools.upsert({
        where: { external_id: pool.poolid },
        update: { name: pool.poolid },
        create: { external_id: pool.poolid, name: pool.poolid },
      });
    }

    return { synced: pools.length };
  }

  private async syncVmsInternal() {
    const vms = await this.proxmox.getAllVMs();

    for (const vm of vms) {
      await this.prisma.vm_inventory.upsert({
        where: { vmid: vm.vmid },
        update: {
          name: vm.name ?? null,
          node: vm.node ?? null,
          pool_id: vm.pool_id ?? null,
          status: vm.status ?? null,
          cpu: vm.cpu ?? null,
          memory: vm.memory !== null && vm.memory !== undefined ? BigInt(vm.memory) : null,
          disk: vm.disk !== null && vm.disk !== undefined ? BigInt(vm.disk) : null,
        },
        create: {
          vmid: vm.vmid,
          name: vm.name ?? null,
          node: vm.node ?? null,
          pool_id: vm.pool_id ?? null,
          status: vm.status ?? null,
          cpu: vm.cpu ?? null,
          memory: vm.memory !== null && vm.memory !== undefined ? BigInt(vm.memory) : null,
          disk: vm.disk !== null && vm.disk !== undefined ? BigInt(vm.disk) : null,
        },
      });
    }

    return { synced: vms.length };
  }

  @Get('bootstrap')
  async bootstrap(@Req() req: AuthenticatedRequest) {
    await this.getAdminContext(req.user?.sub);

    const [tenants, tenantGroups, pools, roles, users, vms] = await Promise.all([
      this.prisma.tenants.findMany({ orderBy: { name: 'asc' } }),
      this.loadTenantGroupsWithPools(),
      this.prisma.proxmox_pools.findMany({ orderBy: { name: 'asc' } }),
      this.loadRoles(),
      this.loadUsers(),
      this.prisma.vm_inventory.findMany({ orderBy: { vmid: 'asc' } }),
    ]);

    return {
      tenants,
      tenantGroups,
      pools,
      roles,
      users,
      vms: vms.map((vm) => this.serializeVm(vm)),
    };
  }

  @Get('users')
  async listUsers(@Req() req: AuthenticatedRequest) {
    await this.getAdminContext(req.user?.sub);
    return this.loadUsers();
  }

  @Get('roles')
  async listRoles(@Req() req: AuthenticatedRequest) {
    await this.getAdminContext(req.user?.sub);
    return this.loadRoles();
  }

  @Get('tenants')
  async listTenants(@Req() req: AuthenticatedRequest) {
    await this.getAdminContext(req.user?.sub);
    return this.prisma.tenants.findMany({ orderBy: { name: 'asc' } });
  }

  @Get('tenant-groups')
  async listTenantGroups(@Req() req: AuthenticatedRequest) {
    await this.getAdminContext(req.user?.sub);
    return this.loadTenantGroupsWithPools();
  }

  @Get('pools')
  async listPools(@Req() req: AuthenticatedRequest) {
    await this.getAdminContext(req.user?.sub);
    return this.prisma.proxmox_pools.findMany({ orderBy: { name: 'asc' } });
  }

  @Get('vms')
  async listVms(@Req() req: AuthenticatedRequest) {
    await this.getAdminContext(req.user?.sub);
    const rows = await this.prisma.vm_inventory.findMany({ orderBy: { vmid: 'asc' } });
    return rows.map((vm) => this.serializeVm(vm));
  }

  @Post('tenants')
  async createTenant(@Req() req: AuthenticatedRequest, @Body() body: any) {
    const admin = await this.getAdminContext(req.user?.sub);
    const code = String(body?.code || '').trim();
    const name = String(body?.name || '').trim();
    const status = String(body?.status || 'ACTIVE').trim();
    const type = String(body?.type || 'client').trim();
    const parentTenantId = this.toNullableString(body?.parent_tenant_id);

    if (!code || !name) {
      throw new BadRequestException('code y name son obligatorios');
    }

    if (!['platform', 'partner', 'client'].includes(type)) {
      throw new BadRequestException(`Tipo de tenant inválido: ${type}`);
    }

    if (parentTenantId && !this.isUuid(parentTenantId)) {
      throw new BadRequestException('parent_tenant_id inválido');
    }

    if (type === 'client' && !parentTenantId) {
      throw new BadRequestException('Un tenant client debe tener parent_tenant_id');
    }

    if (type !== 'client' && parentTenantId) {
      throw new BadRequestException('Solo un tenant client puede tener parent_tenant_id');
    }

    if (parentTenantId) {
      const parentTenant = await this.prisma.tenants.findFirst({ where: { id: parentTenantId } });
      if (!parentTenant) {
        throw new BadRequestException('Tenant padre no encontrado');
      }

      if (!['partner', 'platform'].includes((parentTenant as any).type)) {
        throw new BadRequestException('El tenant padre debe ser de tipo partner o platform');
      }
    }

    const existing = await this.prisma.tenants.findFirst({ where: { code } });
    if (existing) {
      throw new BadRequestException('Ya existe un tenant con ese code');
    }

    const tenant = await this.prisma.tenants.create({
      data: {
        code,
        name,
        status,
        type,
        parent_tenant_id: parentTenantId,
      },
    });

    await this.audit.log({
      userId: admin.user.id,
      action: 'admin.create_tenant',
      target: code,
      result: 'success',
    });

    return tenant;
  }

  @Patch('tenants/:tenantId')
  async updateTenant(@Req() req: AuthenticatedRequest, @Param('tenantId') tenantId: string, @Body() body: any) {
    const admin = await this.getAdminContext(req.user?.sub);
    const existing = await this.prisma.tenants.findFirst({ where: { id: tenantId } });
    if (!existing) throw new NotFoundException('Tenant no encontrado');

    const code = this.toNullableString(body?.code);
    const name = this.toNullableString(body?.name);
    const status = this.toNullableString(body?.status);
    const type = this.toNullableString(body?.type);
    const parentTenantId = body?.parent_tenant_id === null ? null : this.toNullableString(body?.parent_tenant_id);

    if (code && code !== existing.code) {
      const duplicate = await this.prisma.tenants.findFirst({ where: { code } });
      if (duplicate) throw new BadRequestException('Ya existe un tenant con ese code');
    }

    if (type !== undefined && type !== null && !['platform', 'partner', 'client'].includes(type)) {
      throw new BadRequestException(`Tipo de tenant inválido: ${type}`);
    }

    if (parentTenantId && !this.isUuid(parentTenantId)) {
      throw new BadRequestException('parent_tenant_id inválido');
    }

    const finalType = type ?? (existing as any).type;
    const finalParentTenantId = parentTenantId !== undefined ? parentTenantId : (existing as any).parent_tenant_id;

    if (finalType === 'client' && !finalParentTenantId) {
      throw new BadRequestException('Un tenant client debe tener parent_tenant_id');
    }

    if (finalType !== 'client' && finalParentTenantId) {
      throw new BadRequestException('Solo un tenant client puede tener parent_tenant_id');
    }

    if (finalParentTenantId) {
      if (finalParentTenantId === tenantId) {
        throw new BadRequestException('Un tenant no puede ser padre de sí mismo');
      }

      const parentTenant = await this.prisma.tenants.findFirst({ where: { id: finalParentTenantId } });
      if (!parentTenant) {
        throw new BadRequestException('Tenant padre no encontrado');
      }

      if (!['partner', 'platform'].includes((parentTenant as any).type)) {
        throw new BadRequestException('El tenant padre debe ser de tipo partner o platform');
      }
    }

    const updated = await this.prisma.tenants.update({
      where: { id: tenantId },
      data: {
        ...(code !== undefined ? { code } : {}),
        ...(name !== undefined ? { name } : {}),
        ...(status !== undefined ? { status } : {}),
        ...(type !== undefined ? { type } : {}),
        ...(parentTenantId !== undefined ? { parent_tenant_id: parentTenantId } : {}),
      },
    });

    await this.audit.log({
      userId: admin.user.id,
      action: 'admin.update_tenant',
      target: tenantId,
      result: 'success',
    });

    return updated;
  }
  @Delete('tenants/:tenantId')
  async deleteTenant(@Req() req: AuthenticatedRequest, @Param('tenantId') tenantId: string) {
    const admin = await this.getAdminContext(req.user?.sub);
    const existing = await this.prisma.tenants.findFirst({ where: { id: tenantId } });
    if (!existing) throw new NotFoundException('Tenant no encontrado');

    const [tenantGroupCount, vmCount] = await Promise.all([
      this.prisma.tenant_groups.count({ where: { tenant_id: tenantId } }),
      this.prisma.vm_inventory.count({ where: { tenant_id: tenantId } }),
    ]);

    if (tenantGroupCount > 0 || vmCount > 0) {
      throw new BadRequestException('No se puede borrar el tenant mientras existan tenant groups o VMs asociadas');
    }

    await this.prisma.tenants.delete({ where: { id: tenantId } });
    await this.audit.log({ userId: admin.user.id, action: 'admin.delete_tenant', target: tenantId, result: 'success' });
    return { ok: true };
  }

  @Post('tenant-groups')
  async createTenantGroup(@Req() req: AuthenticatedRequest, @Body() body: any) {
    const admin = await this.getAdminContext(req.user?.sub);
    const tenantId = String(body?.tenant_id || '').trim();
    const code = String(body?.code || '').trim();
    const name = String(body?.name || '').trim();

    if (!tenantId || !code || !name) {
      throw new BadRequestException('tenant_id, code y name son obligatorios');
    }

    const tenant = await this.prisma.tenants.findFirst({ where: { id: tenantId } });
    if (!tenant) {
      throw new BadRequestException('Tenant no encontrado');
    }

    const existing = await this.prisma.tenant_groups.findFirst({ where: { code } });
    if (existing) {
      throw new BadRequestException('Ya existe un tenant group con ese code');
    }

    const tenantGroup = await this.prisma.tenant_groups.create({
      data: { tenant_id: tenantId, code, name },
    });

    await this.audit.log({ userId: admin.user.id, action: 'admin.create_tenant_group', target: code, result: 'success' });
    return tenantGroup;
  }

  @Patch('tenant-groups/:tenantGroupId')
  async updateTenantGroup(@Req() req: AuthenticatedRequest, @Param('tenantGroupId') tenantGroupId: string, @Body() body: any) {
    const admin = await this.getAdminContext(req.user?.sub);
    const existing = await this.prisma.tenant_groups.findFirst({ where: { id: tenantGroupId } });
    if (!existing) throw new NotFoundException('Tenant group no encontrado');

    const tenantId = this.toNullableString(body?.tenant_id);
    const code = this.toNullableString(body?.code);
    const name = this.toNullableString(body?.name);

    if (tenantId) {
      const tenant = await this.prisma.tenants.findFirst({ where: { id: tenantId } });
      if (!tenant) throw new BadRequestException('Tenant no encontrado');
    }

    if (code && code !== existing.code) {
      const duplicate = await this.prisma.tenant_groups.findFirst({ where: { code } });
      if (duplicate) throw new BadRequestException('Ya existe un tenant group con ese code');
    }

    const updated = await this.prisma.tenant_groups.update({
      where: { id: tenantGroupId },
      data: {
        ...(tenantId !== undefined ? { tenant_id: tenantId } : {}),
        ...(code !== undefined ? { code } : {}),
        ...(name !== undefined ? { name } : {}),
      },
    });

    await this.audit.log({ userId: admin.user.id, action: 'admin.update_tenant_group', target: tenantGroupId, result: 'success' });
    return updated;
  }

  @Delete('tenant-groups/:tenantGroupId')
  async deleteTenantGroup(@Req() req: AuthenticatedRequest, @Param('tenantGroupId') tenantGroupId: string) {
    const admin = await this.getAdminContext(req.user?.sub);
    const existing = await this.prisma.tenant_groups.findFirst({ where: { id: tenantGroupId } });
    if (!existing) throw new NotFoundException('Tenant group no encontrado');

    const [userCount, vmCount] = await Promise.all([
      this.prisma.users.count({ where: { tenant_group_id: tenantGroupId } }),
      this.prisma.vm_inventory.count({ where: { tenant_group_id: tenantGroupId } }),
    ]);

    if (userCount > 0 || vmCount > 0) {
      throw new BadRequestException('No se puede borrar el tenant group mientras existan usuarios o VMs asociadas');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.tenant_group_pools.deleteMany({ where: { tenant_group_id: tenantGroupId } });
      await tx.tenant_groups.delete({ where: { id: tenantGroupId } });
    });

    await this.audit.log({ userId: admin.user.id, action: 'admin.delete_tenant_group', target: tenantGroupId, result: 'success' });
    return { ok: true };
  }

  @Put('tenant-groups/:tenantGroupId/pools')
  async setTenantGroupPools(@Req() req: AuthenticatedRequest, @Param('tenantGroupId') tenantGroupId: string, @Body() body: any) {
    const admin = await this.getAdminContext(req.user?.sub);
    const poolIds = Array.isArray(body?.pool_ids) ? body.pool_ids.map((value: any) => String(value)) : [];

    const group = await this.prisma.tenant_groups.findFirst({ where: { id: tenantGroupId } });
    if (!group) throw new BadRequestException('Tenant group no encontrado');

    const invalidIds = poolIds.filter((id) => !this.isUuid(id));
    if (invalidIds.length) throw new BadRequestException('Hay pool_ids inválidos');

    const pools = poolIds.length ? await this.prisma.proxmox_pools.findMany({ where: { id: { in: poolIds } } }) : [];
    if (pools.length !== poolIds.length) throw new BadRequestException('Uno o más pools no existen');

    await this.prisma.$transaction(async (tx) => {
      await tx.tenant_group_pools.deleteMany({ where: { tenant_group_id: tenantGroupId } });
      if (poolIds.length) {
        await tx.tenant_group_pools.createMany({
          data: poolIds.map((poolId) => ({
            id: randomUUID(),
            tenant_group_id: tenantGroupId,
            proxmox_pool_id: poolId,
          })),
        });
      }
    });

    await this.audit.log({ userId: admin.user.id, action: 'admin.bind_pools', target: group.code, result: `success:${poolIds.length}` });
    return { ok: true, tenant_group_id: tenantGroupId, pool_ids: poolIds };
  }

  @Post('users')
  async createUser(@Req() req: AuthenticatedRequest, @Body() body: any) {
    const admin = await this.getAdminContext(req.user?.sub);
    const username = String(body?.username || '').trim();
    const email = String(body?.email || '').trim().toLowerCase();
    const password = String(body?.password || '').trim();
    const firstName = String(body?.firstName || '').trim();
    const lastName = String(body?.lastName || '').trim();
    const tenantGroupId = this.toNullableString(body?.tenant_group_id);
    const roleIds = Array.isArray(body?.role_ids) ? body.role_ids.map((value: any) => String(value)) : [];

    if (!username || !email || !password) {
      throw new BadRequestException('username, email y password son obligatorios');
    }

    if (tenantGroupId && !this.isUuid(tenantGroupId)) throw new BadRequestException('tenant_group_id inválido');
    for (const roleId of roleIds) {
      if (!this.isUuid(roleId)) throw new BadRequestException(`role_id inválido: ${roleId}`);
    }

    if (tenantGroupId) {
      const group = await this.prisma.tenant_groups.findFirst({ where: { id: tenantGroupId } });
      if (!group) throw new BadRequestException('Tenant group no encontrado');
    }

    const availableRoles = await this.loadRoles();
    const roleSet = new Set(availableRoles.map((role) => role.id));
    if (roleIds.some((roleId) => !roleSet.has(roleId))) throw new BadRequestException('Uno o más roles no existen');

    const keycloakUser = await this.keycloakAdmin.createOrGetUser({
      username,
      email,
      firstName,
      lastName,
      password,
      enabled: true,
    });

    const user = await this.prisma.$transaction(async (tx) => {
      const localUser = await tx.users.upsert({
        where: { keycloak_id: keycloakUser.id },
        update: { email, tenant_group_id: tenantGroupId },
        create: { keycloak_id: keycloakUser.id, email, tenant_group_id: tenantGroupId },
      });

      await tx.$executeRaw`
        DELETE FROM user_roles
        WHERE user_id = ${localUser.id}::uuid
      `;

      for (const roleId of roleIds) {
        const mappingId = randomUUID();
        await tx.$executeRaw`
          INSERT INTO user_roles (id, user_id, role_id)
          VALUES (${mappingId}::uuid, ${localUser.id}::uuid, ${roleId}::uuid)
        `;
      }

      return localUser;
    });

    await this.audit.log({
      userId: admin.user.id,
      action: 'admin.create_user',
      target: email,
      result: keycloakUser.created ? 'created' : 'updated',
    });

    return { ok: true, keycloak_id: keycloakUser.id, user_id: user.id, created_in_keycloak: keycloakUser.created };
  }

  @Patch('users/:userId')
  async updateUser(@Req() req: AuthenticatedRequest, @Param('userId') userId: string, @Body() body: any) {
    const admin = await this.getAdminContext(req.user?.sub);
    const existing = await this.prisma.users.findFirst({ where: { id: userId } });
    if (!existing) throw new NotFoundException('Usuario no encontrado');

    const email = this.toNullableString(body?.email);
    const tenantGroupId = this.toNullableString(body?.tenant_group_id);
    const tenantId = this.toNullableString(body?.tenant_id);
    const username = this.toNullableString(body?.username);
    const firstName = this.toNullableString(body?.firstName);
    const lastName = this.toNullableString(body?.lastName);
    const enabled = body?.enabled !== undefined ? this.toNullableBoolean(body?.enabled) : undefined;
    const password = this.toNullableString(body?.password);
    const roleIds = Array.isArray(body?.role_ids) ? body.role_ids.map((value: any) => String(value)) : undefined;

    if (tenantGroupId && !this.isUuid(tenantGroupId)) throw new BadRequestException('tenant_group_id inválido');
    if (roleIds) {
      for (const roleId of roleIds) if (!this.isUuid(roleId)) throw new BadRequestException(`role_id inválido: ${roleId}`);
      const availableRoles = await this.loadRoles();
      const roleSet = new Set(availableRoles.map((role) => role.id));
      if (roleIds.some((roleId) => !roleSet.has(roleId))) throw new BadRequestException('Uno o más roles no existen');
    }
    if (tenantGroupId) {
      const group = await this.prisma.tenant_groups.findFirst({ where: { id: tenantGroupId } });
      if (!group) throw new BadRequestException('Tenant group no encontrado');
    }

    if (existing.keycloak_id) {
      await this.keycloakAdmin.updateUser(existing.keycloak_id, {
        ...(username !== undefined ? { username: username || undefined } : {}),
        ...(email !== undefined ? { email: email || undefined } : {}),
        ...(firstName !== undefined ? { firstName: firstName || undefined } : {}),
        ...(lastName !== undefined ? { lastName: lastName || undefined } : {}),
        ...(enabled !== undefined && enabled !== null ? { enabled } : {}),
      });
      if (password) {
        await this.keycloakAdmin.resetPassword(existing.keycloak_id, password, false);
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const localUser = await tx.users.update({
        where: { id: userId },
        data: {
          ...(email !== undefined ? { email } : {}),
          ...(tenantGroupId !== undefined ? { tenant_group_id: tenantGroupId } : {}),
          ...(tenantId !== undefined ? { tenant_id: tenantId } : {}),
        },
      });

      if (roleIds) {
        await tx.$executeRaw`
          DELETE FROM user_roles
          WHERE user_id = ${userId}::uuid
        `;

        for (const roleId of roleIds) {
          const mappingId = randomUUID();
          await tx.$executeRaw`
            INSERT INTO user_roles (id, user_id, role_id)
            VALUES (${mappingId}::uuid, ${userId}::uuid, ${roleId}::uuid)
          `;
        }
      }

      return localUser;
    });

    await this.audit.log({ userId: admin.user.id, action: 'admin.update_user', target: userId, result: 'success' });
    return updated;
  }

  @Post('users/:userId/disable')
  async disableUser(@Req() req: AuthenticatedRequest, @Param('userId') userId: string) {
    const admin = await this.getAdminContext(req.user?.sub);
    const existing = await this.prisma.users.findFirst({ where: { id: userId } });
    if (!existing) throw new NotFoundException('Usuario no encontrado');
    if (!existing.keycloak_id) throw new BadRequestException('El usuario no tiene keycloak_id');

    await this.keycloakAdmin.setUserEnabled(existing.keycloak_id, false);
    await this.audit.log({ userId: admin.user.id, action: 'admin.disable_user', target: userId, result: 'success' });
    return { ok: true };
  }

  @Post('users/:userId/enable')
  async enableUser(@Req() req: AuthenticatedRequest, @Param('userId') userId: string) {
    const admin = await this.getAdminContext(req.user?.sub);
    const existing = await this.prisma.users.findFirst({ where: { id: userId } });
    if (!existing) throw new NotFoundException('Usuario no encontrado');
    if (!existing.keycloak_id) throw new BadRequestException('El usuario no tiene keycloak_id');

    await this.keycloakAdmin.setUserEnabled(existing.keycloak_id, true);
    await this.audit.log({ userId: admin.user.id, action: 'admin.enable_user', target: userId, result: 'success' });
    return { ok: true };
  }

  @Delete('users/:userId')
  async deleteUser(@Req() req: AuthenticatedRequest, @Param('userId') userId: string) {
    const admin = await this.getAdminContext(req.user?.sub);
    const existing = await this.prisma.users.findFirst({ where: { id: userId } });
    if (!existing) throw new NotFoundException('Usuario no encontrado');

    if (existing.keycloak_id) {
      await this.keycloakAdmin.deleteUser(existing.keycloak_id);
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`
          DELETE FROM user_roles
          WHERE user_id = ${userId}::uuid
        `;

        await tx.$executeRaw`
          UPDATE audit_logs
          SET user_id = NULL
          WHERE user_id = ${userId}
        `;
        await tx.users.delete({ where: { id: userId } });
      });
    } catch (error: any) {
      throw new BadRequestException(`No se pudo borrar el usuario localmente: ${error?.message || error}`);
    }

    await this.audit.log({ userId: admin.user.id, action: 'admin.delete_user', target: userId, result: 'success' });
    return { ok: true };
  }
  @Post('assets/:assetId/assign')
  async assignAssetToTenant(
    @Req() req: AuthenticatedRequest,
    @Param('assetId') assetId: string,
    @Body() body: any,
  ) {
    const admin = await this.getAdminContext(req.user?.sub);

    const tenantId =
      this.toNullableString(body?.tenantId) ??
      this.toNullableString(body?.tenant_id);

    if (!assetId) {
      throw new BadRequestException('assetId es obligatorio');
    }

    if (!tenantId || !this.isUuid(tenantId)) {
      throw new BadRequestException('tenantId inválido');
    }

    const tenant = await this.prisma.tenants.findFirst({ where: { id: tenantId } });
    if (!tenant) {
      throw new BadRequestException('Tenant no encontrado');
    }

    if ((tenant as any).type !== 'client') {
      throw new BadRequestException('Solo se puede asignar activos a tenants de tipo client');
    }

    const assignment = await this.assetsService.assignToTenant(assetId, tenantId, admin.user.id);

    await this.audit.log({
      userId: admin.user.id,
      action: 'admin.assign_asset',
      target: assetId,
      result: `success:${tenantId}`,
    });

    return { ok: true, assignment };
  }

  @Delete('assets/:assetId/assign')
  async unassignAssetFromTenant(
    @Req() req: AuthenticatedRequest,
    @Param('assetId') assetId: string,
  ) {
    const admin = await this.getAdminContext(req.user?.sub);

    if (!assetId) {
      throw new BadRequestException('assetId es obligatorio');
    }

    await this.assetsService.removeFromTenant(assetId);

    await this.audit.log({
      userId: admin.user.id,
      action: 'admin.unassign_asset',
      target: assetId,
      result: 'success',
    });

    return { ok: true, assetId };
  }
  @Patch('vms/:vmid')
  async updateVm(@Req() req: AuthenticatedRequest, @Param('vmid') vmid: string, @Body() body: any) {
    const admin = await this.getAdminContext(req.user?.sub);
    const numericVmid = Number(vmid);
    if (Number.isNaN(numericVmid)) throw new BadRequestException('vmid inválido');

    const existingVm = await this.prisma.vm_inventory.findFirst({ where: { vmid: numericVmid } });
    if (!existingVm) throw new BadRequestException('VM no encontrada');

    const data: Record<string, any> = {};
    const assignableStringFields = [
      'name',
      'node',
      'pool_id',
      'tenant_id',
      'tenant_group_id',
      'status',
      'os_type',
      'elastic_host_name',
      'kibana_base_url',
      'monitored_services',
    ];

    for (const field of assignableStringFields) {
      const value = this.toNullableString(body?.[field]);
      if (value !== undefined) data[field] = value;
    }

    if (body?.observability_enabled !== undefined) data.observability_enabled = this.toNullableBoolean(body.observability_enabled);
    if (body?.cpu !== undefined) data.cpu = body.cpu === null || body.cpu === '' ? null : Number(body.cpu);
    if (body?.memory !== undefined) data.memory = body.memory === null || body.memory === '' ? null : BigInt(body.memory);
    if (body?.disk !== undefined) data.disk = body.disk === null || body.disk === '' ? null : BigInt(body.disk);

    const updated = await this.prisma.vm_inventory.update({ where: { vmid: numericVmid }, data });
    await this.audit.log({ userId: admin.user.id, action: 'admin.update_vm', target: String(numericVmid), result: 'success' });
    return this.serializeVm(updated);
  }

  @Delete('vms/:vmid')
  async deleteVm(@Req() req: AuthenticatedRequest, @Param('vmid') vmid: string) {
    const admin = await this.getAdminContext(req.user?.sub);
    const numericVmid = Number(vmid);
    if (Number.isNaN(numericVmid)) throw new BadRequestException('vmid inválido');

    const existingVm = await this.prisma.vm_inventory.findFirst({ where: { vmid: numericVmid } });
    if (!existingVm) throw new NotFoundException('VM no encontrada');

    await this.prisma.vm_inventory.delete({ where: { vmid: numericVmid } });
    await this.audit.log({ userId: admin.user.id, action: 'admin.delete_vm', target: String(numericVmid), result: 'success' });
    return { ok: true };
  }

  @Post('pools/sync')
  async syncPools(@Req() req: AuthenticatedRequest) {
    const admin = await this.getAdminContext(req.user?.sub);
    const result = await this.syncPoolsInternal();
    await this.audit.log({ userId: admin.user.id, action: 'admin.sync_pools', target: 'proxmox_pools', result: `success:${result.synced}` });
    return result;
  }

  @Post('vms/sync')
  async syncVms(@Req() req: AuthenticatedRequest) {
    const admin = await this.getAdminContext(req.user?.sub);
    const result = await this.syncVmsInternal();
    await this.audit.log({ userId: admin.user.id, action: 'admin.sync_vms', target: 'vm_inventory', result: `success:${result.synced}` });
    return result;
  }

  @Post('sync-all')
  async syncAll(@Req() req: AuthenticatedRequest) {
    const admin = await this.getAdminContext(req.user?.sub);
    const pools = await this.syncPoolsInternal();
    const vms = await this.syncVmsInternal();
    await this.audit.log({
      userId: admin.user.id,
      action: 'admin.sync_all',
      target: 'inventory',
      result: `success:pools=${pools.synced},vms=${vms.synced}`,
    });
    return { pools, vms };
  }
}