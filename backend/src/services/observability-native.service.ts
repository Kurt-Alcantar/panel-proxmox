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

  private normalizeDetectedServiceState(value: any, message?: string) {
  const v = String(value || '').toLowerCase();
  const m = String(message || '').toLowerCase();

  if (['running', 'active', 'started', 'start_pending', 'continue_pending', 'up'].includes(v)) {
    return 'running';
  }

  if (['stopped', 'inactive', 'failed', 'dead', 'down', 'stop_pending', 'paused', 'pause_pending'].includes(v)) {
    return 'stopped';
  }

  if (/running|active|started|up/.test(m)) return 'running';
  if (/stopped|inactive|failed|dead|down|exited/.test(m)) return 'stopped';

  return 'unknown';
}

private classifyDetectedWindowsService(rawName?: string | null) {
  const value = String(rawName || '').trim();
  const n = value.toLowerCase();

  if (!n) return null;

  if (n.includes('veeam')) {
    return { family: 'veeam', label: 'Veeam', priority: 10 };
  }

  if (n === 'mysql80' || n.includes('mysql')) {
    return { family: 'mysql', label: 'MySQL', priority: 20 };
  }

  if (n.includes('postgres')) {
    return { family: 'postgres', label: 'PostgreSQL', priority: 30 };
  }

  if (n === 'sqlbrowser' || n.includes('sql server browser')) {
    return { family: 'sqlbrowser', label: 'SQL Browser', priority: 50 };
  }

  if (n === 'sqlwriter' || n.includes('sql server vss writer')) {
    return { family: 'sqlwriter', label: 'SQL Writer', priority: 60 };
  }

  if (n.includes('telemetry') || n.includes('ceip')) {
    return { family: 'sqltelemetry', label: 'SQL Telemetry', priority: 70 };
  }

  if (n.includes('sql server agent') || n.startsWith('sqlagent$')) {
    return { family: 'sqlagent', label: 'SQL Agent', priority: 40 };
  }

  if (
    (n.includes('sql server') || n.startsWith('mssql$')) &&
    !n.includes('browser') &&
    !n.includes('writer') &&
    !n.includes('telemetry') &&
    !n.includes('ceip') &&
    !n.includes('internal database')
  ) {
    return { family: 'sqlserver', label: 'SQL Server', priority: 35 };
  }

  if (n.includes('windows internal database') || n.includes('microsoft##wid')) {
    return { family: 'wid', label: 'Windows Internal Database', priority: 80 };
  }

  return null;
}

