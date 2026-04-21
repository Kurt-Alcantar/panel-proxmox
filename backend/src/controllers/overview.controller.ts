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
          if (key === 'avg_cpu' || key === 'avg_mem' || key === 'avg_disk') {
            return val > 1 ? Math.round(val * 10) / 10 : Math.round(val * 1000) / 10
          }
          return Math.round(val / 1024)
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

  @Get('attack-map')
  async getAttackMap(@Query('range') range = '24h', @Req() req: any) {
    const hours = range === '7d' ? 168 : range === '48h' ? 48 : 24

    const body = {
      size: 0,
      query: {
        bool: {
          filter: [
            { range: { '@timestamp': { gte: `now-${hours}h`, lte: 'now' } } },
            {
              exists: { field: 'source.ip' },
            },
            {
              exists: { field: 'source.geo.location' },
            },
          ],
          should: [
            { term: { 'event.code': '4625' } },
            { term: { 'event.code': 4625 } },
            { term: { 'event.outcome': 'failure' } },
            {
              wildcard: {
                'message.keyword': {
                  value: '*failed*',
                  case_insensitive: true,
                },
              },
            },
            {
              wildcard: {
                'message.keyword': {
                  value: '*authentication failure*',
                  case_insensitive: true,
                },
              },
            },
            {
              wildcard: {
                'message.keyword': {
                  value: '*invalid user*',
                  case_insensitive: true,
                },
              },
            },
          ],
          minimum_should_match: 1,
          must_not: [
            { regexp: { 'source.ip': '10\\..*' } },
            { regexp: { 'source.ip': '192\\.168\\..*' } },
            { regexp: { 'source.ip': '172\\.(1[6-9]|2[0-9]|3[0-1])\\..*' } },
            { regexp: { 'source.ip': '127\\..*' } },
          ],
        },
      },
      aggs: {
        attackers: {
          terms: {
            field: 'source.ip',
            size: 100,
            order: { _count: 'desc' },
          },
          aggs: {
            latest: {
              top_hits: {
                size: 1,
                sort: [{ '@timestamp': { order: 'desc' } }],
                _source: {
                  includes: [
                    '@timestamp',
                    'source.ip',
                    'source.geo.location',
                    'source.geo.country_name',
                    'source.geo.city_name',
                    'host.name',
                    'destination.ip',
                    'event.code',
                    'event.outcome',
                    'message',
                  ],
                },
              },
            },
          },
        },
        countries: {
          terms: {
            field: 'source.geo.country_name.keyword',
            size: 10,
          },
        },
      },
    }

    try {
      const result = await this.elastic.search('logs-*', body).catch(() => null)
      const attackerBuckets = result?.aggregations?.attackers?.buckets || []
      const countryBuckets = result?.aggregations?.countries?.buckets || []

      const points = attackerBuckets
        .map((bucket: any) => {
          const hit = bucket?.latest?.hits?.hits?.[0]?._source || {}
          const geo = hit?.source?.geo?.location
          const ip = hit?.source?.ip

          if (!geo || !ip) return null

          const lat = typeof geo?.lat === 'number' ? geo.lat : null
          const lon = typeof geo?.lon === 'number' ? geo.lon : null
          if (lat == null || lon == null) return null

          return {
            ip,
            count: bucket.doc_count || 0,
            country: hit?.source?.geo?.country_name || 'Unknown',
            city: hit?.source?.geo?.city_name || '',
            location: { lat, lon },
            lastSeen: hit?.['@timestamp'] || null,
            targetHost: hit?.host?.name || 'unknown-host',
            severity:
              bucket.doc_count >= 100 ? 'critical' :
              bucket.doc_count >= 40 ? 'high' :
              bucket.doc_count >= 10 ? 'medium' : 'low',
            eventCode: hit?.event?.code ?? null,
            outcome: hit?.event?.outcome ?? null,
            message: hit?.message ?? '',
          }
        })
        .filter(Boolean)

      const summary = {
        totalEvents: attackerBuckets.reduce((acc: number, b: any) => acc + (b.doc_count || 0), 0),
        uniqueSourceIps: points.length,
        topCountry: countryBuckets[0]?.key || 'Unknown',
      }

      return { summary, points }
    } catch (e) {
      return {
        summary: { totalEvents: 0, uniqueSourceIps: 0, topCountry: 'Unknown' },
        points: [],
      }
    }
  }
}