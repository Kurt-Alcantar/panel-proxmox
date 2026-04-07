export type SupportedOsType = 'windows' | 'linux'

const DEFAULT_KIBANA_BASE_URL = process.env.KIBANA_BASE_URL || 'http://192.168.10.162:5601'

const DEFAULT_SERVICES: Record<SupportedOsType, string[]> = {
  windows: ['postgres', 'mysql', 'sqlserver', 'veeam'],
  linux: ['plesk', 'cloudflare', 'docker', 'nginx']
}

export function normalizeOsType(value?: string | null): SupportedOsType | null {
  if (!value) return null
  const normalized = value.toLowerCase().trim()
  if (normalized === 'windows') return 'windows'
  if (normalized === 'linux') return 'linux'
  return null
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

  return {
    enabled: Boolean(vm.observability_enabled && hostName && osType),
    osType,
    hostName,
    baseUrl,
    services,
    mode: 'native'
  }
}
