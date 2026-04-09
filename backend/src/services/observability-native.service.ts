import { Injectable } from '@nestjs/common'
import { ElasticsearchService } from './elasticsearch.service'

@Injectable()
export class ObservabilityNativeService {
  constructor(private readonly elastic: ElasticsearchService) {}

  private hostFilter(hostName: string) {
    const raw = String(hostName || '').trim()
    const lower = raw.toLowerCase()

    return {
      bool: {
        should: [
          { term: { 'host.hostname': raw } },
          { term: { 'host.name': raw } },
          { term: { 'host.name': lower } },
          {
            wildcard: {
              'host.hostname': {
                value: `*${raw}*`,
                case_insensitive: true
              }
            }
          },
          {
            wildcard: {
              'host.name': {
                value: `*${raw}*`,
                case_insensitive: true
              }
            }
          }
        ],
        minimum_should_match: 1
      }
    }
  }

  private range24h() {
    return { range: { '@timestamp': { gte: 'now-24h', lte: 'now' } } }
  }

  private rangeCustom(from: string, to: string) {
    return { range: { '@timestamp': { gte: from, lte: to } } }
  }

  private async safeSearch(index: string, body: any) {
    try {
      return await this.elastic.search(index, body)
    } catch (error: any) {
      const message = error?.response?.data || error?.message || 'Elasticsearch error'
      throw new Error(typeof message === 'string' ? message : JSON.stringify(message))
    }
  }

