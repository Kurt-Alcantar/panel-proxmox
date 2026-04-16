import { Injectable } from '@nestjs/common'
import { ElasticsearchService } from './elasticsearch.service'
import { IdentityResolverService } from './identity-resolver.service'
import { AssetIdentity } from '../shared/types/asset-identity'

// Event codes del canal "Veeam Backup" (provider: Veeam MP)
// 410  = Job started
// 450  = Task in progress (VM individual)
// 490  = Job finished Success
// 190  = Job finished Warning
// 40700 = Job/Config finished Failed
// 890  = Rescan job finished
// 810  = Tape/other job finished
// 150  = Job session started
// 110  = Job session info

const VEEAM_JOB_CODES = {
  started:  ['410', '150'],
  success:  ['490', '890'],
  warning:  ['190'],
  failed:   ['40700', '40100', '40101'],
  progress: ['450'],
}

const ALL_JOB_CODES = [
  ...VEEAM_JOB_CODES.started,
  ...VEEAM_JOB_CODES.success,
  ...VEEAM_JOB_CODES.warning,
  ...VEEAM_JOB_CODES.failed,
]

// Extrae el nombre del job desde el mensaje:
// "Backup Copy job 'NOMBRE' finished with Success." → "NOMBRE"
function extractJobName(message: string): string | null {
  const match = message?.match(/'([^']+)'/)
  return match ? match[1] : null
}

// Clasifica el resultado del job por event code y log.level
function classifyResult(code: string, level: string, message: string): 'success' | 'warning' | 'failed' | 'started' | 'progress' | 'unknown' {
  if (VEEAM_JOB_CODES.failed.includes(code))   return 'failed'
  if (VEEAM_JOB_CODES.warning.includes(code))  return 'warning'
  if (VEEAM_JOB_CODES.success.includes(code))  return 'success'
  if (VEEAM_JOB_CODES.started.includes(code))  return 'started'
  if (VEEAM_JOB_CODES.progress.includes(code)) return 'progress'
  // fallback por log.level
  const l = String(level || '').toLowerCase()
  if (l === 'error')      return 'failed'
  if (l === 'advertencia' || l === 'warning') return 'warning'
  if (l === 'informaci\u00f3n' || l === 'information') return 'success'
  return 'unknown'
}

@Injectable()
export class VeeamJobsService {
  constructor(
    private readonly elastic: ElasticsearchService,
    private readonly identity: IdentityResolverService,
  ) {}

