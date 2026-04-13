import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
  UnauthorizedException
} from '@nestjs/common';
import { PrismaService } from '../services/prisma.service';
import { ProxmoxService } from '../services/proxmox.service';
import { AuthGuard } from '../guards/auth.guard';
import { AuditService } from '../services/audit.service';
import { getVmObservability } from '../observability';
import { ObservabilityNativeService } from '../services/observability-native.service';

@Controller()
export class VmController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly proxmox: ProxmoxService,
    private readonly audit: AuditService,
    private readonly observabilityNative: ObservabilityNativeService
  ) {}

  private serializeVm(vm: any) {
    return {
      ...vm,
      memory: vm.memory !== null ? vm.memory.toString() : null,
      disk: vm.disk !== null ? vm.disk.toString() : null
    };
  }

  private async getUserContext(keycloakId?: string) {
    if (!keycloakId) return null;

    const user = await this.prisma.users.findFirst({
      where: { keycloak_id: keycloakId }
    });

    if (!user) return null;

    const roles = await this.prisma.$queryRaw<Array<{ code: string }>>`
      SELECT r.code
      FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = ${user.id}::uuid
    `;

    const roleCodes = roles.map((row) => row.code);
    const isPlatformAdmin = roleCodes.includes('platform_admin');

    return { user, roleCodes, isPlatformAdmin };
  }

  private async getAllowedPoolExternalIds(userContext: any) {
    if (!userContext?.user) return [];
    if (userContext.isPlatformAdmin) return null;
    if (!userContext.user.tenant_group_id) return [];

    const bindings = await this.prisma.tenant_group_pools.findMany({
      where: { tenant_group_id: userContext.user.tenant_group_id }
    });

    const poolIds = bindings.map((b) => b.proxmox_pool_id);
    if (!poolIds.length) return [];

    const pools = await this.prisma.proxmox_pools.findMany({
      where: { id: { in: poolIds } }
    });

    return pools.map((p) => p.external_id);
  }

  private async findAccessibleVm(vmid: number, keycloakId?: string) {
    const userContext = await this.getUserContext(keycloakId);
    if (!userContext) return null;

    if (userContext.isPlatformAdmin) {
      return this.prisma.vm_inventory.findFirst({ where: { vmid } });
    }

    const poolNames = await this.getAllowedPoolExternalIds(userContext);
    if (!poolNames?.length) return null;

    return this.prisma.vm_inventory.findFirst({
      where: {
        vmid,
        pool_id: { in: poolNames }
      }
    });
  }

  @UseGuards(AuthGuard)
  @Get('vms/:vmid')
  async getVmDetail(@Param('vmid') vmid: string, @Req() req: any) {
    const vm = await this.findAccessibleVm(Number(vmid), req.user?.sub);
    if (!vm) return null;

    return {
      ...this.serializeVm(vm),
      observability: getVmObservability(vm)
    };
  }

  @UseGuards(AuthGuard)
  @Get('vms/:vmid/observability/overview')
  async getVmOverview(@Param('vmid') vmid: string, @Req() req: any) {
    const vm = await this.findAccessibleVm(Number(vmid), req.user?.sub);
    if (!vm) return null;

    const observability = getVmObservability(vm);
    if (!observability.enabled || !observability.hostName) {
      return { enabled: false, reason: 'Observabilidad no habilitada para esta VM' };
    }

    const data = await this.observabilityNative.getOverview(observability.hostName);

    return {
      enabled: true,
      hostName: observability.hostName,
      osType: observability.osType,
      services: observability.services,
      kibanaUrl: observability.baseUrl,
      ...data
    };
  }

  @UseGuards(AuthGuard)
  @Get('vms/:vmid/observability/security')
  async getVmSecurity(@Param('vmid') vmid: string, @Req() req: any) {
    const vm = await this.findAccessibleVm(Number(vmid), req.user?.sub);
    if (!vm) return null;

    const observability = getVmObservability(vm);
    if (!observability.enabled || !observability.hostName || !observability.osType) {
      return {
        enabled: false,
        reason: 'Observabilidad no habilitada para esta VM.'
      };
    }

    if (observability.osType === 'windows') {
      return {
        enabled: true,
        ...(await this.observabilityNative.getWindowsSecurity(observability.hostName))
      };
    }

    if (observability.osType === 'linux') {
      return {
        enabled: true,
        ...(await this.observabilityNative.getLinuxSecurity(observability.hostName))
      };
    }

    return {
      enabled: false,
      reason: 'OS no soportado para dashboard nativo.'
    };
  }

  @UseGuards(AuthGuard)
  @Get('vms/:vmid/observability/security/export')
  async exportVmSecurity(
    @Param('vmid') vmid: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Req() req: any
  ) {
    const vm = await this.findAccessibleVm(Number(vmid), req.user?.sub);
    if (!vm) return null;

    const observability = getVmObservability(vm);
    if (!observability.enabled || !observability.hostName || !observability.osType) {
      return { enabled: false, reason: 'No disponible para esta VM.' };
    }

    const fromDate = from || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const toDate = to || new Date().toISOString();

    if (observability.osType === 'windows') {
      return {
        enabled: true,
        vmName: vm.name,
        ...(await this.observabilityNative.getWindowsSecurityExport(observability.hostName, fromDate, toDate))
      };
    }

    if (observability.osType === 'linux') {
      return {
        enabled: true,
        vmName: vm.name,
        ...(await this.observabilityNative.getLinuxSecurityExport(observability.hostName, fromDate, toDate))
      };
    }

    return { enabled: false, reason: 'OS no soportado para export.' };
  }