private classifyDetectedLinuxService(rawName?: string | null) {
  const value = String(rawName || '').trim();
  const n = value.toLowerCase();

  if (!n) return null;

  if (n.includes('postgres')) {
    return { family: 'postgres', label: 'PostgreSQL', priority: 20 };
  }

  if (n.includes('mysql') || n.includes('mariadb')) {
    return { family: 'mysql', label: 'MySQL/MariaDB', priority: 30 };
  }

  if (n.includes('nginx')) {
    return { family: 'nginx', label: 'Nginx', priority: 40 };
  }

  if (n.includes('docker') || n.includes('containerd')) {
    return { family: 'docker', label: 'Docker', priority: 50 };
  }

  if (n.includes('cloudflare') || n.includes('cloudflared')) {
    return { family: 'cloudflare', label: 'Cloudflare', priority: 60 };
  }

  if (n.includes('plesk')) {
    return { family: 'plesk', label: 'Plesk', priority: 70 };
  }

  if (n.includes('veeam')) {
    return { family: 'veeam', label: 'Veeam', priority: 80 };
  }

  return null;
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

    private sqlHostFilter(hostName: string) {
    const raw = String(hostName || '').trim()
    const lower = raw.toLowerCase()

    return {
      bool: {
        should: [
          this.hostFilter(hostName),
          { term: { 'mssql.metrics.server_name.keyword': raw } },
          { term: { 'mssql.metrics.server_name': raw } },
          { term: { 'mssql.metrics.server_name': lower } },
          {
            wildcard: {
              'mssql.metrics.server_name': {
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

  private sqlDatasetFilter(dataset: string) {
    return {
      bool: {
        should: [
          { term: { 'event.dataset': dataset } },
          { term: { 'data_stream.dataset': dataset } }
        ],
        minimum_should_match: 1
      }
    }
  }

private buildSqlServiceCandidates(instanceName?: string) {
  const raw = String(instanceName || '').trim()
  const upper = raw.toUpperCase()

  const isDefault = !raw || upper === 'MSSQLSERVER'
  const isExpress = /EXPRESS/i.test(raw)

  const engineNames = isDefault
    ? ['MSSQLSERVER', 'SQL Server (MSSQLSERVER)', 'SQL Server']
    : [
        `MSSQL$${upper}`,
        `SQL Server (${raw})`,
        `SQL Server (${upper})`
      ]

  const agentNames = isDefault
    ? ['SQLSERVERAGENT', 'SQL Server Agent (MSSQLSERVER)', 'SQL Server Agent']
    : [
        `SQLAgent$${upper}`,
        `SQL Server Agent (${raw})`,
        `SQL Server Agent (${upper})`
      ]

  return {
    instanceName: raw || 'MSSQLSERVER',
    isDefault,
    isExpress,
    engineNames,
    agentNames
  }
}

private normalizeWindowsServiceState(value: any) {
  const v = String(value || '').toLowerCase()

  if (['running', 'start_pending', 'continue_pending'].includes(v)) return 'running'
  if (['stopped', 'stop_pending', 'paused', 'pause_pending'].includes(v)) return 'stopped'
  return 'unknown'
}

private async getSqlServiceState(hostName: string, instanceName?: string) {
  const svc = this.buildSqlServiceCandidates(instanceName)

  const body = {
    size: 200,
    sort: [{ '@timestamp': { order: 'desc' } }],
    query: {
      bool: {
        filter: [
          this.hostFilter(hostName),
          this.range24h()
        ],
        should: [
          { exists: { field: 'windows.service.name' } },
          { exists: { field: 'windows.service.display_name' } }
        ],
        minimum_should_match: 1
      }
    },
    _source: [
      '@timestamp',
      'windows.service.name',
      'windows.service.display_name',
      'windows.service.state',
      'message'
    ]
  }

  const res = await this.safeSearch('metrics-*,logs-*', body)
  const hits = res?.hits?.hits || []

  let engine: any = null
  let agent: any = null

  for (const hit of hits) {
    const src = this.hitSource(hit)

    const serviceName =
      this.pick(src, 'windows.service.display_name') ||
      this.pick(src, 'windows.service.name')

    if (!serviceName) continue

    const normalizedName = String(serviceName).toLowerCase()
    const state = this.normalizeWindowsServiceState(
      this.pick(src, 'windows.service.state')
    )

    if (
      !engine &&
      svc.engineNames.some((candidate) =>
        normalizedName.includes(String(candidate).toLowerCase())
      )
    ) {
      engine = {
        timestamp: src['@timestamp'],
        serviceName: String(serviceName),
        state,
        message: src.message || '-'
      }
      continue
    }

    if (
      !agent &&
      svc.agentNames.some((candidate) =>
        normalizedName.includes(String(candidate).toLowerCase())
      )
    ) {
      agent = {
        timestamp: src['@timestamp'],
        serviceName: String(serviceName),
        state,
        message: src.message || '-'
      }
    }
  }

  if (!engine) {
    engine = {
      timestamp: null,
      serviceName: svc.isDefault
        ? 'MSSQLSERVER'
        : `SQL Server (${svc.instanceName})`,
      state: 'unknown',
      message: 'Sin telemetría reciente del servicio SQL'
    }
  }

  if (!agent) {
    agent = svc.isExpress
      ? {
          timestamp: null,
          serviceName: `SQL Server Agent (${svc.instanceName})`,
          state: 'not_applicable',
          message: 'SQL Server Agent no aplica para esta edición/instancia Express'
        }
      : {
          timestamp: null,
          serviceName: svc.isDefault
            ? 'SQLSERVERAGENT'
            : `SQL Server Agent (${svc.instanceName})`,
          state: 'unknown',
          message: 'Sin telemetría reciente del servicio SQL Agent'
        }
  }

  return { engine, agent }
}

  private async getSqlPerformance(hostName: string) {
    const body = {
      size: 1,
      sort: [{ '@timestamp': { order: 'desc' } }],
      query: {
        bool: {
          filter: [
            this.sqlHostFilter(hostName),
            this.range24h(),
            this.sqlDatasetFilter('microsoft_sqlserver.performance')
          ]
        }
      },
      _source: ['@timestamp', 'mssql.metrics']
    }

    const res = await this.safeSearch('metrics-microsoft_sqlserver.performance*', body)
    const src = this.hitSource(res?.hits?.hits?.[0])

    return {
      timestamp: src['@timestamp'] || null,
      userConnections: this.pick(src, 'mssql.metrics.user_connections'),
      batchRequestsPerSec: this.pick(src, 'mssql.metrics.batch_requests_per_sec'),
      lockWaitsPerSec: this.pick(src, 'mssql.metrics.lock_waits_per_sec'),
      loginsPerSec: this.pick(src, 'mssql.metrics.logins_per_sec'),
      memoryGrantsPending: this.pick(src, 'mssql.metrics.memory_grants_pending'),
      pageLifeExpectancy: this.pick(src, 'mssql.metrics.buffer_page_life_expectancy'),
      transactions: this.pick(src, 'mssql.metrics.transactions'),
      serverName: this.pick(src, 'mssql.metrics.server_name'),
      instanceName: this.pick(src, 'mssql.metrics.instance_name')
    }
  }

  private async getSqlErrors(hostName: string) {
    const body = {
      size: 20,
      sort: [{ '@timestamp': { order: 'desc' } }],
      query: {
        bool: {
          filter: [
            this.sqlHostFilter(hostName),
            this.range24h(),
            this.sqlDatasetFilter('microsoft_sqlserver.log')
          ],
          should: [
            { terms: { 'log.level': ['error', 'critical', 'fatal'] } },
            this.msgContainsAny('message', [
              'error',
              'failed',
              'severity',
              'corrupt',
              'recovery',
              'login failed',
              'deadlock'
            ])
          ],
          minimum_should_match: 1
        }
      },
      _source: [
        '@timestamp',
        'log.level',
        'message',
        'event.dataset',
        'data_stream.dataset',
        'microsoft_sqlserver.log.origin'
      ]
    }

    const res = await this.safeSearch('logs-microsoft_sqlserver.log*', body)
    const rows = (res?.hits?.hits || []).map((hit: any) => {
      const src = this.hitSource(hit)
      return {
        timestamp: src['@timestamp'],
        level: this.pick(src, 'log.level'),
        origin: this.pick(src, 'microsoft_sqlserver.log.origin'),
        dataset: this.pick(src, 'event.dataset') || this.pick(src, 'data_stream.dataset'),
        message: src.message || '-'
      }
    })

    return {
      total: rows.length,
      critical: rows.filter((row: any) =>
        ['critical', 'fatal'].includes(String(row.level || '').toLowerCase()) ||
        /deadlock|corrupt|severity/i.test(String(row.message || ''))
      ).length,
      latest: rows
    }
  }

  private async getSqlSecurity(hostName: string) {
    const body = {
      size: 20,
      sort: [{ '@timestamp': { order: 'desc' } }],
      query: {
        bool: {
          filter: [
            this.sqlHostFilter(hostName),
            this.range24h(),
            this.sqlDatasetFilter('microsoft_sqlserver.audit')
          ]
        }
      },
      _source: [
        '@timestamp',
        'event.action',
        'event.outcome',
        'user.name',
        'source.ip',
        'message'
      ]
    }

    const res = await this.safeSearch('logs-microsoft_sqlserver.audit*', body)
    const rows = (res?.hits?.hits || []).map((hit: any) => {
      const src = this.hitSource(hit)
      return {
        timestamp: src['@timestamp'],
        action: this.pick(src, 'event.action'),
        outcome: this.pick(src, 'event.outcome'),
        user: this.pick(src, 'user.name'),
        sourceIp: this.pick(src, 'source.ip'),
        message: src.message || '-'
      }
    })

    const failedLogins = rows.filter((row: any) =>
      String(row.outcome || '').toLowerCase() === 'failure' ||
      /failed|login failed|authentication/i.test(String(row.message || ''))
    ).length

    const privilegeEvents = rows.filter((row: any) =>
      /grant|deny|role|permission|server role|db_owner|db_datareader|db_datawriter/i.test(String(row.message || '')) ||
      /grant|deny|role|permission/i.test(String(row.action || ''))
    ).length

    return {
      total: rows.length,
      failedLogins,
      privilegeEvents,
      latest: rows
    }
  }


  async getSqlOverview(hostName: string) {
    const performance = await this.getSqlPerformance(hostName)

    const [serviceState, errors24h, security24h] = await Promise.all([
      this.getSqlServiceState(hostName, performance?.instanceName),
      this.getSqlErrors(hostName),
      this.getSqlSecurity(hostName)
    ])

    if (
      (!serviceState?.engine || serviceState.engine.state === 'unknown') &&
      performance?.timestamp &&
      performance?.instanceName
    ) {
      serviceState.engine = {
        timestamp: performance.timestamp,
        serviceName: `SQL Server (${performance.instanceName})`,
        state: 'running',
        message: 'Inferido por métricas recientes de SQL Server'
      }
    }

    return {
      serviceState,
      performance,
      errors24h,
      security24h
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

  async getWindowsServices(hostName: string) {
    const body = {
      size: 500,
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
      _source: [
        '@timestamp',
        'windows.service.name',
        'windows.service.display_name',
        'windows.service.state',
        'message'
      ]
    };

    const res = await this.safeSearch('metrics-*,logs-*', body);
    const latestByService = new Map<string, any>();
    const familiesDetected = new Set<string>();

    for (const hit of res?.hits?.hits || []) {
      const src = this.hitSource(hit);

      const serviceName =
        this.pick(src, 'windows.service.display_name') ||
        this.pick(src, 'windows.service.name');

      if (!serviceName) continue;

      const serviceNameStr = String(serviceName).trim();
      const serviceKey = serviceNameStr.toLowerCase();

      if (latestByService.has(serviceKey)) continue;

      const meta = this.classifyDetectedWindowsService(serviceNameStr);
      if (!meta) continue;

      const row = {
        timestamp: src['@timestamp'] || null,
        serviceName: serviceNameStr,
        state: this.normalizeDetectedServiceState(
          this.pick(src, 'windows.service.state'),
          src.message
        ),
        message: src.message || '-',
        family: meta.family,
        familyLabel: meta.label,
        priority: meta.priority
      };

      latestByService.set(serviceKey, row);
      familiesDetected.add(meta.family);
    }

    const rows = Array.from(latestByService.values()).sort((a: any, b: any) => {
      if ((a.priority || 999) !== (b.priority || 999)) {
        return (a.priority || 999) - (b.priority || 999);
      }

      return String(a.serviceName || '').localeCompare(String(b.serviceName || ''));
    });

    const details: Record<string, any> = {};

    const hasSql =
      rows.some((row: any) => ['sqlserver', 'sqlagent', 'sqlbrowser', 'sqlwriter', 'sqltelemetry'].includes(row.family));

    if (hasSql) {
      const sqlOverview = await this.getSqlOverview(hostName);
      details.sqlserver = sqlOverview;

      const addIfMissing = (item: any, family: string, priority: number) => {
        if (!item?.serviceName) return;

        const exists = rows.some((row: any) =>
          String(row.serviceName || '').toLowerCase() === String(item.serviceName || '').toLowerCase()
        );

        if (!exists) {
          rows.push({
            timestamp: item.timestamp || null,
            serviceName: item.serviceName,
            state: item.state || 'unknown',
            message: item.message || '-',
            family,
            familyLabel: family === 'sqlserver' ? 'SQL Server' : 'SQL Agent',
            priority
          });
        }
      };

      addIfMissing(sqlOverview?.serviceState?.engine, 'sqlserver', 35);
      addIfMissing(sqlOverview?.serviceState?.agent, 'sqlagent', 40);

      rows.sort((a: any, b: any) => {
        if ((a.priority || 999) !== (b.priority || 999)) {
          return (a.priority || 999) - (b.priority || 999);
        }

        return String(a.serviceName || '').localeCompare(String(b.serviceName || ''));
      });
    }

    return {
      rows,
      detectedFamilies: Array.from(familiesDetected),
      details
    };
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

  async getLinuxServices(hostName: string) {
    const body = {
      size: 500,
      sort: [{ '@timestamp': { order: 'desc' } }],
      query: {
        bool: {
          filter: [this.hostFilter(hostName), this.range24h()],
          should: [
            { exists: { field: 'system.service.name' } },
            { exists: { field: 'system.service.state' } },
            { exists: { field: 'service.name' } },
            { exists: { field: 'process.name' } }
          ],
          minimum_should_match: 1
        }
      },
      _source: [
        '@timestamp',
        'system.service.name',
        'system.service.state',
        'service.name',
        'process.name',
        'message'
      ]
    };

    const res = await this.safeSearch('metrics-*,logs-*', body);
    const latestByService = new Map<string, any>();
    const familiesDetected = new Set<string>();

    for (const hit of res?.hits?.hits || []) {
      const src = this.hitSource(hit);

      const rawName =
        this.pick(src, 'system.service.name') ||
        this.pick(src, 'service.name') ||
        this.pick(src, 'process.name');

      if (!rawName) continue;

      const serviceName = String(rawName).trim();
      const serviceKey = serviceName.toLowerCase();

      if (latestByService.has(serviceKey)) continue;

      const meta = this.classifyDetectedLinuxService(serviceName);
      if (!meta) continue;

      const row = {
        timestamp: src['@timestamp'] || null,
        serviceName,
        state: this.normalizeDetectedServiceState(
          this.pick(src, 'system.service.state'),
          src.message
        ),
        message: src.message || '-',
        family: meta.family,
        familyLabel: meta.label,
        priority: meta.priority
      };

      latestByService.set(serviceKey, row);
      familiesDetected.add(meta.family);
    }

    const rows = Array.from(latestByService.values()).sort((a: any, b: any) => {
      if ((a.priority || 999) !== (b.priority || 999)) {
        return (a.priority || 999) - (b.priority || 999);
      }

      return String(a.serviceName || '').localeCompare(String(b.serviceName || ''));
    });

    return {
      rows,
      detectedFamilies: Array.from(familiesDetected),
      details: {}
    };
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
      query: {
        bool: {
          filter: [this.hostFilter(hostName)]
        }
      },
      _source: ['@timestamp']
    }

    const latest = await this.safeSearch('metrics-*,logs-*', latestBody)
    const lastSeen = latest?.hits?.hits?.[0]?._source?.['@timestamp'] || null

    const recentErrorsBody = {
      size: 10,
      sort: [{ '@timestamp': { order: 'desc' } }],
      query: errorBody.query,
      _source: [
        '@timestamp',
        'host.name',
        'host.hostname',
        'service.name',
        'process.name',
        'log.level',
        'message',
        'event.dataset',
        'data_stream.dataset'
      ]
    }

    const recentErrors = await this.safeSearch('logs-*', recentErrorsBody)

    return {
      cpuAvgPct: this.num(
        metrics?.aggregations?.cpu_avg?.value
          ? metrics.aggregations.cpu_avg.value * 100
          : null
      ),
      memoryUsedPct: this.num(
        metrics?.aggregations?.mem_avg?.value
          ? metrics.aggregations.mem_avg.value * 100
          : null
      ),
      diskUsedPct: this.num(
        metrics?.aggregations?.disk_max?.value
          ? metrics.aggregations.disk_max.value * 100
          : null
      ),
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
}