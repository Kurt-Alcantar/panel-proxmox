import { Injectable } from '@nestjs/common'
import { ElasticsearchService } from './elasticsearch.service'
import { IdentityResolverService } from './identity-resolver.service'
import { AssetIdentity } from '../shared/types/asset-identity'

const VEEAM_INDEX = 'logs-winlog.winlog-*'

const EVENT_CODES = {
  started:  ['410', '150'],
  success:  ['490', '890'],
  warning:  ['190'],
  failed:   ['40700', '40100', '40101'],
  progress: ['450', '810', '250', '210'],
}

const ALL_RESULT_CODES = [
  ...EVENT_CODES.started,
  ...EVENT_CODES.success,
  ...EVENT_CODES.warning,
  ...EVENT_CODES.failed,
]

const ALL_CODES = [...ALL_RESULT_CODES, ...EVENT_CODES.progress]

type JobType = 'normal' | 'copy'

type ResultType = 'success' | 'warning' | 'failed' | 'started' | 'progress' | 'unknown'

function extractJobName(msg: string): string | null {
  const m = msg?.match(/'([^']+)'/)
  return m ? m[1] : null
}

function extractVmName(msg: string): string | null {
  const m = msg?.match(/^VM\s+(\S+)\s+task/i)
  return m ? m[1] : null
}

function parseJobDetail(msg: string): { summary: string; taskDetail: string | null; errorDetail: string | null } {
  if (!msg) return { summary: '', taskDetail: null, errorDetail: null }

  const lines = msg.split('\n').map((l) => l.trim()).filter(Boolean)
  const summary = lines[0] || ''
  let taskDetail: string | null = null
  let errorDetail: string | null = null

  for (const line of lines.slice(1)) {
    if (line.startsWith('Task details:')) {
      taskDetail = line.replace(/^Task details:\s*/i, '').trim()
    } else if (line.startsWith('Error:')) {
      errorDetail = line.replace(/^Error:\s*/i, '').trim()
    } else if (!taskDetail && line.length > 0) {
      taskDetail = line
    }
  }

  return { summary, taskDetail, errorDetail }
}

function classifyResult(code: string, level: string): ResultType {
  if (EVENT_CODES.failed.includes(code)) return 'failed'
  if (EVENT_CODES.warning.includes(code)) return 'warning'
  if (EVENT_CODES.success.includes(code)) return 'success'
  if (EVENT_CODES.started.includes(code)) return 'started'
  if (EVENT_CODES.progress.includes(code)) return 'progress'

  const l = String(level || '').toLowerCase()
  if (l === 'error') return 'failed'
  if (l.includes('advert') || l === 'warning') return 'warning'
  return 'unknown'
}

function classifyJobType(jobName: string | null, msg: string): JobType {
  const j = String(jobName || '').toLowerCase()
  const m = String(msg || '').toLowerCase()

  if (
    m.includes('backup copy job') ||
    m.includes('backup copy') ||
    m.includes('copy job') ||
    m.includes('offsite') ||
    m.includes('provider') ||
    m.includes('cloud connect')
  ) {
    return 'copy'
  }

  if (
    j.includes('backup copy') ||
    j.includes(' copy ') ||
    j.startsWith('copy-') ||
    j.endsWith('-copy') ||
    j.includes('bcj') ||
    j.includes('provider') ||
    j.includes('offsite') ||
    j.includes('cloud')
  ) {
    return 'copy'
  }

  return 'normal'
}

function buildTypeStats(rows: any[]) {
  return {
    totalJobs: rows.length,
    successJobs: rows.filter((r) => r.lastResult === 'success').length,
    warningJobs: rows.filter((r) => r.lastResult === 'warning').length,
    failedJobs: rows.filter((r) => r.lastResult === 'failed').length,
    runningJobs: rows.filter((r) => ['started', 'progress'].includes(r.lastResult)).length,
  }
}

@Injectable()
export class VeeamJobsService {
  constructor(
    private readonly elastic: ElasticsearchService,
    private readonly identity: IdentityResolverService,
  ) {}