@UseGuards(AuthGuard)
@Get('vms/:vmid/observability/services')
async getVmServices(@Param('vmid') vmid: string, @Req() req: any) {
  const vm = await this.findAccessibleVm(Number(vmid), req.user?.sub);
  if (!vm) return null;

  const observability = getVmObservability(vm);
  if (!observability.enabled || !observability.hostName || !observability.osType) {
    return {
      enabled: false,
      reason: 'Observabilidad no habilitada para esta VM.'
    };
  }

  if (observability.osType === 'windows') {
    return {
      enabled: true,
      ...(await this.observabilityNative.getWindowsServices(observability.hostName))
    };
  }

  if (observability.osType === 'linux') {
    return {
      enabled: true,
      ...(await this.observabilityNative.getLinuxServices(observability.hostName))
    };
  }

  return {
    enabled: false,
    reason: 'OS no soportado para panel de servicios.'
  };
}
  @UseGuards(AuthGuard)
  @Get('vms/:vmid/observability/events')
  async getVmEvents(@Param('vmid') vmid: string, @Req() req: any) {
    const vm = await this.findAccessibleVm(Number(vmid), req.user?.sub);
    if (!vm) return null;

    const observability = getVmObservability(vm);
    if (!observability.enabled || !observability.hostName || !observability.osType) {
      return { enabled: false, rows: [] };
    }

    if (observability.osType === 'windows') {
      return {
        enabled: true,
        rows: await this.observabilityNative.getWindowsEvents(observability.hostName)
      };
    }

    if (observability.osType === 'linux') {
      return {
        enabled: true,
        rows: await this.observabilityNative.getLinuxEvents(observability.hostName)
      };
    }

    return { enabled: false, rows: [] };
  }
  @UseGuards(AuthGuard)
  @Get('vms')
  async list() {
    const vms = await this.prisma.vm_inventory.findMany({
      orderBy: { vmid: 'asc' }
    });

    return vms.map((vm) => this.serializeVm(vm));
  }

  @UseGuards(AuthGuard)
  @Get('tenant-groups/:code/vms')
  async listByTenantGroup(@Param('code') code: string) {
    const tenantGroup = await this.prisma.tenant_groups.findFirst({
      where: { code }
    });

    if (!tenantGroup) return [];

    const bindings = await this.prisma.tenant_group_pools.findMany({
      where: { tenant_group_id: tenantGroup.id }
    });

    const proxmoxPoolIds = bindings.map((b) => b.proxmox_pool_id);
    if (!proxmoxPoolIds.length) return [];

    const pools = await this.prisma.proxmox_pools.findMany({
      where: { id: { in: proxmoxPoolIds } }
    });
    const poolNames = pools.map((p) => p.external_id);

    const vms = await this.prisma.vm_inventory.findMany({
      where: { pool_id: { in: poolNames } },
      orderBy: { vmid: 'asc' }
    });

    return vms.map((vm) => this.serializeVm(vm));
  }

  @UseGuards(AuthGuard)
  @Get('my/vms')
  async myVMs(@Req() req: any) {
    const userContext = await this.getUserContext(req.user?.sub);

    if (!userContext?.user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    if (userContext.isPlatformAdmin) {
      const vms = await this.prisma.vm_inventory.findMany({
        orderBy: { vmid: 'asc' }
      });

      return vms.map((vm) => this.serializeVm(vm));
    }

    const poolNames = await this.getAllowedPoolExternalIds(userContext);
    if (!poolNames?.length) return [];

    const vms = await this.prisma.vm_inventory.findMany({
      where: { pool_id: { in: poolNames } },
      orderBy: { vmid: 'asc' }
    });

    return vms.map((vm) => this.serializeVm(vm));
  }

  @UseGuards(AuthGuard)
  @Post('vms/sync')
  async syncVMs() {
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
          disk: vm.disk !== null && vm.disk !== undefined ? BigInt(vm.disk) : null
        },
        create: {
          vmid: vm.vmid,
          name: vm.name ?? null,
          node: vm.node ?? null,
          pool_id: vm.pool_id ?? null,
          status: vm.status ?? null,
          cpu: vm.cpu ?? null,
          memory: vm.memory !== null && vm.memory !== undefined ? BigInt(vm.memory) : null,
          disk: vm.disk !== null && vm.disk !== undefined ? BigInt(vm.disk) : null
        }
      });
    }

    return { synced: vms.length };
  }

  @UseGuards(AuthGuard)
  @Get('pools')
  async listPools() {
    return this.prisma.proxmox_pools.findMany({ orderBy: { name: 'asc' } });
  }

  @UseGuards(AuthGuard)
  @Post('pools/sync')
  async syncPools() {
    const pools = await this.proxmox.getPools();

    for (const pool of pools) {
      await this.prisma.proxmox_pools.upsert({
        where: { external_id: pool.poolid },
        update: { name: pool.poolid },
        create: { external_id: pool.poolid, name: pool.poolid }
      });
    }

    return { synced: pools.length };
  }

  @UseGuards(AuthGuard)
  @Post('vms/:vmid/start')
  async startVM(@Param('vmid') vmid: string, @Req() req: any) {
    const user = await this.prisma.users.findFirst({
      where: { keycloak_id: req.user?.sub }
    });

    await this.proxmox.startVM(Number(vmid));

    await this.audit.log({
      userId: user?.id ?? null,
      action: 'vm.start',
      target: `vm:${vmid}`,
      result: 'success'
    });

    return { status: 'started', vmid: Number(vmid) };
  }

  @UseGuards(AuthGuard)
  @Post('vms/:vmid/stop')
  async stopVM(@Param('vmid') vmid: string, @Req() req: any) {
    const user = await this.prisma.users.findFirst({
      where: { keycloak_id: req.user?.sub }
    });

    await this.proxmox.stopVM(Number(vmid));

    await this.audit.log({
      userId: user?.id ?? null,
      action: 'vm.stop',
      target: `vm:${vmid}`,
      result: 'success'
    });

    return { status: 'stopped', vmid: Number(vmid) };
  }

  @UseGuards(AuthGuard)
  @Post('vms/:vmid/restart')
  async restartVM(@Param('vmid') vmid: string, @Req() req: any) {
    const user = await this.prisma.users.findFirst({
      where: { keycloak_id: req.user?.sub }
    });

    await this.proxmox.restartVM(Number(vmid));

    await this.audit.log({
      userId: user?.id ?? null,
      action: 'vm.restart',
      target: `vm:${vmid}`,
      result: 'success'
    });

    return { status: 'restarted', vmid: Number(vmid) };
  }

  @UseGuards(AuthGuard)
  @Post('vms/:vmid/console')
  async openConsole(@Param('vmid') vmid: string, @Req() req: any) {
    const user = await this.prisma.users.findFirst({
      where: { keycloak_id: req.user?.sub }
    });

    const consoleData = await this.proxmox.getVmConsole(Number(vmid));

    await this.audit.log({
      userId: user?.id ?? null,
      action: 'vm.console.open',
      target: `vm:${vmid}`,
      result: 'success'
    });

    return {
      vmid: Number(vmid),
      ...consoleData,
      url: `https://192.168.10.20:8006/?console=kvm&novnc=1&vmid=${vmid}&node=hyperprox&resize=scale`
    };
  }

  @UseGuards(AuthGuard)
  @Get('vms/:vmid/audit')
  async getVmAudit(@Param('vmid') vmid: string) {
    return this.prisma.audit_logs.findMany({
      where: { target: `vm:${vmid}` },
      orderBy: { created_at: 'desc' },
      take: 100
    });
  }

  @UseGuards(AuthGuard)
  @Get('audit')
  async listAudit() {
    return this.prisma.audit_logs.findMany({
      orderBy: { created_at: 'desc' },
      take: 100
    });
  }
  @UseGuards(AuthGuard)
  @Get('vms/:vmid/observability/sql')
  async getVmSql(@Param('vmid') vmid: string, @Req() req: any) {
    const vm = await this.findAccessibleVm(Number(vmid), req.user?.sub)
    if (!vm) return null

    const observability = getVmObservability(vm)
    if (!observability.enabled || !observability.hostName) {
      return {
        enabled: false,
        reason: 'Observabilidad no habilitada para esta VM.'
      }
    }

    return {
      enabled: true,
      hostName: observability.hostName,
      osType: observability.osType,
      ...(await this.observabilityNative.getSqlOverview(observability.hostName))
    }
  }
}