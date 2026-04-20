const SETTINGS_KEY = 'hyperox_ui_settings_v1'
const NOTIFICATION_STATE_KEY = 'hyperox_notifications_state_v1'

export const DEFAULT_SETTINGS = {
  accent: 'violet',
  radius: 16,
  dense: false,
  showTweaks: true,
}

export const ACCENT_MAP = {
  cyan: {
    cyan: 'oklch(0.75 0.16 235)',
    cyanDeep: 'oklch(0.58 0.16 235)',
    cyanDim: 'oklch(0.75 0.16 235 / 0.14)',
  },
  teal: {
    cyan: 'oklch(0.78 0.15 185)',
    cyanDeep: 'oklch(0.58 0.14 185)',
    cyanDim: 'oklch(0.78 0.15 185 / 0.14)',
  },
  green: {
    cyan: 'oklch(0.80 0.16 155)',
    cyanDeep: 'oklch(0.59 0.14 155)',
    cyanDim: 'oklch(0.80 0.16 155 / 0.14)',
  },
  violet: {
    cyan: 'oklch(0.74 0.16 295)',
    cyanDeep: 'oklch(0.54 0.17 295)',
    cyanDim: 'oklch(0.74 0.16 295 / 0.14)',
  },
  coral: {
    cyan: 'oklch(0.76 0.16 25)',
    cyanDeep: 'oklch(0.58 0.16 25)',
    cyanDim: 'oklch(0.76 0.16 25 / 0.14)',
  },
}

export function loadSettings() {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(settings) {
  if (typeof window === 'undefined') return
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

export function applySettings(settings) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const accent = ACCENT_MAP[settings.accent] || ACCENT_MAP.violet
  root.style.setProperty('--cyan', accent.cyan)
  root.style.setProperty('--cyan-deep', accent.cyanDeep)
  root.style.setProperty('--cyan-dim', accent.cyanDim)
  root.style.setProperty('--r-lg', `${Math.max(8, Number(settings.radius || 16) - 4)}px`)
  root.style.setProperty('--r-xl', `${Math.max(10, Number(settings.radius || 16))}px`)
  root.style.setProperty('--content-max', settings.dense ? '1360px' : '1480px')
}

export function loadNotificationState() {
  if (typeof window === 'undefined') return { readIds: [] }
  try {
    return { readIds: [], ...JSON.parse(localStorage.getItem(NOTIFICATION_STATE_KEY) || '{}') }
  } catch {
    return { readIds: [] }
  }
}

export function saveNotificationState(state) {
  if (typeof window === 'undefined') return
  localStorage.setItem(NOTIFICATION_STATE_KEY, JSON.stringify(state))
}

export function buildNotifications({ assets = [], audit = [], vms = [], tickets = [] }) {
  const items = []
  const now = Date.now()

  assets.filter(a => a.agent_status && a.agent_status !== 'online').slice(0, 4).forEach(a => {
    items.push({
      id: `asset-${a.id}-${a.agent_status}`,
      title: `${a.display_name || a.host_name || 'Asset'} en estado ${a.agent_status}`,
      detail: `${a.fleet_policy_name || 'policy no definida'} · activo monitoreado`,
      severity: a.agent_status === 'error' ? 'critical' : 'warning',
      ts: now - 10 * 60 * 1000,
      href: a.id ? `/assets/${a.id}` : '/assets',
      type: 'asset',
    })
  })

  audit.slice(0, 4).forEach(row => {
    items.push({
      id: `audit-${row.id}`,
      title: `${row.action || 'Evento'} ${row.result ? `· ${row.result}` : ''}`.trim(),
      detail: row.target || 'Sin target',
      severity: /error|fail|denied|forbidden/i.test(`${row.result || ''} ${row.action || ''}`) ? 'critical' : 'info',
      ts: new Date(row.created_at || now).getTime(),
      href: '/audit',
      type: 'audit',
    })
  })

  const stopped = vms.filter(vm => vm.status && vm.status !== 'running').slice(0, 3)
  stopped.forEach(vm => {
    items.push({
      id: `vm-${vm.vmid}-${vm.status}`,
      title: `${vm.name || `VM ${vm.vmid}`} en estado ${vm.status}`,
      detail: `${vm.pool_id || 'sin pool'} · nodo ${vm.node || '-'}`,
      severity: vm.status === 'stopped' ? 'warning' : 'info',
      ts: now - 20 * 60 * 1000,
      href: `/vms/${vm.vmid}`,
      type: 'vm',
    })
  })

  tickets.filter(t => !/done|closed/i.test(String(t.status || ''))).slice(0, 3).forEach(ticket => {
    items.push({
      id: `ticket-${ticket.key || ticket.id}`,
      title: `Ticket ${ticket.key || ticket.id} · ${ticket.title || ticket.summary || 'Issue'}`,
      detail: `${ticket.priority || 'Medium'} · ${ticket.status || '-'}`,
      severity: /highest|high|critical/i.test(String(ticket.priority || '')) ? 'critical' : 'info',
      ts: new Date(ticket.updatedAt || ticket.createdAt || now).getTime(),
      href: '/support',
      type: 'ticket',
    })
  })

  return items.sort((a, b) => b.ts - a.ts).slice(0, 12)
}

export function relativeTime(ts) {
  const delta = Math.max(1, Math.round((Date.now() - ts) / 60000))
  if (delta < 60) return `${delta}m ago`
  const hours = Math.round(delta / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

