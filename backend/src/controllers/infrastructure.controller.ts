import {
  Controller, Get, Post, Param, Query, Req, UseGuards, UnauthorizedException,
} from '@nestjs/common'
import { PrismaService } from '../services/prisma.service'
import { ProxmoxService } from '../services/proxmox.service'
import { AuthGuard } from '../guards/auth.guard'
import { AuditService } from '../services/audit.service'
import { ObservabilityNativeService } from '../services/observability-native.service'
import { IdentityResolverService } from '../services/identity-resolver.service'
import { AssetsService } from '../services/assets.service'

@Controller()
@UseGuards(AuthGuard)
export class InfrastructureController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly proxmox: ProxmoxService,
    private readonly audit: AuditService,
    private readonly observability: ObservabilityNativeService,
    private readonly identityResolver: IdentityResolverService,
    private readonly assetsService: AssetsService,
  ) {}

  private serializeVm(vm: any) {
    return {
      ...vm,
      memory: vm.memory !== null ? vm.memory.toString() : null,
      disk: vm.disk !== null ? vm.disk.toString() : null,
    }
  }

  private async getUserContext(keycloakId?: string) {
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
    const isPartnerAdmin = roleCodes.includes('partner_admin')
    const isTenantUser = roleCodes.includes('tenant_user')

    let tenantId: string | null = (user as any).tenant_id ?? null
    const tenantGroupId: string | null = (user as any).tenant_group_id ?? null

    if (!tenantId && tenantGroupId) {
      const tenantGroup = await this.prisma.tenant_groups.findFirst({
        where: { id: tenantGroupId },
        select: { tenant_id: true },
      })
      tenantId = tenantGroup?.tenant_id ?? null
    }

    return {
      user,
      roleCodes,
      isPlatformAdmin,
      isPartnerAdmin,
      isTenantUser,
      tenantId,
      tenantGroupId,
    }
  }

  private async getAllowedPoolExternalIds(userContext: any) {
    if (!userContext?.user) return []
    if (userContext.isPlatformAdmin) return null
    if (!userContext.user.tenant_group_id) return []
    const bindings = await this.prisma.tenant_group_pools.findMany({ where: { tenant_group_id: userContext.user.tenant_group_id } })
    const poolIds = bindings.map((b) => b.proxmox_pool_id)
    if (!poolIds.length) return []
    const pools = await this.prisma.proxmox_pools.findMany({ where: { id: { in: poolIds } } })
    return pools.map((p) => p.external_id)
  }

  private async findAccessibleVm(vmid: number, keycloakId?: string) {
    const userContext = await this.getUserContext(keycloakId)
    if (!userContext) return null

    if (userContext.isPlatformAdmin) {
      return this.prisma.vm_inventory.findFirst({ where: { vmid } })
    }

    const orWhere: any[] = []

    const poolNames = await this.getAllowedPoolExternalIds(userContext)
    if (poolNames?.length) {
      orWhere.push({ pool_id: { in: poolNames } })
    }

    if (userContext.tenantId) {
      orWhere.push({ tenant_id: userContext.tenantId })
    }

    if (userContext.tenantGroupId) {
      orWhere.push({ tenant_group_id: userContext.tenantGroupId })
    }

    if (!orWhere.length) return null

    return this.prisma.vm_inventory.findFirst({
      where: {
        vmid,
        OR: orWhere,
      },
    })
  }

  // ─── RUTAS INFRA (renombradas /infra/vms) ─────────────────────────

  @Get('infra/vms')
  async listVms() {
    const vms = await this.prisma.vm_inventory.findMany({ orderBy: { vmid: 'asc' } })
    return vms.map((vm) => this.serializeVm(vm))
  }

  @Get('infra/vms/:vmid')
  async getVmDetail(@Param('vmid') vmid: string, @Req() req: any) {
    const vm = await this.findAccessibleVm(Number(vmid), req.user?.sub)
    if (!vm) return null
    return this.serializeVm(vm)
  }

  @Post('infra/vms/sync')
  async syncVMs() {
    const vms = await this.proxmox.getAllVMs()
    for (const vm of vms) {
      await this.prisma.vm_inventory.upsert({
        where: { vmid: vm.vmid },
        update: { name: vm.name ?? null, node: vm.node ?? null, pool_id: vm.pool_id ?? null, status: vm.status ?? null, cpu: vm.cpu ?? null, memory: vm.memory != null ? BigInt(vm.memory) : null, disk: vm.disk != null ? BigInt(vm.disk) : null },
        create: { vmid: vm.vmid, name: vm.name ?? null, node: vm.node ?? null, pool_id: vm.pool_id ?? null, status: vm.status ?? null, cpu: vm.cpu ?? null, memory: vm.memory != null ? BigInt(vm.memory) : null, disk: vm.disk != null ? BigInt(vm.disk) : null },
      })
    }
    return { synced: vms.length }
  }

  @Get('infra/pools')
  async listPools() {
    return this.prisma.proxmox_pools.findMany({ orderBy: { name: 'asc' } })
  }

  @Post('infra/pools/sync')
  async syncPools() {
    const pools = await this.proxmox.getPools()
    for (const pool of pools) {
      await this.prisma.proxmox_pools.upsert({
        where: { external_id: pool.poolid },
        update: { name: pool.poolid },
        create: { external_id: pool.poolid, name: pool.poolid },
      })
    }
    return { synced: pools.length }
  }

  @Post('infra/vms/:vmid/start')
  async startVM(@Param('vmid') vmid: string, @Req() req: any) {
    const user = await this.prisma.users.findFirst({ where: { keycloak_id: req.user?.sub } })
    await this.proxmox.startVM(Number(vmid))
    await this.audit.log({ userId: user?.id ?? null, action: 'vm.start', target: `vm:${vmid}`, result: 'success' })
    return { status: 'started', vmid: Number(vmid) }
  }

  @Post('infra/vms/:vmid/stop')
  async stopVM(@Param('vmid') vmid: string, @Req() req: any) {
    const user = await this.prisma.users.findFirst({ where: { keycloak_id: req.user?.sub } })
    await this.proxmox.stopVM(Number(vmid))
    await this.audit.log({ userId: user?.id ?? null, action: 'vm.stop', target: `vm:${vmid}`, result: 'success' })
    return { status: 'stopped', vmid: Number(vmid) }
  }

  @Post('infra/vms/:vmid/restart')
  async restartVM(@Param('vmid') vmid: string, @Req() req: any) {
    const user = await this.prisma.users.findFirst({ where: { keycloak_id: req.user?.sub } })
    await this.proxmox.restartVM(Number(vmid))
    await this.audit.log({ userId: user?.id ?? null, action: 'vm.restart', target: `vm:${vmid}`, result: 'success' })
    return { status: 'restarted', vmid: Number(vmid) }
  }

  @Post('infra/vms/:vmid/console')
  async openConsole(@Param('vmid') vmid: string, @Req() req: any) {
    const user = await this.prisma.users.findFirst({ where: { keycloak_id: req.user?.sub } })
    const consoleData = await this.proxmox.getVmConsole(Number(vmid))
    const proxmoxHost = process.env.PROXMOX_HOST || '192.168.10.20'
    const proxmoxNode = process.env.PROXMOX_NODE || 'hyperprox'
    await this.audit.log({ userId: user?.id ?? null, action: 'vm.console.open', target: `vm:${vmid}`, result: 'success' })
    return { vmid: Number(vmid), ...consoleData, url: `https://${proxmoxHost}:8006/?console=kvm&novnc=1&vmid=${vmid}&node=${proxmoxNode}&resize=scale` }
  }

  // ─── CAPA DE COMPATIBILIDAD Fase 1-2 ─────────────────────────────
  // Los endpoints /vms/:vmid/observability/* siguen funcionando para
  // no romper el frontend mientras se migra a /assets/:id/observability/*

  @Get('vms')
  async listVmsCompat(@Req() req: any) {
    const userContext = await this.getUserContext(req.user?.sub)
    if (!userContext) throw new UnauthorizedException()

    if (userContext.isPlatformAdmin) {
      const vms = await this.prisma.vm_inventory.findMany({ orderBy: { vmid: 'asc' } })
      return vms.map((vm) => this.serializeVm(vm))
    }

    const orWhere: any[] = []

    const poolNames = await this.getAllowedPoolExternalIds(userContext)
    if (poolNames?.length) {
      orWhere.push({ pool_id: { in: poolNames } })
    }

    if (userContext.tenantId) {
      orWhere.push({ tenant_id: userContext.tenantId })
    }

    if (userContext.tenantGroupId) {
      orWhere.push({ tenant_group_id: userContext.tenantGroupId })
    }

    if (!orWhere.length) return []

    const vms = await this.prisma.vm_inventory.findMany({
      where: { OR: orWhere },
      orderBy: { vmid: 'asc' },
    })

    return vms.map((vm) => this.serializeVm(vm))
  }

  @Get('my/vms')
  async myVMs(@Req() req: any) {
    const userContext = await this.getUserContext(req.user?.sub)
    if (!userContext?.user) {
      throw new UnauthorizedException('Usuario no encontrado')
    }

    if (userContext.isPlatformAdmin) {
      const vms = await this.prisma.vm_inventory.findMany({ orderBy: { vmid: 'asc' } })
      return vms.map((vm) => this.serializeVm(vm))
    }

    const orWhere: any[] = []

    const poolNames = await this.getAllowedPoolExternalIds(userContext)
    if (poolNames?.length) {
      orWhere.push({ pool_id: { in: poolNames } })
    }

    if (userContext.tenantId) {
      orWhere.push({ tenant_id: userContext.tenantId })
    }

    if (userContext.tenantGroupId) {
      orWhere.push({ tenant_group_id: userContext.tenantGroupId })
    }

    if (!orWhere.length) return []

    const vms = await this.prisma.vm_inventory.findMany({
      where: { OR: orWhere },
      orderBy: { vmid: 'asc' },
    })

    return vms.map((vm) => this.serializeVm(vm))
  }

  @Get('vms/:vmid')
  async getVmDetailCompat(@Param('vmid') vmid: string, @Req() req: any) {
    const vm = await this.findAccessibleVm(Number(vmid), req.user?.sub)
    if (!vm) return null
    return this.serializeVm(vm)
  }

  private async resolveObsIdentity(vm: any) {
    // Si la VM tiene managed_asset_id, usar el asset para mejor correlación
    if (vm.managed_asset_id) {
      const asset = await this.prisma.managed_assets.findUnique({ where: { id: vm.managed_asset_id } })
      if (asset) return this.identityResolver.resolve(asset)
    }
    // Fallback legacy: construir identity desde vm_inventory
    return this.identityResolver.resolve({
      fleet_agent_id: null,
      elastic_agent_id: null,
      host_id: null,
      host_name: vm.elastic_host_name || vm.name,
      os_type: vm.os_type,
    })
  }

  @Get('vms/:vmid/observability/overview')
  async getVmOverviewCompat(@Param('vmid') vmid: string, @Req() req: any) {
    const vm = await this.findAccessibleVm(Number(vmid), req.user?.sub)
    if (!vm || !vm.observability_enabled) return { enabled: false }
    const id = await this.resolveObsIdentity(vm)
    if (!id.hostName && !id.fleetAgentId) return { enabled: false, reason: 'Sin identificador de host' }
    try {
      return { enabled: true, hostName: id.hostName, osType: id.osType, kibanaUrl: vm.kibana_base_url || process.env.KIBANA_BASE_URL, ...(await this.observability.getOverview(id)) }
    } catch (err: any) {
      return { enabled: false, reason: err.message }
    }
  }

  @Get('vms/:vmid/observability/security')
  async getVmSecurityCompat(@Param('vmid') vmid: string, @Req() req: any) {
    const vm = await this.findAccessibleVm(Number(vmid), req.user?.sub)
    if (!vm || !vm.observability_enabled) return { enabled: false }
    const id = await this.resolveObsIdentity(vm)
    if (!id.osType) return { enabled: false, reason: 'OS no configurado' }
    if (id.osType === 'windows') return { enabled: true, ...(await this.observability.getWindowsSecurity(id)) }
    if (id.osType === 'linux') return { enabled: true, ...(await this.observability.getLinuxSecurity(id)) }
    return { enabled: false, reason: 'OS no soportado' }
  }

  @Get('vms/:vmid/observability/security/export')
  async exportVmSecurityCompat(@Param('vmid') vmid: string, @Query('from') from: string, @Query('to') to: string, @Req() req: any) {
    const vm = await this.findAccessibleVm(Number(vmid), req.user?.sub)
    if (!vm || !vm.observability_enabled) return { enabled: false }
    const fromDate = from || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const toDate = to || new Date().toISOString()
    const id = await this.resolveObsIdentity(vm)
    if (!id.osType) return { enabled: false, reason: 'OS no configurado' }
    if (id.osType === 'windows') return { enabled: true, vmName: vm.name, ...(await this.observability.getWindowsSecurityExport(id, fromDate, toDate)) }
    if (id.osType === 'linux') return { enabled: true, vmName: vm.name, ...(await this.observability.getLinuxSecurityExport(id, fromDate, toDate)) }
    return { enabled: false }
  }

  @Get('vms/:vmid/observability/services')
  async getVmServicesCompat(@Param('vmid') vmid: string, @Req() req: any) {
    const vm = await this.findAccessibleVm(Number(vmid), req.user?.sub)
    if (!vm || !vm.observability_enabled) return { enabled: false }
    const id = await this.resolveObsIdentity(vm)
    if (!id.osType) return { enabled: false }
    if (id.osType === 'windows') return { enabled: true, ...(await this.observability.getWindowsServices(id)) }
    if (id.osType === 'linux') return { enabled: true, ...(await this.observability.getLinuxServices(id)) }
    return { enabled: false }
  }

  @Get('vms/:vmid/observability/events')
  async getVmEventsCompat(@Param('vmid') vmid: string, @Req() req: any) {
    const vm = await this.findAccessibleVm(Number(vmid), req.user?.sub)
    if (!vm || !vm.observability_enabled) return { enabled: false, rows: [] }
    const id = await this.resolveObsIdentity(vm)
    if (!id.osType) return { enabled: false, rows: [] }
    if (id.osType === 'windows') return { enabled: true, rows: await this.observability.getWindowsEvents(id) }
    if (id.osType === 'linux') return { enabled: true, rows: await this.observability.getLinuxEvents(id) }
    return { enabled: false, rows: [] }
  }

  @Get('vms/:vmid/observability/sql')
  async getVmSqlCompat(@Param('vmid') vmid: string, @Req() req: any) {
    const vm = await this.findAccessibleVm(Number(vmid), req.user?.sub)
    if (!vm || !vm.observability_enabled) return { enabled: false }
    const id = await this.resolveObsIdentity(vm)
    return { enabled: true, ...(await this.observability.getSqlOverview(id)) }
  }

  @Get('vms/:vmid/audit')
  async getVmAudit(@Param('vmid') vmid: string) {
    return this.prisma.audit_logs.findMany({ where: { target: `vm:${vmid}` }, orderBy: { created_at: 'desc' }, take: 100 })
  }

  @Get('audit')
  async listAudit() {
    return this.prisma.audit_logs.findMany({ orderBy: { created_at: 'desc' }, take: 100 })
  }

  @Get('pools')
  async listPoolsCompat() {
    return this.prisma.proxmox_pools.findMany({ orderBy: { name: 'asc' } })
  }

  @Post('vms/sync')
  async syncVMsCompat() {
    const vms = await this.proxmox.getAllVMs()
    for (const vm of vms) {
      await this.prisma.vm_inventory.upsert({
        where: { vmid: vm.vmid },
        update: { name: vm.name ?? null, node: vm.node ?? null, pool_id: vm.pool_id ?? null, status: vm.status ?? null, cpu: vm.cpu ?? null, memory: vm.memory != null ? BigInt(vm.memory) : null, disk: vm.disk != null ? BigInt(vm.disk) : null },
        create: { vmid: vm.vmid, name: vm.name ?? null, node: vm.node ?? null, pool_id: vm.pool_id ?? null, status: vm.status ?? null, cpu: vm.cpu ?? null, memory: vm.memory != null ? BigInt(vm.memory) : null, disk: vm.disk != null ? BigInt(vm.disk) : null },
      })
    }
    return { synced: vms.length }
  }

  @Post('pools/sync')
  async syncPoolsCompat() {
    const pools = await this.proxmox.getPools()
    for (const pool of pools) {
      await this.prisma.proxmox_pools.upsert({ where: { external_id: pool.poolid }, update: { name: pool.poolid }, create: { external_id: pool.poolid, name: pool.poolid } })
    }
    return { synced: pools.length }
  }

  @Post('vms/:vmid/start')
  async startVMCompat(@Param('vmid') vmid: string, @Req() req: any) {
    const user = await this.prisma.users.findFirst({ where: { keycloak_id: req.user?.sub } })
    await this.proxmox.startVM(Number(vmid))
    await this.audit.log({ userId: user?.id ?? null, action: 'vm.start', target: `vm:${vmid}`, result: 'success' })
    return { status: 'started', vmid: Number(vmid) }
  }

  @Post('vms/:vmid/stop')
  async stopVMCompat(@Param('vmid') vmid: string, @Req() req: any) {
    const user = await this.prisma.users.findFirst({ where: { keycloak_id: req.user?.sub } })
    await this.proxmox.stopVM(Number(vmid))
    await this.audit.log({ userId: user?.id ?? null, action: 'vm.stop', target: `vm:${vmid}`, result: 'success' })
    return { status: 'stopped', vmid: Number(vmid) }
  }

  @Post('vms/:vmid/restart')
  async restartVMCompat(@Param('vmid') vmid: string, @Req() req: any) {
    const user = await this.prisma.users.findFirst({ where: { keycloak_id: req.user?.sub } })
    await this.proxmox.restartVM(Number(vmid))
    await this.audit.log({ userId: user?.id ?? null, action: 'vm.restart', target: `vm:${vmid}`, result: 'success' })
    return { status: 'restarted', vmid: Number(vmid) }
  }

  @Post('vms/:vmid/console')
  async openConsoleCompat(@Param('vmid') vmid: string, @Req() req: any) {
    const user = await this.prisma.users.findFirst({ where: { keycloak_id: req.user?.sub } })
    const consoleData = await this.proxmox.getVmConsole(Number(vmid))
    const proxmoxHost = process.env.PROXMOX_HOST || '192.168.10.20'
    const proxmoxNode = process.env.PROXMOX_NODE || 'hyperprox'
    await this.audit.log({ userId: user?.id ?? null, action: 'vm.console.open', target: `vm:${vmid}`, result: 'success' })
    return { vmid: Number(vmid), ...consoleData, url: `https://${proxmoxHost}:8006/?console=kvm&novnc=1&vmid=${vmid}&node=${proxmoxNode}&resize=scale` }
  }

  @Get('tenant-groups/:code/vms')
  async listByTenantGroup(@Param('code') code: string) {
    const tenantGroup = await this.prisma.tenant_groups.findFirst({ where: { code } })
    if (!tenantGroup) return []
    const bindings = await this.prisma.tenant_group_pools.findMany({ where: { tenant_group_id: tenantGroup.id } })
    const proxmoxPoolIds = bindings.map((b) => b.proxmox_pool_id)
    if (!proxmoxPoolIds.length) return []
    const pools = await this.prisma.proxmox_pools.findMany({ where: { id: { in: proxmoxPoolIds } } })
    const poolNames = pools.map((p) => p.external_id)
    const vms = await this.prisma.vm_inventory.findMany({ where: { pool_id: { in: poolNames } }, orderBy: { vmid: 'asc' } })
    return vms.map((vm) => this.serializeVm(vm))
  }
}
