import Link from 'next/link'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { apiJson } from '../lib/auth'
import { applySettings, buildNotifications, loadNotificationState, loadSettings, relativeTime, saveNotificationState } from '../lib/panel'
import { useRole, NAV_PERMISSIONS } from '../lib/RoleContext'

const Icon = ({ name, size = 16, className = '' }) => {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', className }
  const paths = {
    overview:     <><rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/></>,
    assets:       <><rect x="3" y="4" width="18" height="6" rx="1.5"/><rect x="3" y="14" width="18" height="6" rx="1.5"/><circle cx="7" cy="7" r="0.8" fill="currentColor" stroke="none"/><circle cx="7" cy="17" r="0.8" fill="currentColor" stroke="none"/></>,
    vms:          <><rect x="3" y="3" width="18" height="14" rx="1.5"/><path d="M3 12h18"/><path d="M8 21h8"/><path d="M12 17v4"/></>,
    alerts:       <><path d="M12 3l9 16H3l9-16z"/><path d="M12 10v4"/><circle cx="12" cy="17" r="0.7" fill="currentColor" stroke="none"/></>,
    tickets:      <><path d="M4 7a2 2 0 012-2h12a2 2 0 012 2v3a2 2 0 000 4v3a2 2 0 01-2 2H6a2 2 0 01-2-2v-3a2 2 0 000-4V7z"/><path d="M12 6v12" strokeDasharray="2 2"/></>,
    settings:     <><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M1 12h4M19 12h4M4.2 4.2l2.8 2.8M17 17l2.8 2.8M4.2 19.8L7 17M17 7l2.8-2.8"/></>,
    search:       <><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></>,
    bell:         <><path d="M6 8a6 6 0 0112 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21a2 2 0 004 0"/></>,
    refresh:      <><path d="M21 12a9 9 0 11-3-6.7L21 8"/><path d="M21 3v5h-5"/></>,
    pool:         <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    terminal:     <><rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M7 9l3 3-3 3"/><path d="M13 15h4"/></>,
    tenant:       <><path d="M3 21V9l9-6 9 6v12"/><path d="M9 21v-6h6v6"/></>,
    dots:         <><circle cx="12" cy="5" r="1.2" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="12" cy="19" r="1.2" fill="currentColor" stroke="none"/></>,
    export:       <><path d="M12 3v12"/><path d="M8 11l4 4 4-4"/><path d="M5 21h14"/></>,
    plus:         <><path d="M12 5v14"/><path d="M5 12h14"/></>,
    globe:        <><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a15 15 0 010 18"/><path d="M12 3a15 15 0 000 18"/></>,
    chevronRight: <><path d="M9 6l6 6-6 6"/></>,
  }
  return <svg {...common}>{paths[name] || null}</svg>
}

// Nav completo — se filtra por rol en Sidebar
const ALL_NAV = [
  { title: 'Observability', items: [
    { href: '/overview',      icon: 'overview',  label: 'Overview' },
    { href: '/assets',        icon: 'assets',    label: 'Managed assets' },
    { href: '/alerts',        icon: 'alerts',    label: 'Alerts' },
  ]},
  { title: 'Infrastructure', items: [
    { href: '/vms',           icon: 'vms',       label: 'Proxmox VMs' },
    { href: '/pools',         icon: 'pool',      label: 'Grupos' },
    { href: '/fleet-agents',  icon: 'terminal',  label: 'Fleet agents' },
  ]},
  { title: 'Admin', items: [
    { href: '/admin',         icon: 'tenant',    label: 'Tenants & access' },
    { href: '/support',       icon: 'tickets',   label: 'Support tickets' },
    { href: '/settings',      icon: 'settings',  label: 'Settings' },
  ]},
]

function Sidebar({ userName, userRole, navCounts }) {
  const router = useRouter()
  const { role } = useRole()
  const path = router.pathname

  const allowed = NAV_PERMISSIONS[role || userRole] || NAV_PERMISSIONS.tenant_user

  const nav = useMemo(() => ALL_NAV.map(group => ({
    ...group,
    items: group.items
      .filter(item => allowed.includes(item.href))
      .map(item => ({ ...item, count: navCounts?.[item.href] ?? item.count })),
  })).filter(group => group.items.length > 0), [allowed, navCounts])

  const isActive = (href) => {
    if (href === '/assets') return path.startsWith('/assets')
    if (href === '/vms') return path.startsWith('/vms')
    return path === href
  }

  const initials = (userName || 'U').split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase()

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('refresh_token')
    router.replace('/login')
  }

  return (
    <aside className="sidebar">
      <div className="brand">
        <img src="/logo.png" alt="Hyperox" className="brand-logo" />
        <div className="brand-name">Hyperox</div>
        <div className="brand-env mono">v2.0</div>
      </div>
      <div className="sidebar-content">
        {nav.map(group => (
          <div className="nav-group" key={group.title}>
            <div className="nav-title">{group.title}</div>
            {group.items.map(item => (
              <Link className={`nav-item${isActive(item.href) ? ' active' : ''}`} href={item.href} key={item.href}>
                <Icon name={item.icon} className="ni-ico" />
                <span>{item.label}</span>
                {item.count != null && <span className="ni-count">{item.count}</span>}
              </Link>
            ))}
          </div>
        ))}
      </div>
      <div className="sidebar-foot">
        <div className="user-card">
          <div className="user-avatar">{initials}</div>
          <div className="user-info">
            <div className="user-name">{userName || 'Usuario'}</div>
            <div className="user-role mono">{userRole || role || '—'}</div>
          </div>
          <button className="user-menu-btn" onClick={logout} title="Cerrar sesión">
            <Icon name="dots" size={14} />
          </button>
        </div>
      </div>
    </aside>
  )
}