  private num(value: any, digits = 1) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return null
    return Number(Number(value).toFixed(digits))
  }

  private hitSource(hit: any) {
    return hit?._source || {}
  }

  private pick(source: any, path: string) {
    return path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : null), source)
  }

  private msgContainsAny(field: string, values: string[]) {
    return {
      bool: {
        should: values.map((value) => ({
          wildcard: {
            [field]: {
              value: `*${value}*`,
              case_insensitive: true
            }
          }
        })),
        minimum_should_match: 1
      }
    }
  }

  private termsCaseVariants(values: string[]) {
    const out = new Set<string>()
    for (const value of values) {
      out.add(value)
      out.add(value.toLowerCase())
      out.add(value.toUpperCase())
    }
    return Array.from(out)
  }

  async getOverview(hostName: string) {
    const body = {
      size: 0,
      query: {
        bool: {
          filter: [this.hostFilter(hostName), this.range24h()]
        }
      },
      aggs: {
        cpu_avg: { avg: { field: 'system.cpu.total.norm.pct' } },
        mem_avg: { avg: { field: 'system.memory.used.pct' } },
        disk_max: { max: { field: 'system.filesystem.used.pct' } }
      }
    }

    const metrics = await this.safeSearch('metrics-*', body)

    const errorBody = {
      size: 0,
      query: {
        bool: {
          filter: [this.hostFilter(hostName), this.range24h()],
          should: [{ terms: { 'log.level': ['error', 'critical', 'fatal'] } }],
          minimum_should_match: 1
        }
      }
    }

    const errors = await this.safeSearch('logs-*', errorBody)

    const latestBody = {
      size: 1,
      sort: [{ '@timestamp': { order: 'desc' } }],
      query: { bool: { filter: [this.hostFilter(hostName)] } },
      _source: ['@timestamp']
    }

    const latest = await this.safeSearch('metrics-*,logs-*', latestBody)
    const lastSeen = latest?.hits?.hits?.[0]?._source?.['@timestamp'] || null

    const recentErrorsBody = {
      size: 10,
      sort: [{ '@timestamp': { order: 'desc' } }],
      query: errorBody.query,
      _source: ['@timestamp', 'host.name', 'host.hostname', 'service.name', 'process.name', 'log.level', 'message', 'event.dataset', 'data_stream.dataset']
    }

    const recentErrors = await this.safeSearch('logs-*', recentErrorsBody)

    return {
      cpuAvgPct: this.num(metrics?.aggregations?.cpu_avg?.value ? metrics.aggregations.cpu_avg.value * 100 : null),
      memoryUsedPct: this.num(metrics?.aggregations?.mem_avg?.value ? metrics.aggregations.mem_avg.value * 100 : null),
      diskUsedPct: this.num(metrics?.aggregations?.disk_max?.value ? metrics.aggregations.disk_max.value * 100 : null),
      errorCount24h: errors?.hits?.total?.value || 0,
      lastSeen,
      recentErrors: (recentErrors?.hits?.hits || []).map((hit: any) => {
        const src = this.hitSource(hit)
        return {
          timestamp: src['@timestamp'],
          hostName: this.pick(src, 'host.hostname') || this.pick(src, 'host.name'),
          serviceName: this.pick(src, 'service.name'),
          processName: this.pick(src, 'process.name'),
          level: this.pick(src, 'log.level'),
          dataset: this.pick(src, 'event.dataset') || this.pick(src, 'data_stream.dataset'),
          message: src.message || '-'
        }
      })
    }
  }

  async getWindowsSecurity(hostName: string) {
    const summaryBody = {
      size: 0,
      query: {
        bool: {
          filter: [this.hostFilter(hostName), this.range24h(), { term: { 'winlog.channel': 'Security' } }]
        }
      },
      aggs: {
        by_event: {
          filters: {
            filters: {
              success_logons: {
                bool: {
                  filter: [
                    { term: { 'event.code': '4624' } },
                    { terms: { 'winlog.event_data.LogonType': ['2', '10'] } }
                  ]
                }
              },
              failed_logons: { term: { 'event.code': '4625' } },
              lockouts: { term: { 'event.code': '4740' } },
              privilege: { terms: { 'event.code': ['4672', '4673', '4674'] } },
              user_changes: { terms: { 'event.code': ['4720', '4722', '4723', '4724', '4725', '4726'] } },
              group_changes: { terms: { 'event.code': ['4728', '4729', '4732', '4733', '4756', '4757'] } },
              rdp: {
                bool: {
                  filter: [
                    { term: { 'event.code': '4624' } },
                    { term: { 'winlog.event_data.LogonType': '10' } }
                  ]
                }
              }
            }
          }
        },
        failed_by_user: { terms: { field: 'winlog.event_data.TargetUserName', size: 10 } },
        failed_by_ip: { terms: { field: 'source.ip', size: 10 } }
      }
    }

    const summary = await this.safeSearch('logs-*', summaryBody)
    const buckets = summary?.aggregations?.by_event?.buckets || {}

    const recentSuccessBody = {
      size: 5,
      sort: [{ '@timestamp': { order: 'desc' } }],
      query: {
        bool: {
          filter: [
            this.hostFilter(hostName),
            this.range24h(),
            { term: { 'winlog.channel': 'Security' } },
            { term: { 'event.code': '4624' } },
            { terms: { 'winlog.event_data.LogonType': ['2', '10'] } }
          ]
        }
      },
      _source: ['@timestamp', 'event.code', 'message', 'source.ip', 'winlog.event_data.TargetUserName', 'winlog.event_data.LogonType', 'winlog.event_data.IpAddress']
    }

    const recentFailedBody = {
      size: 5,
      sort: [{ '@timestamp': { order: 'desc' } }],
      query: {
        bool: {
          filter: [
            this.hostFilter(hostName),
            this.range24h(),
            { term: { 'winlog.channel': 'Security' } },
            { term: { 'event.code': '4625' } }
          ]
        }
      },
      _source: ['@timestamp', 'event.code', 'message', 'source.ip', 'winlog.event_data.TargetUserName', 'winlog.event_data.Status', 'winlog.event_data.SubStatus', 'winlog.event_data.IpAddress']
    }

    const privilegeBody = {
      size: 5,
      sort: [{ '@timestamp': { order: 'desc' } }],
      query: {
        bool: {
          filter: [
            this.hostFilter(hostName),
            this.range24h(),
            { term: { 'winlog.channel': 'Security' } },
            { terms: { 'event.code': ['4672', '4673', '4674'] } }
          ]
        }
      },
      _source: ['@timestamp', 'event.code', 'message', 'winlog.event_data.SubjectUserName', 'winlog.event_data.PrivilegeList']
    }

    const userChangesBody = {
      size: 5,
      sort: [{ '@timestamp': { order: 'desc' } }],
      query: {
        bool: {
          filter: [
            this.hostFilter(hostName),
            this.range24h(),
            { term: { 'winlog.channel': 'Security' } },
            { terms: { 'event.code': ['4720', '4722', '4723', '4724', '4725', '4726', '4728', '4729', '4732', '4733', '4756', '4757', '4740'] } }
          ]
        }
      },
      _source: ['@timestamp', 'event.code', 'message', 'winlog.event_data.TargetUserName', 'winlog.event_data.SubjectUserName', 'winlog.event_data.MemberName']
    }

    const remoteBody = {
      size: 5,
      sort: [{ '@timestamp': { order: 'desc' } }],
      query: {
        bool: {
          should: [
            {
              bool: {
                filter: [
                  this.hostFilter(hostName),
                  this.range24h(),
                  { term: { 'winlog.channel': 'Security' } },
                  { term: { 'event.code': '4624' } },
                  { term: { 'winlog.event_data.LogonType': '10' } }
                ]
              }
            },
            {
              bool: {
                filter: [this.hostFilter(hostName), this.range24h()],
                should: [
                  { wildcard: { message: { value: '*WinRM*', case_insensitive: true } } },
                  { wildcard: { message: { value: '*PSRemoting*', case_insensitive: true } } },
                  { term: { 'process.name': 'wsmprovhost.exe' } },
                  { terms: { 'process.name': ['powershell.exe', 'pwsh.exe'] } }
                ],
                minimum_should_match: 1
              }
            }
          ],
          minimum_should_match: 1
        }
      },
      _source: ['@timestamp', 'event.code', 'message', 'source.ip', 'process.name', 'winlog.event_data.TargetUserName', 'winlog.event_data.LogonType']
    }

    const [successRows, failedRows, privilegeRows, userChangeRows, remoteRows] = await Promise.all([
      this.safeSearch('logs-*', recentSuccessBody),
      this.safeSearch('logs-*', recentFailedBody),
      this.safeSearch('logs-*', privilegeBody),
      this.safeSearch('logs-*', userChangesBody),
      this.safeSearch('logs-*', remoteBody)
    ])

    const mapRows = (hits: any[], mapper: (src: any) => any) => (hits || []).map((hit) => mapper(this.hitSource(hit)))

    return {
      kpis: {
        successLogons24h: buckets.success_logons?.doc_count || 0,
        failedLogons24h: buckets.failed_logons?.doc_count || 0,
        lockouts24h: buckets.lockouts?.doc_count || 0,
        privilegeEvents24h: buckets.privilege?.doc_count || 0,
        userChanges24h: buckets.user_changes?.doc_count || 0,
        groupChanges24h: buckets.group_changes?.doc_count || 0,
        remoteAccess24h: buckets.rdp?.doc_count || 0
      },
      failuresByUser: (summary?.aggregations?.failed_by_user?.buckets || []).map((b: any) => ({ key: b.key, count: b.doc_count })),
      failuresByIp: (summary?.aggregations?.failed_by_ip?.buckets || []).map((b: any) => ({ key: b.key, count: b.doc_count })),
      recentSuccess: mapRows(successRows?.hits?.hits, (src) => ({
        timestamp: src['@timestamp'],
        user: this.pick(src, 'winlog.event_data.TargetUserName'),
        sourceIp: this.pick(src, 'source.ip') || this.pick(src, 'winlog.event_data.IpAddress'),
        logonType: this.pick(src, 'winlog.event_data.LogonType'),
        message: src.message || '-'
      })),
      recentFailed: mapRows(failedRows?.hits?.hits, (src) => ({
        timestamp: src['@timestamp'],
        user: this.pick(src, 'winlog.event_data.TargetUserName'),
        sourceIp: this.pick(src, 'source.ip') || this.pick(src, 'winlog.event_data.IpAddress'),
        status: this.pick(src, 'winlog.event_data.Status'),
        subStatus: this.pick(src, 'winlog.event_data.SubStatus'),
        message: src.message || '-'
      })),
      privilegeEvents: mapRows(privilegeRows?.hits?.hits, (src) => ({
        timestamp: src['@timestamp'],
        eventCode: this.pick(src, 'event.code'),
        user: this.pick(src, 'winlog.event_data.SubjectUserName'),
        privilegeList: this.pick(src, 'winlog.event_data.PrivilegeList'),
        message: src.message || '-'
      })),
      userChanges: mapRows(userChangeRows?.hits?.hits, (src) => ({
        timestamp: src['@timestamp'],
        eventCode: this.pick(src, 'event.code'),
        targetUser: this.pick(src, 'winlog.event_data.TargetUserName'),
        actorUser: this.pick(src, 'winlog.event_data.SubjectUserName'),
        memberName: this.pick(src, 'winlog.event_data.MemberName'),
        message: src.message || '-'
      })),
      remoteAccess: mapRows(remoteRows?.hits?.hits, (src) => ({
        timestamp: src['@timestamp'],
        eventCode: this.pick(src, 'event.code'),
        user: this.pick(src, 'winlog.event_data.TargetUserName'),
        sourceIp: this.pick(src, 'source.ip'),
        processName: this.pick(src, 'process.name'),
        logonType: this.pick(src, 'winlog.event_data.LogonType'),
        message: src.message || '-'
      }))
    }
  }

  async getWindowsSecurityExport(hostName: string, from: string, to: string) {
    const rangeFilter = this.rangeCustom(from, to)
    const baseFilter = [this.hostFilter(hostName), rangeFilter, { term: { 'winlog.channel': 'Security' } }]

    const summaryBody = {
      size: 0,
      query: { bool: { filter: baseFilter } },
      aggs: {
        by_event: {
          filters: {
            filters: {
              success_logons: { bool: { filter: [{ term: { 'event.code': '4624' } }, { terms: { 'winlog.event_data.LogonType': ['2', '10'] } }] } },
              failed_logons: { term: { 'event.code': '4625' } },
              lockouts: { term: { 'event.code': '4740' } },
              privilege: { terms: { 'event.code': ['4672', '4673', '4674'] } },
              user_changes: { terms: { 'event.code': ['4720', '4722', '4723', '4724', '4725', '4726'] } },
              group_changes: { terms: { 'event.code': ['4728', '4729', '4732', '4733', '4756', '4757'] } },
              rdp: { bool: { filter: [{ term: { 'event.code': '4624' } }, { term: { 'winlog.event_data.LogonType': '10' } }] } }
            }
          }
        },
        failed_by_user: { terms: { field: 'winlog.event_data.TargetUserName', size: 20 } },
        failed_by_ip: { terms: { field: 'source.ip', size: 20 } }
      }
    }

    const mkBody = (extraFilter: any[], size = 1000) => ({
      size,
      sort: [{ '@timestamp': { order: 'desc' } }],
      query: { bool: { filter: [...baseFilter, ...extraFilter] } },
      _source: ['@timestamp', 'event.code', 'message', 'source.ip', 'process.name',
        'winlog.event_data.TargetUserName', 'winlog.event_data.LogonType',
        'winlog.event_data.IpAddress', 'winlog.event_data.Status', 'winlog.event_data.SubStatus',
        'winlog.event_data.SubjectUserName', 'winlog.event_data.PrivilegeList',
        'winlog.event_data.MemberName']
    })

    const [summary, successRows, failedRows, privilegeRows, userChangeRows, remoteRows] = await Promise.all([
      this.safeSearch('logs-*', summaryBody),
      this.safeSearch('logs-*', mkBody([{ term: { 'event.code': '4624' } }, { terms: { 'winlog.event_data.LogonType': ['2', '10'] } }])),
      this.safeSearch('logs-*', mkBody([{ term: { 'event.code': '4625' } }])),
      this.safeSearch('logs-*', mkBody([{ terms: { 'event.code': ['4672', '4673', '4674'] } }])),
      this.safeSearch('logs-*', mkBody([{ terms: { 'event.code': ['4720', '4722', '4723', '4724', '4725', '4726', '4728', '4729', '4732', '4733', '4756', '4757', '4740'] } }])),
      this.safeSearch('logs-*', mkBody([{ term: { 'event.code': '4624' } }, { term: { 'winlog.event_data.LogonType': '10' } }]))
    ])

    const buckets = summary?.aggregations?.by_event?.buckets || {}
    const mapRows = (hits: any[], mapper: (src: any) => any) => (hits || []).map((hit) => mapper(this.hitSource(hit)))

    return {
      from,
      to,
      hostName,
      kpis: {
        successLogons: buckets.success_logons?.doc_count || 0,
        failedLogons: buckets.failed_logons?.doc_count || 0,
        lockouts: buckets.lockouts?.doc_count || 0,
        privilegeEvents: buckets.privilege?.doc_count || 0,
        userChanges: buckets.user_changes?.doc_count || 0,
        groupChanges: buckets.group_changes?.doc_count || 0,
        remoteAccess: buckets.rdp?.doc_count || 0
      },
      failuresByUser: (summary?.aggregations?.failed_by_user?.buckets || []).map((b: any) => ({ key: b.key, count: b.doc_count })),
      failuresByIp: (summary?.aggregations?.failed_by_ip?.buckets || []).map((b: any) => ({ key: b.key, count: b.doc_count })),
      recentSuccess: mapRows(successRows?.hits?.hits, (src) => ({
        timestamp: src['@timestamp'],
        user: this.pick(src, 'winlog.event_data.TargetUserName'),
        sourceIp: this.pick(src, 'source.ip') || this.pick(src, 'winlog.event_data.IpAddress'),
        logonType: this.pick(src, 'winlog.event_data.LogonType'),
        message: src.message || '-'
      })),
      recentFailed: mapRows(failedRows?.hits?.hits, (src) => ({
        timestamp: src['@timestamp'],
        user: this.pick(src, 'winlog.event_data.TargetUserName'),
        sourceIp: this.pick(src, 'source.ip') || this.pick(src, 'winlog.event_data.IpAddress'),
        status: this.pick(src, 'winlog.event_data.Status'),
        subStatus: this.pick(src, 'winlog.event_data.SubStatus'),
        message: src.message || '-'
      })),
      privilegeEvents: mapRows(privilegeRows?.hits?.hits, (src) => ({
        timestamp: src['@timestamp'],
        eventCode: this.pick(src, 'event.code'),
        user: this.pick(src, 'winlog.event_data.SubjectUserName'),
        privilegeList: this.pick(src, 'winlog.event_data.PrivilegeList'),
        message: src.message || '-'
      })),
      userChanges: mapRows(userChangeRows?.hits?.hits, (src) => ({
        timestamp: src['@timestamp'],
        eventCode: this.pick(src, 'event.code'),
        targetUser: this.pick(src, 'winlog.event_data.TargetUserName'),
        actorUser: this.pick(src, 'winlog.event_data.SubjectUserName'),
        memberName: this.pick(src, 'winlog.event_data.MemberName'),
        message: src.message || '-'
      })),
      remoteAccess: mapRows(remoteRows?.hits?.hits, (src) => ({
        timestamp: src['@timestamp'],
        eventCode: this.pick(src, 'event.code'),
        user: this.pick(src, 'winlog.event_data.TargetUserName'),
        sourceIp: this.pick(src, 'source.ip'),
        processName: this.pick(src, 'process.name'),
        logonType: this.pick(src, 'winlog.event_data.LogonType'),
        message: src.message || '-'
      }))
    }
  }

  async getWindowsServices(hostName: string, monitoredServices: string[]) {
    const body = {
      size: 200,
      sort: [{ '@timestamp': { order: 'desc' } }],
      query: {
        bool: {
          filter: [this.hostFilter(hostName), this.range24h()],
          should: [
            { exists: { field: 'windows.service.name' } },
            { exists: { field: 'windows.service.display_name' } }
          ],
          minimum_should_match: 1
        }
      },
      _source: ['@timestamp', 'windows.service.name', 'windows.service.display_name', 'windows.service.state', 'message']
    }

    const res = await this.safeSearch('metrics-*,logs-*', body)
    const configured = monitoredServices.map((item) => item.toLowerCase())
    const latestByName = new Map<string, any>()

    for (const hit of res?.hits?.hits || []) {
      const src = this.hitSource(hit)
      const rawName = this.pick(src, 'windows.service.display_name') || this.pick(src, 'windows.service.name')
      const state = this.pick(src, 'windows.service.state')
      if (!rawName) continue

      const serviceName = String(rawName)
      const normalized = serviceName.toLowerCase()
      const matches = !configured.length || configured.some((cfg) => normalized.includes(cfg))
      if (!matches) continue

      if (!latestByName.has(serviceName)) {
        latestByName.set(serviceName, {
          timestamp: src['@timestamp'],
          serviceName,
          state: state || 'unknown',
          message: src.message || '-'
        })
      }
    }

    const rows = Array.from(latestByName.values())
    return {
      rows,
      missingConfiguredServices: monitoredServices.filter((cfg) => !rows.some((row) => row.serviceName.toLowerCase().includes(cfg.toLowerCase())))
    }
  }

  async getWindowsEvents(hostName: string) {
    const body = {
      size: 100,
      sort: [{ '@timestamp': { order: 'desc' } }],
      query: {
        bool: {
          filter: [this.hostFilter(hostName), this.range24h()]
        }
      },
      _source: ['@timestamp', 'winlog.channel', 'event.code', 'event.action', 'log.level', 'message', 'process.name', 'service.name', 'source.ip']
    }

    const res = await this.safeSearch('logs-*', body)
    return (res?.hits?.hits || []).map((hit: any) => {
      const src = this.hitSource(hit)
      return {
        timestamp: src['@timestamp'],
        channel: this.pick(src, 'winlog.channel'),
        eventCode: this.pick(src, 'event.code'),
        action: this.pick(src, 'event.action'),
        level: this.pick(src, 'log.level'),
        processName: this.pick(src, 'process.name'),
        serviceName: this.pick(src, 'service.name'),
        sourceIp: this.pick(src, 'source.ip'),
        message: src.message || '-'
      }
    })
  }

  async getLinuxServices(hostName: string, monitoredServices: string[]) {
    const configured = monitoredServices.map((item) => item.toLowerCase())

    const body = {
      size: 300,
      sort: [{ '@timestamp': { order: 'desc' } }],
      query: {
        bool: {
          filter: [this.hostFilter(hostName), this.range24h()],
          should: [
            { exists: { field: 'system.service.name' } },
            { exists: { field: 'system.service.state' } },
            {
              bool: {
                should: [
                  this.msgContainsAny('message', ['failed', 'stopped', 'exited', 'inactive', 'dead']),
                  { terms: { 'process.name': configured.length ? configured : ['nginx', 'docker', 'dockerd', 'cloudflared', 'plesk'] } }
                ],
                minimum_should_match: 1
              }
            }
          ],
          minimum_should_match: 1
        }
      },
      _source: [
        '@timestamp',
        'system.service.name',
        'system.service.state',
        'process.name',
        'service.name',
        'data_stream.dataset',
        'event.dataset',
        'log.level',
        'message'
      ]
    }

    const res = await this.safeSearch('metrics-*,logs-*', body)
    const latestByName = new Map<string, any>()

    for (const hit of res?.hits?.hits || []) {
      const src = this.hitSource(hit)
      const rawName =
        this.pick(src, 'system.service.name') ||
        this.pick(src, 'service.name') ||
        this.pick(src, 'process.name')

      if (!rawName) continue

      const serviceName = String(rawName)
      const normalized = serviceName.toLowerCase()

      const matches =
        !configured.length ||
        configured.some((cfg) => normalized.includes(cfg))

      if (!matches) continue

      const state =
        this.pick(src, 'system.service.state') ||
        (String(src.message || '').match(/failed|inactive|dead|stopped|exited/i) ? 'problem' : 'unknown')

      if (!latestByName.has(serviceName)) {
        latestByName.set(serviceName, {
          timestamp: src['@timestamp'],
          serviceName,
          state,
          message: src.message || '-'
        })
      }
    }

    const rows = Array.from(latestByName.values())

    return {
      rows,
      missingConfiguredServices: monitoredServices.filter(
        (cfg) => !rows.some((row) => row.serviceName.toLowerCase().includes(cfg.toLowerCase()))
      )
    }
  }

  async getLinuxEvents(hostName: string) {
    const body = {
      size: 100,
      sort: [{ '@timestamp': { order: 'desc' } }],
      query: {
        bool: {
          filter: [this.hostFilter(hostName), this.range24h()]
        }
      },
      _source: [
        '@timestamp',
        'data_stream.dataset',
        'event.dataset',
        'event.action',
        'log.level',
        'message',
        'process.name',
        'service.name',
        'source.ip'
      ]
    }

    const res = await this.safeSearch('logs-*', body)
    return (res?.hits?.hits || []).map((hit: any) => {
      const src = this.hitSource(hit)
      return {
        timestamp: src['@timestamp'],
        channel: this.pick(src, 'data_stream.dataset') || this.pick(src, 'event.dataset'),
        eventCode: null,
        action: this.pick(src, 'event.action'),
        level: this.pick(src, 'log.level'),
        processName: this.pick(src, 'process.name'),
        serviceName: this.pick(src, 'service.name'),
        sourceIp: this.pick(src, 'source.ip'),
        message: src.message || '-'
      }
    })
  }

  async getLinuxSecurity(hostName: string) {
    const datasets = ['system.auth', 'system.syslog', 'auditd.log', 'auditd', 'system.security']
    const sshSuccessTerms = ['accepted password', 'accepted publickey', 'session opened']
    const sshFailedTerms = ['failed password', 'authentication failure', 'invalid user', 'failed keyboard-interactive']
    const sudoTerms = ['sudo:', 'pam_unix(sudo:', 'COMMAND=']
    const userChangeTerms = ['useradd', 'usermod', 'userdel', 'groupadd', 'groupdel', 'gpasswd', 'chage']
    const privilegeTerms = ['sudo', 'su:', 'pam_unix(su:', 'session opened for user root']
    const remoteTerms = ['sshd', 'ssh', 'sudo', 'su']

    const summaryBody = {
      size: 0,
      query: {
        bool: {
          filter: [this.hostFilter(hostName), this.range24h()],
          should: [
            { terms: { 'data_stream.dataset': datasets } },
            { terms: { 'event.dataset': datasets } }
          ],
          minimum_should_match: 1
        }
      },
      aggs: {
        by_event: {
          filters: {
            filters: {
              success_logons: {
                bool: {
                  should: [
                    this.msgContainsAny('message', sshSuccessTerms),
                    {
                      bool: {
                        filter: [
                          { terms: { 'event.action': this.termsCaseVariants(['ssh_login', 'user_login', 'session_opened']) } }
                        ]
                      }
                    }
                  ],
                  minimum_should_match: 1
                }
              },
              failed_logons: {
                bool: {
                  should: [
                    this.msgContainsAny('message', sshFailedTerms),
                    {
                      bool: {
                        filter: [
                          { terms: { 'event.action': this.termsCaseVariants(['ssh_login_failed', 'user_login_failed', 'authentication_failure']) } }
                        ]
                      }
                    }
                  ],
                  minimum_should_match: 1
                }
              },
              privilege: {
                bool: {
                  should: [
                    this.msgContainsAny('message', privilegeTerms),
                    { terms: { 'process.name': ['sudo', 'su'] } }
                  ],
                  minimum_should_match: 1
                }
              },
              user_changes: {
                bool: {
                  should: [
                    this.msgContainsAny('message', userChangeTerms),
                    { terms: { 'process.name': ['useradd', 'usermod', 'userdel', 'groupadd', 'groupdel', 'gpasswd', 'chage'] } }
                  ],
                  minimum_should_match: 1
                }
              },
              group_changes: {
                bool: {
                  should: [
                    this.msgContainsAny('message', ['groupadd', 'groupdel', 'gpasswd']),
                    { terms: { 'process.name': ['groupadd', 'groupdel', 'gpasswd'] } }
                  ],
                  minimum_should_match: 1
                }
              },
              remote_access: {
                bool: {
                  should: [
                    this.msgContainsAny('message', ['sshd', 'accepted password', 'accepted publickey', 'connection from']),
                    { terms: { 'process.name': remoteTerms } }
                  ],
                  minimum_should_match: 1
                }
              }
            }
          }
        },
        failed_by_user: { terms: { field: 'user.name', size: 10 } },
        failed_by_ip: { terms: { field: 'source.ip', size: 10 } }
      }
    }

    const summary = await this.safeSearch('logs-*', summaryBody)
    const buckets = summary?.aggregations?.by_event?.buckets || {}

    const makeBody = (shouldBlocks: any[]) => ({
      size: 5,
      sort: [{ '@timestamp': { order: 'desc' } }],
      query: {
        bool: {
          filter: [this.hostFilter(hostName), this.range24h()],
          should: shouldBlocks,
          minimum_should_match: 1
        }
      },
      _source: [
        '@timestamp',
        'event.action',
        'event.category',
        'event.type',
        'event.outcome',
        'user.name',
        'user.target.name',
        'source.ip',
        'process.name',
        'data_stream.dataset',
        'event.dataset',
        'message'
      ]
    })

    const [successRows, failedRows, privilegeRows, userChangeRows, remoteRows] = await Promise.all([
      this.safeSearch('logs-*', makeBody([
        this.msgContainsAny('message', sshSuccessTerms),
        { terms: { 'event.action': this.termsCaseVariants(['ssh_login', 'user_login', 'session_opened']) } }
      ])),
      this.safeSearch('logs-*', makeBody([
        this.msgContainsAny('message', sshFailedTerms),
        { terms: { 'event.action': this.termsCaseVariants(['ssh_login_failed', 'user_login_failed', 'authentication_failure']) } }
      ])),
      this.safeSearch('logs-*', makeBody([
        this.msgContainsAny('message', privilegeTerms),
        { terms: { 'process.name': ['sudo', 'su'] } }
      ])),
      this.safeSearch('logs-*', makeBody([
        this.msgContainsAny('message', userChangeTerms),
        { terms: { 'process.name': ['useradd', 'usermod', 'userdel', 'groupadd', 'groupdel', 'gpasswd', 'chage'] } }
      ])),
      this.safeSearch('logs-*', makeBody([
        this.msgContainsAny('message', ['sshd', 'accepted password', 'accepted publickey', 'connection from']),
        { terms: { 'process.name': remoteTerms } }
      ]))
    ])

    const mapRows = (hits: any[], mapper: (src: any) => any) =>
      (hits || []).map((hit) => mapper(this.hitSource(hit)))

    return {
      kpis: {
        successLogons24h: buckets.success_logons?.doc_count || 0,
        failedLogons24h: buckets.failed_logons?.doc_count || 0,
        lockouts24h: 0,
        privilegeEvents24h: buckets.privilege?.doc_count || 0,
        userChanges24h: buckets.user_changes?.doc_count || 0,
        groupChanges24h: buckets.group_changes?.doc_count || 0,
        remoteAccess24h: buckets.remote_access?.doc_count || 0
      },
      failuresByUser: (summary?.aggregations?.failed_by_user?.buckets || []).map((b: any) => ({
        key: b.key,
        count: b.doc_count
      })),
      failuresByIp: (summary?.aggregations?.failed_by_ip?.buckets || []).map((b: any) => ({
        key: b.key,
        count: b.doc_count
      })),
      recentSuccess: mapRows(successRows?.hits?.hits, (src) => ({
        timestamp: src['@timestamp'],
        user: this.pick(src, 'user.name') || this.pick(src, 'user.target.name'),
        sourceIp: this.pick(src, 'source.ip'),
        logonType: 'ssh/session',
        message: src.message || '-'
      })),
      recentFailed: mapRows(failedRows?.hits?.hits, (src) => ({
        timestamp: src['@timestamp'],
        user: this.pick(src, 'user.name') || this.pick(src, 'user.target.name'),
        sourceIp: this.pick(src, 'source.ip'),
        status: this.pick(src, 'event.outcome') || 'failure',
        subStatus: this.pick(src, 'event.action'),
        message: src.message || '-'
      })),
      privilegeEvents: mapRows(privilegeRows?.hits?.hits, (src) => ({
        timestamp: src['@timestamp'],
        eventCode: this.pick(src, 'event.action'),
        user: this.pick(src, 'user.name'),
        privilegeList: this.pick(src, 'process.name'),
        message: src.message || '-'
      })),
      userChanges: mapRows(userChangeRows?.hits?.hits, (src) => ({
        timestamp: src['@timestamp'],
        eventCode: this.pick(src, 'event.action') || this.pick(src, 'process.name'),
        targetUser: this.pick(src, 'user.target.name') || this.pick(src, 'user.name'),
        actorUser: this.pick(src, 'user.name'),
        memberName: null,
        message: src.message || '-'
      })),
      remoteAccess: mapRows(remoteRows?.hits?.hits, (src) => ({
        timestamp: src['@timestamp'],
        eventCode: this.pick(src, 'event.action'),
        user: this.pick(src, 'user.name') || this.pick(src, 'user.target.name'),
        sourceIp: this.pick(src, 'source.ip'),
        processName: this.pick(src, 'process.name'),
        logonType: 'ssh',
        message: src.message || '-'
      }))
    }
  }

  async getLinuxSecurityExport(hostName: string, from: string, to: string) {
    const rangeFilter = this.rangeCustom(from, to)
    const baseFilter = [this.hostFilter(hostName), rangeFilter]

    const datasets = ['system.auth', 'system.syslog', 'auditd.log', 'auditd', 'system.security']
    const sshSuccessTerms = ['accepted password', 'accepted publickey', 'session opened']
    const sshFailedTerms = ['failed password', 'authentication failure', 'invalid user', 'failed keyboard-interactive']
    const sudoTerms = ['sudo:', 'pam_unix(sudo:', 'COMMAND=']
    const userChangeTerms = ['useradd', 'usermod', 'userdel', 'groupadd', 'groupdel', 'gpasswd', 'chage']

    const summaryBody = {
      size: 0,
      query: {
        bool: {
          filter: baseFilter,
          should: [
            { terms: { 'data_stream.dataset': datasets } },
            { terms: { 'event.dataset': datasets } }
          ],
          minimum_should_match: 1
        }
      },
      aggs: {
        by_event: {
          filters: {
            filters: {
              success_logons: {
                bool: {
                  should: [
                    this.msgContainsAny('message', sshSuccessTerms),
                    { terms: { 'event.action': this.termsCaseVariants(['ssh_login', 'user_login', 'session_opened']) } }
                  ],
                  minimum_should_match: 1
                }
              },
              failed_logons: {
                bool: {
                  should: [
                    this.msgContainsAny('message', sshFailedTerms),
                    { terms: { 'event.action': this.termsCaseVariants(['ssh_login_failed', 'user_login_failed', 'authentication_failure']) } }
                  ],
                  minimum_should_match: 1
                }
              },
              privilege: {
                bool: {
                  should: [
                    this.msgContainsAny('message', sudoTerms),
                    { terms: { 'process.name': ['sudo', 'su'] } }
                  ],
                  minimum_should_match: 1
                }
              },
              user_changes: {
                bool: {
                  should: [
                    this.msgContainsAny('message', userChangeTerms),
                    { terms: { 'process.name': ['useradd', 'usermod', 'userdel', 'groupadd', 'groupdel', 'gpasswd', 'chage'] } }
                  ],
                  minimum_should_match: 1
                }
              },
              group_changes: {
                bool: {
                  should: [
                    this.msgContainsAny('message', ['groupadd', 'groupdel', 'gpasswd']),
                    { terms: { 'process.name': ['groupadd', 'groupdel', 'gpasswd'] } }
                  ],
                  minimum_should_match: 1
                }
              },
              remote_access: {
                bool: {
                  should: [
                    this.msgContainsAny('message', ['sshd', 'accepted password', 'accepted publickey', 'connection from']),
                    { terms: { 'process.name': ['sshd', 'ssh', 'sudo', 'su'] } }
                  ],
                  minimum_should_match: 1
                }
              }
            }
          }
        },
        failed_by_user: { terms: { field: 'user.name', size: 20 } },
        failed_by_ip: { terms: { field: 'source.ip', size: 20 } }
      }
    }

    const mkBody = (shouldBlocks: any[], size = 1000) => ({
      size,
      sort: [{ '@timestamp': { order: 'desc' } }],
      query: {
        bool: {
          filter: baseFilter,
          should: shouldBlocks,
          minimum_should_match: 1
        }
      },
      _source: [
        '@timestamp',
        'event.action',
        'event.category',
        'event.type',
        'event.outcome',
        'user.name',
        'user.target.name',
        'source.ip',
        'process.name',
        'data_stream.dataset',
        'event.dataset',
        'message'
      ]
    })

    const [summary, successRows, failedRows, privilegeRows, userChangeRows, remoteRows] = await Promise.all([
      this.safeSearch('logs-*', summaryBody),
      this.safeSearch('logs-*', mkBody([
        this.msgContainsAny('message', sshSuccessTerms),
        { terms: { 'event.action': this.termsCaseVariants(['ssh_login', 'user_login', 'session_opened']) } }
      ])),
      this.safeSearch('logs-*', mkBody([
        this.msgContainsAny('message', sshFailedTerms),
        { terms: { 'event.action': this.termsCaseVariants(['ssh_login_failed', 'user_login_failed', 'authentication_failure']) } }
      ])),
      this.safeSearch('logs-*', mkBody([
        this.msgContainsAny('message', sudoTerms),
        { terms: { 'process.name': ['sudo', 'su'] } }
      ])),
      this.safeSearch('logs-*', mkBody([
        this.msgContainsAny('message', userChangeTerms),
        { terms: { 'process.name': ['useradd', 'usermod', 'userdel', 'groupadd', 'groupdel', 'gpasswd', 'chage'] } }
      ])),
      this.safeSearch('logs-*', mkBody([
        this.msgContainsAny('message', ['sshd', 'accepted password', 'accepted publickey', 'connection from']),
        { terms: { 'process.name': ['sshd', 'ssh', 'sudo', 'su'] } }
      ]))
    ])

    const buckets = summary?.aggregations?.by_event?.buckets || {}
    const mapRows = (hits: any[], mapper: (src: any) => any) => (hits || []).map((hit) => mapper(this.hitSource(hit)))

    return {
      from,
      to,
      hostName,
      kpis: {
        successLogons: buckets.success_logons?.doc_count || 0,
        failedLogons: buckets.failed_logons?.doc_count || 0,
        lockouts: 0,
        privilegeEvents: buckets.privilege?.doc_count || 0,
        userChanges: buckets.user_changes?.doc_count || 0,
        groupChanges: buckets.group_changes?.doc_count || 0,
        remoteAccess: buckets.remote_access?.doc_count || 0
      },
      failuresByUser: (summary?.aggregations?.failed_by_user?.buckets || []).map((b: any) => ({ key: b.key, count: b.doc_count })),
      failuresByIp: (summary?.aggregations?.failed_by_ip?.buckets || []).map((b: any) => ({ key: b.key, count: b.doc_count })),
      recentSuccess: mapRows(successRows?.hits?.hits, (src) => ({
        timestamp: src['@timestamp'],
        user: this.pick(src, 'user.name') || this.pick(src, 'user.target.name'),
        sourceIp: this.pick(src, 'source.ip'),
        logonType: 'ssh/session',
        message: src.message || '-'
      })),
      recentFailed: mapRows(failedRows?.hits?.hits, (src) => ({
        timestamp: src['@timestamp'],
        user: this.pick(src, 'user.name') || this.pick(src, 'user.target.name'),
        sourceIp: this.pick(src, 'source.ip'),
        status: this.pick(src, 'event.outcome') || 'failure',
        subStatus: this.pick(src, 'event.action'),
        message: src.message || '-'
      })),
      privilegeEvents: mapRows(privilegeRows?.hits?.hits, (src) => ({
        timestamp: src['@timestamp'],
        eventCode: this.pick(src, 'event.action'),
        user: this.pick(src, 'user.name'),
        privilegeList: this.pick(src, 'process.name'),
        message: src.message || '-'
      })),
      userChanges: mapRows(userChangeRows?.hits?.hits, (src) => ({
        timestamp: src['@timestamp'],
        eventCode: this.pick(src, 'event.action') || this.pick(src, 'process.name'),
        targetUser: this.pick(src, 'user.target.name') || this.pick(src, 'user.name'),
        actorUser: this.pick(src, 'user.name'),
        memberName: null,
        message: src.message || '-'
      })),
      remoteAccess: mapRows(remoteRows?.hits?.hits, (src) => ({
        timestamp: src['@timestamp'],
        eventCode: this.pick(src, 'event.action'),
        user: this.pick(src, 'user.name') || this.pick(src, 'user.target.name'),
        sourceIp: this.pick(src, 'source.ip'),
        processName: this.pick(src, 'process.name'),
        logonType: 'ssh',
        message: src.message || '-'
      }))
    }
  }
}