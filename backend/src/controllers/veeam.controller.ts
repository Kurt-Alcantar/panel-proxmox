import {
  Controller, Get, Param, Query, Req, UseGuards, NotFoundException,
} from '@nestjs/common'
import { AuthGuard } from '../guards/auth.guard'
import { AssetsService } from '../services/assets.service'
import { IdentityResolverService } from '../services/identity-resolver.service'
import { VeeamJobsService } from '../services/veeam-jobs.service'

@Controller('assets')
@UseGuards(AuthGuard)
export class VeeamController {
  constructor(
    private readonly assets: AssetsService,
    private readonly identity: IdentityResolverService,
    private readonly veeam: VeeamJobsService,
  ) {}

  // GET /assets/:id/veeam/overview?hours=24
  @Get(':id/veeam/overview')
  async overview(
    @Param('id') id: string,
    @Query('hours') hours: string,
    @Req() req: any,
  ) {
    const asset = await this.assets.findAccessible(id, req.user?.sub)
    if (!asset) throw new NotFoundException()
    if (!asset.observability_enabled) return { enabled: false }

    const assetId = this.identity.resolve(asset)
    const h = parseInt(hours || '24', 10)

    try {
      const data = await this.veeam.getJobsOverview(assetId, h)
      return { enabled: true, ...data }
    } catch (err: any) {
      return { enabled: false, reason: err.message }
    }
  }

  // GET /assets/:id/veeam/jobs?days=7
  @Get(':id/veeam/jobs')
  async listJobs(
    @Param('id') id: string,
    @Query('days') days: string,
    @Req() req: any,
  ) {
    const asset = await this.assets.findAccessible(id, req.user?.sub)
    if (!asset) throw new NotFoundException()

    const assetId = this.identity.resolve(asset)
    const d = parseInt(days || '7', 10)

    try {
      return await this.veeam.listJobs(assetId, d)
    } catch (err: any) {
      return []
    }
  }

  // GET /assets/:id/veeam/jobs/:jobName/history?days=7
  @Get(':id/veeam/jobs/:jobName/history')
  async jobHistory(
    @Param('id') id: string,
    @Param('jobName') jobName: string,
    @Query('days') days: string,
    @Req() req: any,
  ) {
    const asset = await this.assets.findAccessible(id, req.user?.sub)
    if (!asset) throw new NotFoundException()

    const assetId = this.identity.resolve(asset)
    const d = parseInt(days || '7', 10)

    try {
      return await this.veeam.getJobHistory(assetId, decodeURIComponent(jobName), d)
    } catch (err: any) {
      return []
    }
  }
}
