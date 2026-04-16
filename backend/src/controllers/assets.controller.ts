import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common'
import { AuthGuard } from '../guards/auth.guard'
import { AssetsService } from '../services/assets.service'
import { ObservabilityNativeService } from '../services/observability-native.service'
import { IdentityResolverService } from '../services/identity-resolver.service'
import { AuditService } from '../services/audit.service'

@Controller('assets')
@UseGuards(AuthGuard)
export class AssetsController {
  constructor(
    private readonly assets: AssetsService,
    private readonly observability: ObservabilityNativeService,
    private readonly identity: IdentityResolverService,
    private readonly audit: AuditService,
  ) {}

  // ─── Listado ──────────────────────────────────────────────────────

  @Get()
  async list(@Req() req: any) {
    return this.assets.listForUser(req.user?.sub)
  }

  @Get(':id')
  async getOne(@Param('id') id: string, @Req() req: any) {
    const asset = await this.assets.findAccessible(id, req.user?.sub)
    if (!asset) throw new NotFoundException('Activo no encontrado o sin acceso')
    return asset
  }

  // ─── Observabilidad ───────────────────────────────────────────────

  @Get(':id/observability/overview')
  async overview(@Param('id') id: string, @Req() req: any) {
    const asset = await this.assets.findAccessible(id, req.user?.sub)
    if (!asset) throw new NotFoundException()
    if (!asset.observability_enabled) return { enabled: false, reason: 'Observabilidad deshabilitada para este activo' }

    const assetId = this.identity.resolve(asset)
    try {
      const data = await this.observability.getOverview(assetId)
      return { enabled: true, identity: { hostName: assetId.hostName, osType: assetId.osType, fleetAgentId: assetId.fleetAgentId }, kibanaUrl: asset.kibana_base_url || process.env.KIBANA_BASE_URL, ...data }
    } catch (err: any) {
      return { enabled: false, reason: err.message }
    }
  }

  @Get(':id/observability/security')
  async security(@Param('id') id: string, @Req() req: any) {
    const asset = await this.assets.findAccessible(id, req.user?.sub)
    if (!asset) throw new NotFoundException()
    if (!asset.observability_enabled) return { enabled: false, reason: 'Observabilidad deshabilitada' }

    const assetId = this.identity.resolve(asset)
    if (!assetId.osType) return { enabled: false, reason: 'OS no configurado para este activo' }

    try {
      if (assetId.osType === 'windows') return { enabled: true, ...(await this.observability.getWindowsSecurity(assetId)) }
      if (assetId.osType === 'linux') return { enabled: true, ...(await this.observability.getLinuxSecurity(assetId)) }
      return { enabled: false, reason: 'OS no soportado' }
    } catch (err: any) {
      return { enabled: false, reason: err.message }
    }
  }

  @Get(':id/observability/security/export')
  async securityExport(
    @Param('id') id: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Req() req: any,
  ) {
    const asset = await this.assets.findAccessible(id, req.user?.sub)
    if (!asset) throw new NotFoundException()
    if (!asset.observability_enabled) return { enabled: false }

    const fromDate = from || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const toDate = to || new Date().toISOString()
    const assetId = this.identity.resolve(asset)

    if (!assetId.osType) return { enabled: false, reason: 'OS no configurado' }

    if (assetId.osType === 'windows') return { enabled: true, assetName: asset.display_name, ...(await this.observability.getWindowsSecurityExport(assetId, fromDate, toDate)) }
    if (assetId.osType === 'linux') return { enabled: true, assetName: asset.display_name, ...(await this.observability.getLinuxSecurityExport(assetId, fromDate, toDate)) }
    return { enabled: false, reason: 'OS no soportado' }
  }

  @Get(':id/observability/services')
  async services(@Param('id') id: string, @Req() req: any) {
    const asset = await this.assets.findAccessible(id, req.user?.sub)
    if (!asset) throw new NotFoundException()
    if (!asset.observability_enabled) return { enabled: false }

    const assetId = this.identity.resolve(asset)
    if (!assetId.osType) return { enabled: false, reason: 'OS no configurado' }

    try {
      if (assetId.osType === 'windows') return { enabled: true, ...(await this.observability.getWindowsServices(assetId)) }
      if (assetId.osType === 'linux') return { enabled: true, ...(await this.observability.getLinuxServices(assetId)) }
      return { enabled: false, reason: 'OS no soportado' }
    } catch (err: any) {
      return { enabled: false, reason: err.message }
    }
  }