  private async safeSearch(index: string, body: any) {
    try {
      return await this.elastic.search(index, body)
    } catch (error: any) {
      const msg = error?.response?.data || error?.message || 'Elasticsearch error'
      throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg))
    }
  }

  private range(hours = 24) {
    return { range: { '@timestamp': { gte: `now-${hours}h`, lte: 'now' } } }
  }

  private rangeCustom(from: string, to: string) {
    return { range: { '@timestamp': { gte: from, lte: to } } }
  }

  private veeamFilter(id: AssetIdentity) {
    return {
      bool: {
        must: [
          this.identity.buildElasticFilter(id),
          { term: { 'winlog.channel': 'Veeam Backup' } },
          { terms: { 'event.code': ALL_JOB_CODES } },
        ],
      },
    }
  }

  // ─── Overview de jobs ─────────────────────────────────────────────
  async getJobsOverview(id: AssetIdentity, hours = 24) {
    // KPIs
    const kpiBody = {
      size: 0,
      query: {
        bool: {
          must: [
            this.identity.buildElasticFilter(id),
            { term: { 'winlog.channel': 'Veeam Backup' } },
            this.range(hours),
          ],
        },
      },
      aggs: {
        by_result: {
          filters: {
            filters: {
              success: { terms: { 'event.code': VEEAM_JOB_CODES.success } },
              warning: { terms: { 'event.code': VEEAM_JOB_CODES.warning } },
              failed:  { terms: { 'event.code': VEEAM_JOB_CODES.failed  } },
              started: { terms: { 'event.code': VEEAM_JOB_CODES.started } },
            },
          },
        },
        // Jobs únicos por nombre
        job_names: {
          terms: { field: 'message.keyword', size: 50 },
        },
      },
    }

    // Jobs recientes
    const jobsBody = {
      size: 50,
      sort: [{ '@timestamp': { order: 'desc' } }],
      query: {
        bool: {
          must: [
            this.identity.buildElasticFilter(id),
            { term: { 'winlog.channel': 'Veeam Backup' } },
            { terms: { 'event.code': ALL_JOB_CODES } },
            this.range(hours),
          ],
        },
      },
      _source: ['@timestamp', 'message', 'event.code', 'log.level', 'winlog.channel'],
    }

    // Tendencia por hora (últimas 24h)
    const trendBody = {
      size: 0,
      query: {
        bool: {
          must: [
            this.identity.buildElasticFilter(id),
            { term: { 'winlog.channel': 'Veeam Backup' } },
            { terms: { 'event.code': [...VEEAM_JOB_CODES.success, ...VEEAM_JOB_CODES.warning, ...VEEAM_JOB_CODES.failed] } },
            this.range(hours),
          ],
        },
      },
      aggs: {
        over_time: {
          date_histogram: {
            field: '@timestamp',
            fixed_interval: hours <= 24 ? '1h' : '6h',
            min_doc_count: 0,
            extended_bounds: {
              min: `now-${hours}h`,
              max: 'now',
            },
          },
          aggs: {
            success: { filter: { terms: { 'event.code': VEEAM_JOB_CODES.success } } },
            warning: { filter: { terms: { 'event.code': VEEAM_JOB_CODES.warning } } },
            failed:  { filter: { terms: { 'event.code': VEEAM_JOB_CODES.failed  } } },
          },
        },
      },
    }

    const [kpiRes, jobsRes, trendRes] = await Promise.all([
      this.safeSearch('logs-winlog.winlog-*', kpiBody),
      this.safeSearch('logs-winlog.winlog-*', jobsBody),
      this.safeSearch('logs-winlog.winlog-*', trendBody),
    ])

    const buckets = kpiRes?.aggregations?.by_result?.buckets || {}
    const kpis = {
      success: buckets.success?.doc_count || 0,
      warning: buckets.warning?.doc_count || 0,
      failed:  buckets.failed?.doc_count  || 0,
      running: buckets.started?.doc_count || 0,
      total: (buckets.success?.doc_count || 0) + (buckets.warning?.doc_count || 0) + (buckets.failed?.doc_count || 0),
    }

    // Procesar jobs individuales
    const rawJobs = (jobsRes?.hits?.hits || []).map((hit: any) => {
      const src = hit._source || {}
      const code = src?.event?.code || ''
      const level = src?.log?.level || ''
      const msg = src?.message || ''
      const result = classifyResult(code, level, msg)
      const jobName = extractJobName(msg)
      return {
        timestamp: src['@timestamp'],
        eventCode: code,
        result,
        jobName,
        message: msg,
        level,
      }
    })

    // Agrupar por nombre de job — último estado de cada job
    const jobMap = new Map<string, any>()
    for (const job of rawJobs) {
      if (!job.jobName) continue
      if (!jobMap.has(job.jobName)) {
        jobMap.set(job.jobName, job)
      }
    }
    const jobsSummary = Array.from(jobMap.values()).sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )

    // Tendencia
    const trend = (trendRes?.aggregations?.over_time?.buckets || []).map((b: any) => ({
      timestamp: b.key_as_string,
      success: b.success?.doc_count || 0,
      warning: b.warning?.doc_count || 0,
      failed:  b.failed?.doc_count  || 0,
    }))

    // Último job fallido
    const lastFailed = rawJobs.find(j => j.result === 'failed') || null
    const lastSuccess = rawJobs.find(j => j.result === 'success') || null

    return {
      kpis,
      jobsSummary,
      recentEvents: rawJobs.slice(0, 30),
      trend,
      lastFailed,
      lastSuccess,
      hoursRange: hours,
    }
  }

  // ─── Historial de un job específico ─────────────────────────────
  async getJobHistory(id: AssetIdentity, jobName: string, days = 7) {
    const body = {
      size: 100,
      sort: [{ '@timestamp': { order: 'desc' } }],
      query: {
        bool: {
          must: [
            this.identity.buildElasticFilter(id),
            { term: { 'winlog.channel': 'Veeam Backup' } },
            { terms: { 'event.code': ALL_JOB_CODES } },
            this.range(days * 24),
            { match_phrase: { message: jobName } },
          ],
        },
      },
      _source: ['@timestamp', 'message', 'event.code', 'log.level'],
    }

    const res = await this.safeSearch('logs-winlog.winlog-*', body)
    return (res?.hits?.hits || []).map((hit: any) => {
      const src = hit._source || {}
      const code = src?.event?.code || ''
      const level = src?.log?.level || ''
      const msg = src?.message || ''
      return {
        timestamp: src['@timestamp'],
        eventCode: code,
        result: classifyResult(code, level, msg),
        message: msg,
      }
    })
  }

  // ─── Lista de todos los jobs conocidos ───────────────────────────
  async listJobs(id: AssetIdentity, days = 7) {
    const body = {
      size: 200,
      sort: [{ '@timestamp': { order: 'desc' } }],
      query: {
        bool: {
          must: [
            this.identity.buildElasticFilter(id),
            { term: { 'winlog.channel': 'Veeam Backup' } },
            { terms: { 'event.code': [...VEEAM_JOB_CODES.success, ...VEEAM_JOB_CODES.warning, ...VEEAM_JOB_CODES.failed] } },
            this.range(days * 24),
          ],
        },
      },
      _source: ['@timestamp', 'message', 'event.code', 'log.level'],
    }

    const res = await this.safeSearch('logs-winlog.winlog-*', body)
    const jobMap = new Map<string, any>()

    for (const hit of (res?.hits?.hits || [])) {
      const src = hit._source || {}
      const code = src?.event?.code || ''
      const level = src?.log?.level || ''
      const msg = src?.message || ''
      const jobName = extractJobName(msg)
      if (!jobName) continue

      const result = classifyResult(code, level, msg)

      if (!jobMap.has(jobName)) {
        jobMap.set(jobName, {
          name: jobName,
          lastRun: src['@timestamp'],
          lastResult: result,
          totalRuns: 0,
          success: 0,
          warning: 0,
          failed: 0,
        })
      }

      const entry = jobMap.get(jobName)
      entry.totalRuns++
      if (result === 'success') entry.success++
      else if (result === 'warning') entry.warning++
      else if (result === 'failed') entry.failed++
    }

    return Array.from(jobMap.values()).sort((a, b) =>
      new Date(b.lastRun).getTime() - new Date(a.lastRun).getTime()
    )
  }
}