function NotificationPanel({ notifications, unreadCount, onMarkAllRead, onClearAll, onOpenItem }) {
  return (
    <div className="topbar-panel">
      <div className="topbar-panel-head">
        <div>
          <strong>Notifications</strong>
          <div className="topbar-panel-sub">{unreadCount} pendientes</div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-ghost btn-sm" onClick={onMarkAllRead}>Marcar leídas</button>
          <button className="btn btn-ghost btn-sm" onClick={onClearAll} style={{ color: 'var(--red)' }}>Clear all</button>
        </div>
      </div>
      <div className="topbar-panel-list">
        {notifications.length === 0
          ? <div className="emptyState">Sin notificaciones.</div>
          : notifications.map(item => (
            <button key={item.id} className={`notif-row ${item.read ? 'read' : ''}`} onClick={() => onOpenItem(item)}>
              <span className={`notif-dot ${item.severity || 'info'}`} />
              <div className="notif-body">
                <div className="notif-title">{item.title}</div>
                <div className="notif-detail">{item.detail}</div>
              </div>
              <div className="notif-time">{relativeTime(item.ts)}</div>
            </button>
          ))}
      </div>
    </div>
  )
}

function SearchDropdown({ value, results, onSelect, visible }) {
  if (!visible || !value.trim() || !results) return null
  const hasResults = Object.values(results).some(arr => arr.length > 0)
  return (
    <div style={{
      position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999,
      background: 'var(--surface-1)', border: '1px solid var(--border)',
      borderRadius: 'var(--r-lg)', marginTop: 4, boxShadow: 'var(--shadow-md)',
      maxHeight: 400, overflowY: 'auto',
    }}>
      {!hasResults && <div style={{ padding: '12px 16px', color: 'var(--text-4)', fontSize: 13 }}>Sin resultados para "{value}"</div>}
      {[
        { key: 'assets', label: 'Activos', href: id => `/assets/${id}`, nameKey: 'display_name' },
        { key: 'vms',    label: 'VMs',     href: id => `/vms/${id}`,    nameKey: 'name' },
        { key: 'tickets', label: 'Tickets', href: () => '/support',      nameKey: 'title' },
      ].map(({ key, label, href, nameKey }) => {
        const items = results[key] || []
        if (!items.length) return null
        return (
          <div key={key}>
            <div style={{ padding: '8px 16px 4px', fontSize: 10, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
            {items.slice(0, 4).map(item => (
              <button key={item.id || item.key} onClick={() => onSelect(href(item.id || item.vmid || item.key))}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text)', borderRadius: 0 }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <span style={{ fontWeight: 500 }}>{item[nameKey] || item.host_name || item.key || '—'}</span>
                {item.agent_status && <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-4)' }}>{item.agent_status}</span>}
                {item.status && <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-4)' }}>{item.status}</span>}
              </button>
            ))}
          </div>
        )
      })}
    </div>
  )
}

function Topbar({ breadcrumbs, searchValue, onSearchChange, searchPlaceholder, actions, region, notifications, onOpenItem, onMarkAllRead, onClearAll, onRefresh }) {
  const router = useRouter()
  const unreadCount = notifications.filter(n => !n.read).length
  const [open, setOpen] = useState(false)
  const [searchResults, setSearchResults] = useState(null)
  const [searchVisible, setSearchVisible] = useState(false)
  const searchTimer = useRef(null)

  const handleSearchChange = (val) => {
    onSearchChange?.(val)
    clearTimeout(searchTimer.current)
    if (!val.trim()) { setSearchResults(null); setSearchVisible(false); return }
    searchTimer.current = setTimeout(async () => {
      try {
        const data = await apiJson(`/api/search?q=${encodeURIComponent(val.trim())}`)
        setSearchResults(data)
        setSearchVisible(true)
      } catch { setSearchResults(null) }
    }, 300)
  }

  return (
    <div className="topbar">
      <div className="breadcrumb">
        {(breadcrumbs || ['Hyperox']).map((crumb, index, arr) => (
          <span key={`${crumb}-${index}`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {index > 0 && <span className="bc-sep">/</span>}
            <span className={index === arr.length - 1 ? 'bc-current' : ''}>{crumb}</span>
          </span>
        ))}
      </div>

      <div className="topbar-search" style={{ position: 'relative' }}>
        <Icon name="search" className="ts-ico" />
        <input
          placeholder={searchPlaceholder || 'Buscar activos, VMs, tickets...'}
          value={searchValue || ''}
          onChange={(e) => handleSearchChange(e.target.value)}
          onFocus={() => searchResults && setSearchVisible(true)}
          onBlur={() => setTimeout(() => setSearchVisible(false), 200)}
        />
        <span className="ts-kbd">⌘K</span>
        <SearchDropdown
          value={searchValue || ''}
          results={searchResults}
          visible={searchVisible}
          onSelect={(href) => { setSearchVisible(false); router.push(href) }}
        />
      </div>

      <div className="topbar-actions">
        {actions}
        <div className="tb-region"><span className="region-dot" />{region || 'mx-central-1'}</div>
        <div className="topbar-actions-rel">
          <button className="tb-btn tb-btn-icon" title="Notificaciones" onClick={() => setOpen(v => !v)}>
            <Icon name="bell" />
            {unreadCount > 0 && <span className="tb-badge">{unreadCount}</span>}
          </button>
          {open && (
            <NotificationPanel
              notifications={notifications}
              unreadCount={unreadCount}
              onMarkAllRead={() => { onMarkAllRead(); setOpen(false) }}
              onClearAll={() => { onClearAll(); setOpen(false) }}
              onOpenItem={(item) => { setOpen(false); onOpenItem(item) }}
            />
          )}
        </div>
        <button className="tb-btn tb-btn-icon" title="Refresh" onClick={onRefresh}><Icon name="refresh" /></button>
      </div>
    </div>
  )
}

export function ShellIcon(props) {
  return <Icon {...props} />
}

export default function AppShell({
  title, subtitle, breadcrumbs, children, actions, searchValue = '', onSearchChange,
  searchPlaceholder, topbarActions, userName, userRole, navCounts, region,
}) {
  const router = useRouter()
  const { displayName, role } = useRole()
  const [notifications, setNotifications] = useState([])
  const notifIntervalRef = useRef(null)
  const crumbs = breadcrumbs || (title ? ['Hyperox', title] : ['Hyperox'])

  useEffect(() => {
    const settings = loadSettings()
    applySettings(settings)
  }, [])

  // Notificaciones con polling lento (5 min) — no en cada ruta
  const loadNotifications = useCallback(async () => {
    try {
      if (typeof window === 'undefined' || !localStorage.getItem('token')) return
      const [assets, audit, vms, support] = await Promise.all([
        apiJson('/api/assets').catch(() => []),
        apiJson('/api/audit').catch(() => []),
        apiJson('/api/my/vms').catch(() => []),
        apiJson('/api/support/tickets').catch(() => ({ items: [] })),
      ])
      const tickets = support?.items || []
      const notifState = loadNotificationState()
      const compiled = buildNotifications({ assets, audit, vms, tickets }).map(item => ({
        ...item,
        read: notifState.readIds.includes(item.id),
      }))
      setNotifications(compiled)
    } catch { setNotifications([]) }
  }, [])

  useEffect(() => {
    loadNotifications()
    notifIntervalRef.current = setInterval(loadNotifications, 5 * 60 * 1000)
    window.addEventListener('hyperox:tickets-updated', loadNotifications)
    return () => {
      clearInterval(notifIntervalRef.current)
      window.removeEventListener('hyperox:tickets-updated', loadNotifications)
    }
  }, [loadNotifications])

  const handleMarkAllRead = () => {
    const next = { readIds: notifications.map(n => n.id) }
    saveNotificationState(next)
    setNotifications(prev => prev.map(item => ({ ...item, read: true })))
  }

  const handleClearAll = () => {
    const next = { readIds: notifications.map(n => n.id) }
    saveNotificationState(next)
    setNotifications([])
  }

  const handleOpenNotification = (item) => {
    const state = loadNotificationState()
    const next = { readIds: Array.from(new Set([...(state.readIds || []), item.id])) }
    saveNotificationState(next)
    setNotifications(prev => prev.map(n => n.id === item.id ? { ...n, read: true } : n))
    router.push(item.href || '/overview')
  }

  return (
    <div className="app">
      <Sidebar userName={displayName || userName} userRole={role || userRole} navCounts={navCounts} />
      <main className="main">
        <Topbar
          breadcrumbs={crumbs}
          searchValue={searchValue}
          onSearchChange={onSearchChange}
          searchPlaceholder={searchPlaceholder}
          actions={topbarActions}
          region={region}
          notifications={notifications}
          onOpenItem={handleOpenNotification}
          onMarkAllRead={handleMarkAllRead}
          onClearAll={handleClearAll}
          onRefresh={() => router.reload()}
        />
        <div className="content">
          {(title || subtitle || actions) && (
            <div className="page-head">
              <div>
                {title && <h1 className="page-title">{title}</h1>}
                {subtitle && <p className="page-sub">{subtitle}</p>}
              </div>
              {actions && <div className="page-meta">{actions}</div>}
            </div>
          )}
          {children}
        </div>
      </main>
    </div>
  )
}