  @Get(':id/observability/events')
  async events(@Param('id') id: string, @Req() req: any) {
    const asset = await this.assets.findAccessible(id, req.user?.sub)
    if (!asset) throw new NotFoundException()
    if (!asset.observability_enabled) return { enabled: false, rows: [] }

    const assetId = this.identity.resolve(asset)
    if (!assetId.osType) return { enabled: false, rows: [], reason: 'OS no configurado' }

    try {
      if (assetId.osType === 'windows') return { enabled: true, rows: await this.observability.getWindowsEvents(assetId) }
      if (assetId.osType === 'linux') return { enabled: true, rows: await this.observability.getLinuxEvents(assetId) }
      return { enabled: false, rows: [] }
    } catch (err: any) {
      return { enabled: false, rows: [], reason: err.message }
    }
  }

  @Get(':id/observability/sql')
  async sql(@Param('id') id: string, @Req() req: any) {
    const asset = await this.assets.findAccessible(id, req.user?.sub)
    if (!asset) throw new NotFoundException()
    if (!asset.observability_enabled) return { enabled: false }

    const assetId = this.identity.resolve(asset)
    try {
      return { enabled: true, ...(await this.observability.getSqlOverview(assetId)) }
    } catch (err: any) {
      return { enabled: false, reason: err.message }
    }
  }

  @Get(':id/audit')
  async getAudit(@Param('id') id: string) {
    return [] // se puede ampliar con audit_logs filtrado por target: asset:{id}
  }
}

// ─── Admin Assets Controller ─────────────────────────────────────────────────

@Controller('admin/assets')
@UseGuards(AuthGuard)
export class AdminAssetsController {
  constructor(
    private readonly assets: AssetsService,
    private readonly audit: AuditService,
  ) {}

  private async requireAdmin(keycloakId?: string) {
    if (!keycloakId) throw new ForbiddenException('Sin token')
    const ctx = await this.assets.getUserContext(keycloakId)
    if (!ctx) throw new ForbiddenException('Usuario no encontrado')
    if (!ctx.isPlatformAdmin) throw new ForbiddenException('Se requiere rol platform_admin')
    return ctx
  }

  @Get()
  async listAll(@Req() req: any) {
    await this.requireAdmin(req.user?.sub)
    return this.assets.listAll()
  }

  @Post()
  async create(@Req() req: any, @Body() body: any) {
    const admin = await this.requireAdmin(req.user?.sub)
    if (!body?.displayName) throw new BadRequestException('displayName es requerido')
    const asset = await this.assets.create({
      displayName: body.displayName,
      fleetAgentId: body.fleetAgentId,
      osType: body.osType,
      isExternal: body.isExternal ?? false,
      tenantId: body.tenantId,
    })
    await this.audit.log({ userId: admin.user.id, action: 'admin.create_asset', target: `asset:${asset.id}`, result: 'success' })
    return asset
  }

  @Patch(':id')
  async update(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    const admin = await this.requireAdmin(req.user?.sub)
    const asset = await this.assets.update(id, {
      displayName: body.displayName,
      observabilityEnabled: body.observabilityEnabled,
      kibanaBaseUrl: body.kibanaBaseUrl,
      osType: body.osType,
      tags: body.tags,
    })
    await this.audit.log({ userId: admin.user.id, action: 'admin.update_asset', target: `asset:${id}`, result: 'success' })
    return asset
  }

  @Put(':id/assign')
  async assign(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    const admin = await this.requireAdmin(req.user?.sub)
    if (!body?.tenantId) throw new BadRequestException('tenantId es requerido')
    const result = await this.assets.assignToTenant(id, body.tenantId, admin.user.id)
    await this.audit.log({ userId: admin.user.id, action: 'admin.assign_asset', target: `asset:${id}`, result: `tenant:${body.tenantId}` })
    return result
  }

  @Delete(':id/assign')
  async unassign(@Req() req: any, @Param('id') id: string) {
    const admin = await this.requireAdmin(req.user?.sub)
    await this.assets.removeFromTenant(id)
    await this.audit.log({ userId: admin.user.id, action: 'admin.unassign_asset', target: `asset:${id}`, result: 'success' })
    return { ok: true }
  }

  @Delete(':id')
  async delete(@Req() req: any, @Param('id') id: string) {
    const admin = await this.requireAdmin(req.user?.sub)
    await this.assets.delete(id)
    await this.audit.log({ userId: admin.user.id, action: 'admin.delete_asset', target: `asset:${id}`, result: 'success' })
    return { ok: true }
  }
}