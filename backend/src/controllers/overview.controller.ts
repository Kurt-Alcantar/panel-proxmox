import { Controller, Get, Logger, Query, Req, Res, UseGuards } from '@nestjs/common'
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

  private buildAttackQuery(fromIso: string, toIso: string, size = 1000) {
    return {
      size,
      track_total_hits: true,
      sort: [
        { '@timestamp': { order: 'asc' } },
        { _id: { order: 'asc' } },
      ],
      query: {
        bool: {
          filter: [
            { range: { '@timestamp': { gt: fromIso, lte: toIso } } },
            { exists: { field: 'source.ip' } },
            { exists: { field: 'source.geo.location' } },
          ],
          should: [
            { term: { 'event.code': '4625' } },
            { term: { 'event.code': 4625 } },

            { term: { 'event.code': '5152' } },
            { term: { 'event.code': 5152 } },

            { term: { 'event.code': '5157' } },
            { term: { 'event.code': 5157 } },

            { term: { 'event.code': '5156' } },
            { term: { 'event.code': 5156 } },

            {
              bool: {
                filter: [
                  { term: { 'event.category': 'authentication' } },
                  { term: { 'event.outcome': 'failure' } },
                ],
              },
            },
            {
              wildcard: {
                'message.keyword': {
                  value: '*blocked a packet*',
                  case_insensitive: true,
                },
              },
            },
            {
              wildcard: {
                'message.keyword': {
                  value: '*permitted a connection*',
                  case_insensitive: true,
                },
              },
            }
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
  }
  private mapAttackEvent(hit: any) {
    const src = hit?._source || {}
    const ip = this.normalizeIp(this.pick(src, 'source.ip') || this.pick(src, 'winlog.event_data.IpAddress'))
    if (!ip || this.isPrivateOrLocalIp(ip)) return null

    const geo = this.parseGeo(this.pick(src, 'source.geo.location'))
    if (!geo) return null

    const eventCode = this.pick(src, 'event.code') ?? null
    const message = String(src.message || '')
    const severity =
      eventCode === 5157 || eventCode === '5157' ? 'high' :
      eventCode === 5152 || eventCode === '5152' ? 'medium' :
      eventCode === 4625 || eventCode === '4625' ? 'medium' :
      eventCode === 5156 || eventCode === '5156' ? 'low' :
      /blocked a packet/i.test(message) ? 'medium' :
      /permitted a connection/i.test(message) ? 'low' :
      /invalid user|authentication failure/i.test(message) ? 'high' :
      'low'

    const ts = src['@timestamp'] || new Date().toISOString()
    const eventId = `${ts}:${hit?._id || ip}`

    return {
      eventId,
      ip,
      country: this.pick(src, 'source.geo.country_name') || 'Unknown',
      city: this.pick(src, 'source.geo.city_name') || '',
      location: geo,
      timestamp: ts,
      lastSeen: ts,
      targetHost: this.pick(src, 'host.name') || 'unknown-host',
      severity,
      eventCode,
      outcome: this.pick(src, 'event.outcome') ?? null,
      message,
      username: this.pick(src, 'winlog.event_data.TargetUserName') || '',
      destinationIp: this.pick(src, 'destination.ip') || '',
      count: 1,
    }
  }

  private async queryAttackEvents(fromIso: string, toIso: string, size = 1000) {
    const result = await this.elastic.search('logs-*', this.buildAttackQuery(fromIso, toIso, size))
    const hits = result?.hits?.hits || []
    const totalMatched = typeof result?.hits?.total === 'object'
      ? result.hits.total.value || 0
      : Array.isArray(hits) ? hits.length : 0

    const events: any[] = []
    let eventsWithIp = 0
    let eventsUsingWinlogIp = 0
    let eventsWithGeo = 0

    for (const hit of hits) {
      const src = hit?._source || {}
      const rawIp = this.normalizeIp(this.pick(src, 'source.ip') || this.pick(src, 'winlog.event_data.IpAddress'))
      if (!rawIp) continue
      eventsWithIp++
      if (this.pick(src, 'winlog.event_data.IpAddress') && !this.pick(src, 'source.ip')) {
        eventsUsingWinlogIp++
      }

      const mapped = this.mapAttackEvent(hit)
      if (!mapped) continue
      eventsWithGeo++
      events.push(mapped)
    }

    return {
      totalMatched,
      eventsWithIp,
      eventsUsingWinlogIp,
      eventsWithGeo,
      events,
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
              { terms: { 'data_stream.dataset': ['system.cpu', 'system.memory', 'system.network', 'system.filesystem'] } } ,
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
    const toIso = new Date().toISOString()
    const fromIso = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()

    try {
      const queried = await this.queryAttackEvents(fromIso, toIso, 2000)
      const grouped = new Map<string, any>()
      const countryCounts = new Map<string, number>()

      for (const event of queried.events) {
        countryCounts.set(event.country, (countryCounts.get(event.country) || 0) + 1)
        const existing = grouped.get(event.ip)
        if (!existing) {
          grouped.set(event.ip, { ...event })
          continue
        }
        existing.count += 1
        if (new Date(event.timestamp).getTime() > new Date(existing.lastSeen).getTime()) {
          existing.lastSeen = event.timestamp
          existing.targetHost = event.targetHost
          existing.severity = event.severity
          existing.eventCode = event.eventCode
          existing.outcome = event.outcome
          existing.message = event.message
          existing.username = event.username
        }
      }

      const points = Array.from(grouped.values())
        .map((point: any) => ({
          ...point,
          severity:
            point.count >= 100 ? 'critical' :
            point.count >= 40 ? 'high' :
            point.count >= 10 ? 'medium' : point.severity || 'low',
        }))
        .sort((a: any, b: any) => b.count - a.count)
        .slice(0, 100)

      const topCountry = Array.from(countryCounts.entries())
        .sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unknown'

      if (queried.totalMatched > 0 && queried.events.length === 0) {
        this.logger.warn(
          `attack-map matched ${queried.totalMatched} events, ${queried.eventsWithIp} had IP, ${queried.eventsWithGeo} had source.geo.location. GeoIP enrichment is likely missing for these events.`,
        )
      }

      return {
        summary: {
          totalEvents: queried.events.length,
          uniqueSourceIps: points.length,
          topCountry,
        },
        destination: this.getAttackMapDestination(),
        diagnostics: {
          matchedEvents: queried.totalMatched,
          eventsWithIp: queried.eventsWithIp,
          eventsUsingWinlogIp: queried.eventsUsingWinlogIp,
          eventsWithGeo: queried.eventsWithGeo,
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

  @Get('attack-map/live')
  async streamAttackMapLive(
    @Query('windowSec') windowSecRaw = '90',
    @Query('pollMs') pollMsRaw = '3000',
    @Req() req: any,
    @Res() res: any,
  ) {
    const windowSec = Math.max(30, Math.min(300, this.parseOptionalNumber(windowSecRaw, 90)))
    const pollMs = Math.max(1500, Math.min(10000, this.parseOptionalNumber(pollMsRaw, 3000)))
    let cursorIso = new Date(Date.now() - windowSec * 1000).toISOString()
    let closed = false

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
    res.flushHeaders?.()

    const send = (event: string, payload: any) => {
      if (closed) return
      res.write(`event: ${event}\n`)
      res.write(`data: ${JSON.stringify(payload)}\n\n`)
    }

    const poll = async () => {
      const toIso = new Date().toISOString()
      try {
        const queried = await this.queryAttackEvents(cursorIso, toIso, 500)
        const events = queried.events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        if (events.length > 0) {
          cursorIso = events[events.length - 1].timestamp
        } else {
          cursorIso = toIso
        }

        const countryCounts = new Map<string, number>()
        const hostCounts = new Map<string, number>()
        for (const event of events) {
          countryCounts.set(event.country, (countryCounts.get(event.country) || 0) + 1)
          hostCounts.set(event.targetHost, (hostCounts.get(event.targetHost) || 0) + 1)
        }

        const topCountry = Array.from(countryCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unknown'
        const topTargetHost = Array.from(hostCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown-host'

        send('snapshot', {
          cursor: cursorIso,
          emittedAt: toIso,
          pollMs,
          liveWindowSec: windowSec,
          destination: this.getAttackMapDestination(),
          summary: {
            newEvents: events.length,
            matchedEvents: queried.totalMatched,
            geolocatedEvents: queried.events.length,
            topCountry,
            topTargetHost,
          },
          diagnostics: {
            matchedEvents: queried.totalMatched,
            eventsWithIp: queried.eventsWithIp,
            eventsUsingWinlogIp: queried.eventsUsingWinlogIp,
            eventsWithGeo: queried.eventsWithGeo,
          },
          events,
        })
      } catch (e: any) {
        this.logger.error(`attack-map/live stream poll failed: ${e?.message || e}`)
        send('error', { message: e?.message || 'attack-map/live stream failed', emittedAt: toIso })
      }
    }

    send('ready', {
      emittedAt: new Date().toISOString(),
      pollMs,
      liveWindowSec: windowSec,
      destination: this.getAttackMapDestination(),
    })

    await poll()
    const interval = setInterval(poll, pollMs)
    const heartbeat = setInterval(() => send('heartbeat', { emittedAt: new Date().toISOString() }), 15000)

    const close = () => {
      if (closed) return
      closed = true
      clearInterval(interval)
      clearInterval(heartbeat)
      try { res.end() } catch {}
    }

    req.on('close', close)
    req.on('aborted', close)
  }
}