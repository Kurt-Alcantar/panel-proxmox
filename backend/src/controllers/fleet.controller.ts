import { Controller, Get, Post, Req, UseGuards, ForbiddenException } from '@nestjs/common'
import { AuthGuard } from '../guards/auth.guard'
import { FleetService } from '../services/fleet.service'
import { FleetSyncJob } from '../services/fleet-sync.job'
import { AssetsService } from '../services/assets.service'
import { AuditService } from '../services/audit.service'

@Controller('fleet')
@UseGuards(AuthGuard)
export class FleetController {
  constructor(
    private readonly fleet: FleetService,
    private readonly syncJob: FleetSyncJob,
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

  @Get('agents')
  async listAgents(@Req() req: any) {
    await this.requireAdmin(req.user?.sub)
    return this.fleet.getAllAgents()
  }

  @Get('policies')
  async listPolicies(@Req() req: any) {
    await this.requireAdmin(req.user?.sub)
    return this.fleet.listPolicies()
  }

  @Post('sync')
  async sync(@Req() req: any) {
    const admin = await this.requireAdmin(req.user?.sub)
    const result = await this.syncJob.run()
    await this.audit.log({
      userId: admin.user.id,
      action: 'fleet.sync',
      target: 'managed_assets',
      result: `created:${result.created},updated:${result.updated},errors:${result.errors}`,
    })
    return result
  }
}
