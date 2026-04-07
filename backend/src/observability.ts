export type SupportedOsType = 'windows' | 'linux'

const DEFAULT_KIBANA_BASE_URL = process.env.KIBANA_BASE_URL || 'http://192.168.10.162:5601'

const DEFAULT_SERVICES: Record<SupportedOsType, string[]> = {
  windows: ['postgres', 'mysql', 'sqlserver', 'veeam'],
  linux: ['plesk', 'cloudflare', 'docker', 'nginx']
}

function normalizeOsType(value?: string | null): SupportedOsType | null {
  if (!value) return null

  const normalized = value.toLowerCase().trim()

  if (normalized === 'windows') return 'windows'
  if (normalized === 'linux') return 'linux'

  return null
}

function escapeKuery(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\"/g, '\\"')
}

function buildDashboardUrl(baseUrl: string, dashboardId: string | undefined, hostName: string, embed = true) {
  if (!dashboardId) return null

  const safeHostName = escapeKuery(hostName)
  const globalState = encodeURIComponent(`(filters:!(),refreshInterval:(pause:!t,value:0),time:(from:now-24h,to:now))`)
  const appState = encodeURIComponent(`(query:(language:kuery,query:'host.name:"${safeHostName}"'))`)
  const embedParam = embed ? 'embed=true&' : ''

  return `${baseUrl}/app/dashboards#/view/${dashboardId}?${embedParam}_g=${globalState}&_a=${appState}`
}

function getDashboardIds(osType: SupportedOsType) {
  const prefix = osType === 'windows' ? 'KIBANA_WINDOWS' : 'KIBANA_LINUX'

  return {
    overview: process.env[`${prefix}_OVERVIEW_DASHBOARD_ID`],
    services: process.env[`${prefix}_SERVICES_DASHBOARD_ID`],
    logs: process.env[`${prefix}_LOGS_DASHBOARD_ID`],
    events: process.env[`${prefix}_EVENTS_DASHBOARD_ID`],
    audit: process.env[`${prefix}_AUDIT_DASHBOARD_ID`]
  }
}

export function getVmMonitoredServices(vm: {
  os_type?: string | null
  monitored_services?: string | null
}) {
  const osType = normalizeOsType(vm.os_type)

  if (vm.monitored_services) {
    return vm.monitored_services
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }

  if (!osType) return []

  return DEFAULT_SERVICES[osType]
}

export function getVmObservability(vm: {
  name?: string | null
  os_type?: string | null
  elastic_host_name?: string | null
  kibana_base_url?: string | null
  monitored_services?: string | null
  observability_enabled?: boolean | null
}) {
  const osType = normalizeOsType(vm.os_type)
  const hostName = vm.elastic_host_name || vm.name || null
  const baseUrl = vm.kibana_base_url || DEFAULT_KIBANA_BASE_URL
  const services = getVmMonitoredServices(vm)

  if (!vm.observability_enabled || !hostName || !osType) {
    return {
      enabled: false,
      osType,
      hostName,
      baseUrl,
      services,
      dashboards: null
    }
  }

  const dashboardIds = getDashboardIds(osType)

  return {
    enabled: true,
    osType,
    hostName,
    baseUrl,
    services,
    dashboards: {
      overview: {
        id: dashboardIds.overview || null,
        configured: Boolean(dashboardIds.overview),
        embedUrl: buildDashboardUrl(baseUrl, dashboardIds.overview, hostName, true),
        openUrl: buildDashboardUrl(baseUrl, dashboardIds.overview, hostName, false)
      },
      services: {
        id: dashboardIds.services || null,
        configured: Boolean(dashboardIds.services),
        embedUrl: buildDashboardUrl(baseUrl, dashboardIds.services, hostName, true),
        openUrl: buildDashboardUrl(baseUrl, dashboardIds.services, hostName, false)
      },
      logs: {
        id: dashboardIds.logs || null,
        configured: Boolean(dashboardIds.logs),
        embedUrl: buildDashboardUrl(baseUrl, dashboardIds.logs, hostName, true),
        openUrl: buildDashboardUrl(baseUrl, dashboardIds.logs, hostName, false)
      },
      events: {
        id: dashboardIds.events || null,
        configured: Boolean(dashboardIds.events),
        embedUrl: buildDashboardUrl(baseUrl, dashboardIds.events, hostName, true),
        openUrl: buildDashboardUrl(baseUrl, dashboardIds.events, hostName, false)
      },
      audit: {
        id: dashboardIds.audit || null,
        configured: Boolean(dashboardIds.audit),
        embedUrl: buildDashboardUrl(baseUrl, dashboardIds.audit, hostName, true),
        openUrl: buildDashboardUrl(baseUrl, dashboardIds.audit, hostName, false)
      }
    }
  }
}
