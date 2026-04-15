import { Injectable } from '@nestjs/common'
import { PrismaService } from './prisma.service'

@Injectable()
export class AssetsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Contexto de usuario (igual que vm.controller) ───────────────

  async getUserContext(keycloakId?: string) {
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

    const roleCodes = roles.map((row) => row.code)
    const isPlatformAdmin = roleCodes.includes('platform_admin')

    return { user, roleCodes, isPlatformAdmin }
  }

  // ─── Listado con RBAC ─────────────────────────────────────────────

  async listForUser(keycloakId?: string) {
    const ctx = await this.getUserContext(keycloakId)
    if (!ctx) return []

    if (ctx.isPlatformAdmin) {
      return this.prisma.managed_assets.findMany({
        include: { tenant_assignments: true, tags: true },
        orderBy: { display_name: 'asc' },
      })
    }

    if (!ctx.user.tenant_group_id) return []

    const assignments = await this.prisma.asset_tenant_assignments.findMany({
      where: { tenant_group_id: ctx.user.tenant_group_id },
    })
    const assetIds = assignments.map((a) => a.asset_id)
    if (!assetIds.length) return []

    return this.prisma.managed_assets.findMany({
      where: { id: { in: assetIds } },
      include: { tenant_assignments: true, tags: true },
      orderBy: { display_name: 'asc' },
    })
  }

  async findAccessible(assetId: string, keycloakId?: string) {
    const ctx = await this.getUserContext(keycloakId)
    if (!ctx) return null

    const asset = await this.prisma.managed_assets.findUnique({
      where: { id: assetId },
      include: { tenant_assignments: true, tags: true },
    })
    if (!asset) return null

    if (ctx.isPlatformAdmin) return asset

    const assignment = asset.tenant_assignments[0]
    if (!assignment) return null
    if (assignment.tenant_group_id !== ctx.user.tenant_group_id) return null

    return asset
  }

  // ─── Admin: asignar activo a tenant_group ─────────────────────────

  async assignToTenantGroup(assetId: string, tenantGroupId: string, assignedBy?: string) {
    const asset = await this.prisma.managed_assets.findUnique({ where: { id: assetId } })
    if (!asset) throw new Error('Asset no encontrado')

    const group = await this.prisma.tenant_groups.findUnique({ where: { id: tenantGroupId } })
    if (!group) throw new Error('Tenant group no encontrado')

    return this.prisma.asset_tenant_assignments.upsert({
      where: { asset_id: assetId },
      update: { tenant_group_id: tenantGroupId, assigned_by: assignedBy ?? null },
      create: { asset_id: assetId, tenant_group_id: tenantGroupId, assigned_by: assignedBy ?? null },
    })
  }

  async removeFromTenantGroup(assetId: string) {
    return this.prisma.asset_tenant_assignments.deleteMany({ where: { asset_id: assetId } })
  }

  // ─── Admin: CRUD de activos ──────────────────────────────────────

  async create(data: {
    displayName: string
    fleetAgentId?: string
    osType?: string
    isExternal?: boolean
    tenantGroupId?: string
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

    if (data.tenantGroupId) {
      await this.assignToTenantGroup(asset.id, data.tenantGroupId)
    }

    return asset
  }

  async update(
    assetId: string,
    data: {
      displayName?: string
      observabilityEnabled?: boolean
      kibanaBaseUrl?: string
      osType?: string
      tags?: Array<{ key: string; value: string }>
    }
  ) {
    const asset = await this.prisma.managed_assets.update({
      where: { id: assetId },
      data: {
        ...(data.displayName !== undefined ? { display_name: data.displayName } : {}),
        ...(data.observabilityEnabled !== undefined ? { observability_enabled: data.observabilityEnabled } : {}),
        ...(data.kibanaBaseUrl !== undefined ? { kibana_base_url: data.kibanaBaseUrl } : {}),
        ...(data.osType !== undefined ? { os_type: data.osType } : {}),
      },
    })

    if (data.tags) {
      // Reemplazar tags del activo
      await this.prisma.asset_tags.deleteMany({ where: { asset_id: assetId } })
      if (data.tags.length) {
        await this.prisma.asset_tags.createMany({
          data: data.tags.map((t) => ({ asset_id: assetId, key: t.key, value: t.value })),
        })
      }
    }

    return asset
  }

  async delete(assetId: string) {
    return this.prisma.managed_assets.delete({ where: { id: assetId } })
  }

  // ─── Resolución de compat: VM → Asset ────────────────────────────

  /**
   * Dado un vmid de Proxmox, intenta encontrar el managed_asset
   * asociado via vm_inventory.managed_asset_id.
   * Útil para la capa de compatibilidad de Fase 1-2.
   */
  async findByVmid(vmid: number) {
    const vm = await this.prisma.vm_inventory.findFirst({ where: { vmid } })
    if (!vm?.managed_asset_id) return null

    return this.prisma.managed_assets.findUnique({
      where: { id: vm.managed_asset_id },
      include: { tenant_assignments: true, tags: true },
    })
  }

  // ─── Listados para Admin ─────────────────────────────────────────

  async listAll() {
    return this.prisma.managed_assets.findMany({
      include: { tenant_assignments: true, tags: true },
      orderBy: { display_name: 'asc' },
    })
  }
}