  private async search(body: any) {
    try {
      return await this.elastic.search(VEEAM_INDEX, body)
    } catch (e: any) {
      const msg = e?.response?.data || e?.message || 'ES error'
      throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg))
    }
  }

  private range(hours: number) {
    return { range: { '@timestamp': { gte: `now-${hours}h`, lte: 'now' } } }
  }

  async getJobsOverview(id: AssetIdentity, hours = 24) {
    const [kpiRes, eventsRes, trendRes] = await Promise.all([
      this.search({
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
                success: { terms: { 'event.code': EVENT_CODES.success } },
                warning: { terms: { 'event.code': EVENT_CODES.warning } },
                failed:  { terms: { 'event.code': EVENT_CODES.failed  } },
                started: { terms: { 'event.code': EVENT_CODES.started } },
              },
            },
          },
        },
      }),
      this.search({
        size: 150,
        sort: [{ '@timestamp': { order: 'desc' } }],
        query: {
          bool: {
            must: [
              this.identity.buildElasticFilter(id),
              { term: { 'winlog.channel': 'Veeam Backup' } },
              { terms: { 'event.code': ALL_CODES } },
              this.range(hours),
            ],
          },
        },
        _source: ['@timestamp', 'message', 'event.code', 'log.level'],
      }),
      this.search({
        size: 0,
        query: {
          bool: {
            must: [
              this.identity.buildElasticFilter(id),
              { term: { 'winlog.channel': 'Veeam Backup' } },
              { terms: { 'event.code': [...EVENT_CODES.success, ...EVENT_CODES.warning, ...EVENT_CODES.failed] } },
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
              extended_bounds: { min: `now-${hours}h`, max: 'now' },
            },
            aggs: {
              success: { filter: { terms: { 'event.code': EVENT_CODES.success } } },
              warning: { filter: { terms: { 'event.code': EVENT_CODES.warning } } },
              failed:  { filter: { terms: { 'event.code': EVENT_CODES.failed } } },
            },
          },
        },
      }),
    ])

    const b = kpiRes?.aggregations?.by_result?.buckets || {}
    const kpis = {
      success: b.success?.doc_count || 0,
      warning: b.warning?.doc_count || 0,
      failed: b.failed?.doc_count || 0,
      running: b.started?.doc_count || 0,
      total: (b.success?.doc_count || 0) + (b.warning?.doc_count || 0) + (b.failed?.doc_count || 0),
    }

    const rawEvents = (eventsRes?.hits?.hits || []).map((h: any) => {
      const src = h._source || {}
      const code = src?.event?.code || ''
      const level = src?.log?.level || ''
      const msg = src?.message || ''
      const result = classifyResult(code, level)
      const { summary, taskDetail, errorDetail } = parseJobDetail(msg)
      const jobName = extractJobName(msg)
      const jobType = classifyJobType(jobName, msg)

      return {
        timestamp: src['@timestamp'],
        eventCode: code,
        result,
        jobName,
        jobType,
        vmName: extractVmName(msg),
        message: msg,
        summary,
        taskDetail,
        errorDetail,
        rootCause: errorDetail || taskDetail || null,
        level,
      }
    })

    const jobMap = new Map<string, any>()
    for (const e of rawEvents) {
      if (!e.jobName) continue
      if (!jobMap.has(e.jobName)) {
        jobMap.set(e.jobName, {
          name: e.jobName,
          type: e.jobType,
          lastTimestamp: e.timestamp,
          lastResult: e.result,
          lastMessage: e.summary,
          lastRootCause: null,
          lastTaskDetail: null,
          lastErrorDetail: null,
          eventCode: e.eventCode,
          vmErrors: [],
        })
      }
      const entry = jobMap.get(e.jobName)

      if (['failed', 'warning'].includes(e.result) && !entry.lastRootCause) {
        entry.lastRootCause = e.rootCause
        entry.lastTaskDetail = e.taskDetail
        entry.lastErrorDetail = e.errorDetail
      }

      if (e.result === 'progress' && e.vmName && e.rootCause) {
        const existing = entry.vmErrors.find((ve: any) => ve.vm === e.vmName)
        if (!existing) {
          entry.vmErrors.push({
            vm: e.vmName,
            taskDetail: e.taskDetail,
            errorDetail: e.errorDetail,
            rootCause: e.rootCause,
            timestamp: e.timestamp,
          })
        }
      }
    }

    const jobsSummary = Array.from(jobMap.values()).sort((a, b) =>
      new Date(b.lastTimestamp).getTime() - new Date(a.lastTimestamp).getTime(),
    )
    const normalJobs = jobsSummary.filter((j) => j.type === 'normal')
    const copyJobs = jobsSummary.filter((j) => j.type === 'copy')

    const trend = (trendRes?.aggregations?.over_time?.buckets || []).map((bucket: any) => ({
      timestamp: bucket.key_as_string,
      success: bucket.success?.doc_count || 0,
      warning: bucket.warning?.doc_count || 0,
      failed: bucket.failed?.doc_count || 0,
    }))

    const lastFailed = rawEvents.find((e) => e.result === 'failed') || null
    const lastSuccess = rawEvents.find((e) => e.result === 'success') || null
    const lastWarning = rawEvents.find((e) => e.result === 'warning') || null

    return {
      kpis,
      jobsSummary,
      normalJobs,
      copyJobs,
      normalStats: buildTypeStats(normalJobs),
      copyStats: buildTypeStats(copyJobs),
      recentEvents: rawEvents.slice(0, 30),
      trend,
      lastFailed,
      lastSuccess,
      lastWarning,
      hoursRange: hours,
    }
  }

  async getJobHistory(id: AssetIdentity, jobName: string, days = 7) {
    const body = {
      size: 100,
      sort: [{ '@timestamp': { order: 'desc' } }],
      query: {
        bool: {
          must: [
            this.identity.buildElasticFilter(id),
            { term: { 'winlog.channel': 'Veeam Backup' } },
            { terms: { 'event.code': ALL_CODES } },
            this.range(days * 24),
            { match_phrase: { message: jobName } },
          ],
        },
      },
      _source: ['@timestamp', 'message', 'event.code', 'log.level'],
    }

    const res = await this.search(body)
    return (res?.hits?.hits || []).map((h: any) => {
      const src = h._source || {}
      const code = src?.event?.code || ''
      const level = src?.log?.level || ''
      const msg = src?.message || ''
      const { summary, taskDetail, errorDetail } = parseJobDetail(msg)
      const extracted = extractJobName(msg)
      return {
        timestamp: src['@timestamp'],
        eventCode: code,
        result: classifyResult(code, level),
        message: msg,
        summary,
        taskDetail,
        errorDetail,
        rootCause: errorDetail || taskDetail || null,
        vmName: extractVmName(msg),
        jobType: classifyJobType(extracted, msg),
      }
    })
  }

  async listJobs(id: AssetIdentity, days = 7) {
    const body = {
      size: 200,
      sort: [{ '@timestamp': { order: 'desc' } }],
      query: {
        bool: {
          must: [
            this.identity.buildElasticFilter(id),
            { term: { 'winlog.channel': 'Veeam Backup' } },
            { terms: { 'event.code': [...EVENT_CODES.success, ...EVENT_CODES.warning, ...EVENT_CODES.failed] } },
            this.range(days * 24),
          ],
        },
      },
      _source: ['@timestamp', 'message', 'event.code', 'log.level'],
    }

    const res = await this.search(body)
    const jobMap = new Map<string, any>()

    for (const hit of res?.hits?.hits || []) {
      const src = hit._source || {}
      const code = src?.event?.code || ''
      const level = src?.log?.level || ''
      const msg = src?.message || ''
      const jobName = extractJobName(msg)
      if (!jobName) continue

      const result = classifyResult(code, level)
      const { taskDetail, errorDetail } = parseJobDetail(msg)
      const jobType = classifyJobType(jobName, msg)

      if (!jobMap.has(jobName)) {
        jobMap.set(jobName, {
          name: jobName,
          type: jobType,
          lastRun: src['@timestamp'],
          lastResult: result,
          lastRootCause: null,
          lastTaskDetail: null,
          lastErrorDetail: null,
          totalRuns: 0,
          success: 0,
          warning: 0,
          failed: 0,
        })
      }

      const entry = jobMap.get(jobName)
      entry.totalRuns += 1
      if (result === 'success') entry.success += 1
      else if (result === 'warning') entry.warning += 1
      else if (result === 'failed') entry.failed += 1

      if (['failed', 'warning'].includes(result) && !entry.lastRootCause) {
        entry.lastRootCause = errorDetail || taskDetail || null
        entry.lastTaskDetail = taskDetail
        entry.lastErrorDetail = errorDetail
      }
    }

    const rows = Array.from(jobMap.values()).sort((a, b) =>
      new Date(b.lastRun).getTime() - new Date(a.lastRun).getTime(),
    )

    return {
      all: rows,
      normal: rows.filter((r) => r.type === 'normal'),
      copy: rows.filter((r) => r.type === 'copy'),
    }
  }
}
