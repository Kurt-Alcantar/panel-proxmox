import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common'
import { AuthGuard } from '../guards/auth.guard'
import { ElasticsearchService } from '../services/elasticsearch.service'
import { AssetsService } from '../services/assets.service'

@Controller('overview')
@UseGuards(AuthGuard)
export class OverviewController {
  constructor(
    private readonly elastic: ElasticsearchService,
    private readonly assets: AssetsService,
  ) {}

  @Get('metrics')
  async getMetrics(@Query('range') range = '24h', @Req() req: any) {
    const hours = range === '7d' ? 168 : range === '48h' ? 48 : 24

    try {
      const body = {
        size: 0,
        query: {
          bool: {
            filter: [
              { range: { '@timestamp': { gte: `now-${hours}h`, lte: 'now' } } },
              { terms: { 'data_stream.dataset': ['system.cpu', 'system.memory', 'system.network', 'system.filesystem'] } },
            ],
          },
        },
        aggs: {
          over_time: {
            date_histogram: {
              field: '@timestamp',
              fixed_interval: hours <= 24 ? '1h' : '6h',
              min_doc_count: 0,
              extended_bounds: { min: `now-${hours}h`, max: 'now' },
            },
            aggs: {
              avg_cpu:  { avg: { field: 'system.cpu.total.pct' } },
              avg_mem:  { avg: { field: 'system.memory.actual.used.pct' } },
              avg_net:  { avg: { field: 'system.network.in.bytes' } },
              avg_disk: { avg: { field: 'system.filesystem.used.pct' } },
            },
          },
        },
      }

      const result = await this.elastic.search('metrics-*', body).catch(() => null)
      const buckets = result?.aggregations?.over_time?.buckets || []

      const extract = (key: string) =>
        buckets.map((b: any) => {
          const val = b[key]?.value
          if (val == null) return null
          // CPU y mem ya son fracciones (0-1) en algunos beats, normalizar a 0-100
          if (key === 'avg_cpu' || key === 'avg_mem' || key === 'avg_disk') {
            return val > 1 ? Math.round(val * 10) / 10 : Math.round(val * 1000) / 10
          }
          return Math.round(val / 1024) // bytes a KB para red
        }).filter((v: any) => v !== null)

      return {
        cpu:     { series: extract('avg_cpu'),  label: 'CPU %' },
        memory:  { series: extract('avg_mem'),  label: 'Memory %' },
        network: { series: extract('avg_net'),  label: 'Network KB/s' },
        disk:    { series: extract('avg_disk'), label: 'Disk %' },
      }
    } catch {
      return { cpu: { series: [] }, memory: { series: [] }, network: { series: [] }, disk: { series: [] } }
    }
  }
}
