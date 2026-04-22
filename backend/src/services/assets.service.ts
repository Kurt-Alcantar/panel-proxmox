import { Injectable } from '@nestjs/common'
import { PrismaService } from './prisma.service'

export type UserRole = 'platform_admin' | 'partner_admin' | 'tenant_user' | string

export interface UserContext {
  user: any
  roleCodes: UserRole[]
  isPlatformAdmin: boolean
  isPartnerAdmin: boolean
  isTenantUser: boolean
  tenantId: string | null
  tenantType: string | null       // platform | partner | client
  childTenantIds: string[]        // para partners: IDs de sus clientes
}

@Injectable()
export class AssetsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Contexto completo del usuario ───────────────────────────────

  async getUserContext(keycloakId?: string): Promise<UserContext | null> {
    if (!keycloakId) return null

    const user = await this.prisma.users.findFirst({
      where: { keycloak_id: keycloakId },
    })
    if (!user) return null

    const roles = await this.prisma.$queryRaw<Array<{ code: string }>>`
      SELECT r.code
      FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = ${user.id}::uuid
    `
    const roleCodes = roles.map(r => r.code)
    const isPlatformAdmin = roleCodes.includes('platform_admin')
    const isPartnerAdmin  = roleCodes.includes('partner_admin')
    const isTenantUser    = roleCodes.includes('tenant_user')

    // Obtener info del tenant del usuario
    let tenantId: string | null = user.tenant_id ?? null
    let tenantType: string | null = null
    let childTenantIds: string[] = []

    if (!tenantId && user.tenant_group_id) {
      const tenantGroup = await this.prisma.tenant_groups.findUnique({
        where: { id: user.tenant_group_id },
        select: { tenant_id: true },
      })
      tenantId = tenantGroup?.tenant_id ?? null
    }

    if (tenantId) {
      const tenant = await this.prisma.tenants.findUnique({
        where: { id: tenantId },
        select: { id: true, type: true },
      })

      tenantType = tenant?.type ?? null

      if (isPartnerAdmin || tenantType === 'partner') {
        const children = await this.prisma.tenants.findMany({
          where: { parent_tenant_id: tenantId, type: 'client' },
          select: { id: true },
        })
        childTenantIds = children.map(c => c.id)
      }
    }

    return { user, roleCodes, isPlatformAdmin, isPartnerAdmin, isTenantUser, tenantId, tenantType, childTenantIds }
  }

  // ─── Listado con RBAC jerárquico ─────────────────────────────────

  async listForUser(keycloakId?: string) {
    const ctx = await this.getUserContext(keycloakId)
    if (!ctx) return []

    // HYPEROX: ve todo
    if (ctx.isPlatformAdmin) {
      return this.prisma.managed_assets.findMany({
        include: { tenant_assignments: true, tags: true },
        orderBy: { display_name: 'asc' },
      })
    }

    // Partner (ej. Conestra): ve activos de todos sus clientes hijos
    if (ctx.isPartnerAdmin) {
      if (!ctx.childTenantIds.length) return []
      const assignments = await this.prisma.asset_tenant_assignments.findMany({
        where: { tenant_id: { in: ctx.childTenantIds } },
      })
      const assetIds = assignments.map(a => a.asset_id)
      if (!assetIds.length) return []
      return this.prisma.managed_assets.findMany({
        where: { id: { in: assetIds } },
        include: { tenant_assignments: true, tags: true },
        orderBy: { display_name: 'asc' },
      })
    }

    // Cliente final (ej. G-One): ve solo sus propios activos
    if (ctx.isTenantUser && ctx.tenantId) {
      const assignments = await this.prisma.asset_tenant_assignments.findMany({
        where: { tenant_id: ctx.tenantId },
      })
      const assetIds = assignments.map(a => a.asset_id)
      if (!assetIds.length) return []
      return this.prisma.managed_assets.findMany({
        where: { id: { in: assetIds } },
        include: { tenant_assignments: true, tags: true },
        orderBy: { display_name: 'asc' },
      })
    }

    return []
  }

  // ─── Acceso a un activo específico ───────────────────────────────

  async findAccessible(assetId: string, keycloakId?: string) {
    const ctx = await this.getUserContext(keycloakId)
    if (!ctx) return null

    const asset = await this.prisma.managed_assets.findUnique({
      where: { id: assetId },
      include: { tenant_assignments: true, tags: true },
    })
    if (!asset) return null

    // platform_admin: acceso total
    if (ctx.isPlatformAdmin) return asset

    const assignment = asset.tenant_assignments[0]
    if (!assignment?.tenant_id) return null

    // partner_admin: acceso si el activo pertenece a uno de sus clientes
    if (ctx.isPartnerAdmin) {
      return ctx.childTenantIds.includes(assignment.tenant_id) ? asset : null
    }

    // tenant_user: acceso solo si el activo es suyo
    if (ctx.isTenantUser) {
      return assignment.tenant_id === ctx.tenantId ? asset : null
    }

    return null
  }

  // ─── Admin: asignar activo a tenant ──────────────────────────────

  async assignToTenant(assetId: string, tenantId: string, assignedBy?: string) {
    const asset = await this.prisma.managed_assets.findUnique({ where: { id: assetId } })
    if (!asset) throw new Error('Asset no encontrado')

    const tenant = await this.prisma.tenants.findUnique({ where: { id: tenantId } })
    if (!tenant) throw new Error('Tenant no encontrado')
    if (tenant.type !== 'client') throw new Error('Solo se puede asignar activos a tenants de tipo cliente')

    return this.prisma.asset_tenant_assignments.upsert({
      where: { asset_id: assetId },
      update: { tenant_id: tenantId, assigned_by: assignedBy ?? null },
      create: { asset_id: assetId, tenant_id: tenantId, assigned_by: assignedBy ?? null },
    })
  }

  async removeFromTenant(assetId: string) {
    return this.prisma.asset_tenant_assignments.deleteMany({ where: { asset_id: assetId } })
  }

  // ─── Admin: CRUD de tenants ───────────────────────────────────────

  async createTenant(data: { name: string; code: string; type: 'partner' | 'client'; parentTenantId?: string }) {
    if (data.type === 'client' && !data.parentTenantId) {
      throw new Error('Un tenant cliente debe tener un tenant padre (partner o platform)')
    }
    return this.prisma.tenants.create({
      data: {
        name: data.name,
        code: data.code,
        type: data.type,
        status: 'ACTIVE',
        parent_tenant_id: data.parentTenantId ?? null,
      },
    })
  }

  async listTenants() {
    return this.prisma.tenants.findMany({
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    })
  }

  async getTenantTree() {
    const all = await this.prisma.tenants.findMany({ orderBy: { name: 'asc' } })
    // Construir árbol: platform → partners → clients
    const platform = all.filter(t => t.type === 'platform')
    const partners = all.filter(t => t.type === 'partner')
    const clients  = all.filter(t => t.type === 'client')

    return platform.map(p => ({
      ...p,
      partners: partners.map(pt => ({
        ...pt,
        clients: clients.filter(c => c.parent_tenant_id === pt.id),
      })),
      // clientes directos de platform (sin partner)
      directClients: clients.filter(c => c.parent_tenant_id === p.id),
    }))
  }

  // ─── Admin: CRUD de activos ───────────────────────────────────────

  async create(data: {
    displayName: string
    fleetAgentId?: string
    osType?: string
    isExternal?: boolean
    tenantId?: string
  }) {
    const asset = await this.prisma.managed_assets.create({
      data: {
        display_name: data.displayName,
        fleet_agent_id: data.fleetAgentId ?? null,
        os_type: data.osType ?? null,
        is_external: data.isExternal ?? false,
        source: 'manual',
      },
    })

    if (data.tenantId) {
      await this.assignToTenant(asset.id, data.tenantId)
    }

    return asset
  }

  async update(assetId: string, data: {
    displayName?: string
    observabilityEnabled?: boolean
    kibanaBaseUrl?: string
    osType?: string
    tags?: Array<{ key: string; value: string }>
  }) {
    const asset = await this.prisma.managed_assets.update({
      where: { id: assetId },
      data: {
        ...(data.displayName !== undefined          ? { display_name: data.displayName }                     : {}),
        ...(data.observabilityEnabled !== undefined ? { observability_enabled: data.observabilityEnabled }   : {}),
        ...(data.kibanaBaseUrl !== undefined        ? { kibana_base_url: data.kibanaBaseUrl }                : {}),
        ...(data.osType !== undefined               ? { os_type: data.osType }                               : {}),
      },
    })

    if (data.tags) {
      await this.prisma.asset_tags.deleteMany({ where: { asset_id: assetId } })
      if (data.tags.length) {
        await this.prisma.asset_tags.createMany({
          data: data.tags.map(t => ({ asset_id: assetId, key: t.key, value: t.value })),
        })
      }
    }

    return asset
  }

  async delete(assetId: string) {
    return this.prisma.managed_assets.delete({ where: { id: assetId } })
  }

  async listAll() {
    return this.prisma.managed_assets.findMany({
      include: { tenant_assignments: true, tags: true },
      orderBy: { display_name: 'asc' },
    })
  }

  async findByVmid(vmid: number) {
    const vm = await this.prisma.vm_inventory.findFirst({ where: { vmid } })
    if (!vm?.managed_asset_id) return null
    return this.prisma.managed_assets.findUnique({
      where: { id: vm.managed_asset_id },
      include: { tenant_assignments: true, tags: true },
    })
  }
}