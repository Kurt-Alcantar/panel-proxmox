import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common'
import { AuthGuard } from '../guards/auth.guard'
import { AssetsService } from '../services/assets.service'
import { PrismaService } from '../services/prisma.service'
import { JiraService } from '../services/jira.service'

@Controller('search')
@UseGuards(AuthGuard)
export class SearchController {
  constructor(
    private readonly assets: AssetsService,
    private readonly prisma: PrismaService,
    private readonly jira: JiraService,
  ) {}

  @Get()
  async search(@Query('q') q: string, @Req() req: any) {
    if (!q || q.trim().length < 2) return { assets: [], vms: [], tickets: [] }

    const term = q.trim().toLowerCase()
    const keycloakId = req.user?.sub

    const [assetResults, vmResults, ticketResults] = await Promise.allSettled([
      this.searchAssets(term, keycloakId),
      this.searchVms(term),
      this.searchTickets(term),
    ])

    return {
      assets:  assetResults.status  === 'fulfilled' ? assetResults.value  : [],
      vms:     vmResults.status     === 'fulfilled' ? vmResults.value     : [],
      tickets: ticketResults.status === 'fulfilled' ? ticketResults.value : [],
    }
  }

  private async searchAssets(term: string, keycloakId?: string) {
    const all = await this.assets.listForUser(keycloakId)
    return all
      .filter(a => {
        const text = `${a.display_name || ''} ${a.host_name || ''} ${(a.ip_addresses || []).join(' ')} ${a.fleet_policy_name || ''}`.toLowerCase()
        return text.includes(term)
      })
      .slice(0, 5)
      .map(a => ({ id: a.id, display_name: a.display_name || a.host_name, agent_status: a.agent_status, os_type: a.os_type }))
  }

  private async searchVms(term: string) {
    const vms = await this.prisma.vm_inventory.findMany({
      where: {
        OR: [
          { name: { contains: term, mode: 'insensitive' } },
          { node: { contains: term, mode: 'insensitive' } },
        ],
      },
      take: 5,
    })
    return vms.map(v => ({ id: String(v.vmid), vmid: v.vmid, name: v.name || `VM ${v.vmid}`, status: v.status }))
  }

  private async searchTickets(term: string) {
    if (!this.jira.isConfigured()) return []
    try {
      const result = await this.jira.listTickets(term)
      return (result.items || []).slice(0, 5).map((t: any) => ({ key: t.key, title: t.title, status: t.status }))
    } catch { return [] }
  }
}
