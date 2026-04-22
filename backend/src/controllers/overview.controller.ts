import { Controller, Get, Logger, Query, Req, UseGuards } from '@nestjs/common'
import { AuthGuard } from '../guards/auth.guard'
import { ElasticsearchService } from '../services/elasticsearch.service'
import { AssetsService } from '../services/assets.service'

@Controller('overview')
@UseGuards(AuthGuard)
export class OverviewController {
  private readonly logger = new Logger(OverviewController.name)

  constructor(
    private readonly elastic: ElasticsearchService,
    private readonly assets: AssetsService,
  ) {}

  private pick(obj: any, path: string) {
    return path.split('.').reduce((acc: any, key: string) => (acc == null ? undefined : acc[key]), obj)
  }

  private normalizeIp(raw: any): string | null {
    if (raw == null) return null
    const ip = String(raw).trim()
    if (!ip || ip === '-' || ip.toLowerCase() === 'localhost') return null
    return ip
  }

  private isPrivateOrLocalIp(ip: string): boolean {
    if (/^10\./.test(ip)) return true
    if (/^192\.168\./.test(ip)) return true
    if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip)) return true
    if (/^127\./.test(ip)) return true
    if (/^169\.254\./.test(ip)) return true
    if (ip === '::1') return true
    if (/^fe80:/i.test(ip)) return true
    if (/^fc/i.test(ip) || /^fd/i.test(ip)) return true
    return false
  }

  private parseGeo(location: any): { lat: number; lon: number } | null {
    if (!location) return null

    if (typeof location?.lat === 'number' && typeof location?.lon === 'number') {
      return { lat: location.lat, lon: location.lon }
    }

    if (Array.isArray(location) && location.length === 2) {
      const [lon, lat] = location
      if (typeof lat === 'number' && typeof lon === 'number') return { lat, lon }
    }

    if (typeof location === 'string') {
      const parts = location.split(',').map((v) => Number(v.trim()))
      if (parts.length === 2 && parts.every((v) => Number.isFinite(v))) {
        const [lat, lon] = parts
        return { lat, lon }
      }
    }

    return null
  }

  private parseOptionalNumber(raw: any, fallback: number): number {
    const num = Number(raw)
    return Number.isFinite(num) ? num : fallback
  }

  private getAttackMapDestination() {
    return {
      label: process.env.ATTACK_MAP_DEST_LABEL || 'Protected infrastructure',
      location: {
        lat: this.parseOptionalNumber(process.env.ATTACK_MAP_DEST_LAT, 23.6345),
        lon: this.parseOptionalNumber(process.env.ATTACK_MAP_DEST_LON, -102.5528),
      },
    }
  }

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
      size: 1000,
      track_total_hits: true,
      sort: [{ '@timestamp': { order: 'desc' } }],
      query: {
        bool: {
          filter: [
            { range: { '@timestamp': { gte: `now-${hours}h`, lte: 'now' } } },
          ],
          should: [
            { term: { 'event.code': '4625' } },
            { term: { 'event.code': 4625 } },
            {
              bool: {
                filter: [
                  { term: { 'event.category': 'authentication' } },
                  { term: { 'event.outcome': 'failure' } },
                ],
              },
            },
            {
              bool: {
                filter: [
                  { term: { 'winlog.channel': 'Security' } },
                  { term: { 'event.outcome': 'failure' } },
                ],
              },
            },
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
        },
      },
      _source: [
        '@timestamp',
        'source.ip',
        'source.geo.location',
        'source.geo.country_name',
        'source.geo.city_name',
        'host.name',
        'destination.ip',
        'event.code',
        'event.outcome',
        'event.category',
        'message',
        'winlog.channel',
        'winlog.event_data.IpAddress',
        'winlog.event_data.TargetUserName',
      ],
    }

    try {
      const result = await this.elastic.search('logs-*', body)
      const hits = result?.hits?.hits || []
      const totalMatched = typeof result?.hits?.total === 'object'
        ? result.hits.total.value || 0
        : Array.isArray(hits) ? hits.length : 0

      const grouped = new Map<string, any>()
      const countryCounts = new Map<string, number>()
      let totalGeolocatedEvents = 0
      let eventsWithIp = 0
      let eventsUsingWinlogIp = 0
      let eventsWithGeo = 0

      for (const hit of hits) {
        const src = hit?._source || {}
        const ip = this.normalizeIp(this.pick(src, 'source.ip') || this.pick(src, 'winlog.event_data.IpAddress'))
        if (!ip) continue

        eventsWithIp++
        if (this.pick(src, 'winlog.event_data.IpAddress') && !this.pick(src, 'source.ip')) {
          eventsUsingWinlogIp++
        }

        if (this.isPrivateOrLocalIp(ip)) continue

        const geo = this.parseGeo(this.pick(src, 'source.geo.location'))
        if (!geo) continue

        eventsWithGeo++
        totalGeolocatedEvents++

        const country = this.pick(src, 'source.geo.country_name') || 'Unknown'
        countryCounts.set(country, (countryCounts.get(country) || 0) + 1)

        const existing = grouped.get(ip)
        if (!existing) {
          grouped.set(ip, {
            ip,
            count: 1,
            country,
            city: this.pick(src, 'source.geo.city_name') || '',
            location: geo,
            lastSeen: src['@timestamp'] || null,
            targetHost: this.pick(src, 'host.name') || 'unknown-host',
            severity: 'low',
            eventCode: this.pick(src, 'event.code') ?? null,
            outcome: this.pick(src, 'event.outcome') ?? null,
            message: src.message ?? '',
          })
          continue
        }

        existing.count += 1
      }

      const points = Array.from(grouped.values())
        .map((point: any) => ({
          ...point,
          severity:
            point.count >= 100 ? 'critical' :
            point.count >= 40 ? 'high' :
            point.count >= 10 ? 'medium' : 'low',
        }))
        .sort((a: any, b: any) => b.count - a.count)
        .slice(0, 100)

      const topCountry = Array.from(countryCounts.entries())
        .sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unknown'

      if (totalMatched > 0 && totalGeolocatedEvents === 0) {
        this.logger.warn(
          `attack-map matched ${totalMatched} events, ${eventsWithIp} had IP, ${eventsWithGeo} had source.geo.location. GeoIP enrichment is likely missing for these events.`,
        )
      }

      return {
        summary: {
          totalEvents: totalGeolocatedEvents,
          uniqueSourceIps: points.length,
          topCountry,
        },
        destination: this.getAttackMapDestination(),
        diagnostics: {
          matchedEvents: totalMatched,
          eventsWithIp,
          eventsUsingWinlogIp,
          eventsWithGeo,
          returnedPoints: points.length,
        },
        points,
      }
    } catch (e: any) {
      this.logger.error(`attack-map query failed: ${e?.message || e}`)
      return {
        summary: { totalEvents: 0, uniqueSourceIps: 0, topCountry: 'Unknown' },
        destination: this.getAttackMapDestination(),
        diagnostics: { matchedEvents: 0, eventsWithIp: 0, eventsUsingWinlogIp: 0, eventsWithGeo: 0, returnedPoints: 0 },
        points: [],
      }
    }
  }
}
