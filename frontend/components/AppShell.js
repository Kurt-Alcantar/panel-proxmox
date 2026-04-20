import Link from 'next/link'
import { useRouter } from 'next/router'
import { useMemo } from 'react'

const Icon = ({ name, size = 16, className = '' }) => {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    className,
  }

  const paths = {
    overview: <><rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/></>,
    dashboard: <><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></>,
    assets: <><rect x="3" y="4" width="18" height="6" rx="1.5"/><rect x="3" y="14" width="18" height="6" rx="1.5"/><circle cx="7" cy="7" r="0.8" fill="currentColor" stroke="none"/><circle cx="7" cy="17" r="0.8" fill="currentColor" stroke="none"/></>,
    vms: <><rect x="3" y="3" width="18" height="14" rx="1.5"/><path d="M3 12h18"/><path d="M8 21h8"/><path d="M12 17v4"/></>,
    alerts: <><path d="M12 3l9 16H3l9-16z"/><path d="M12 10v4"/><circle cx="12" cy="17" r="0.7" fill="currentColor" stroke="none"/></>,
    audit: <><rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M8 8h8"/><path d="M8 12h8"/><path d="M8 16h5"/></>,
    tickets: <><path d="M4 7a2 2 0 012-2h12a2 2 0 012 2v3a2 2 0 000 4v3a2 2 0 01-2 2H6a2 2 0 01-2-2v-3a2 2 0 000-4V7z"/><path d="M12 6v12" strokeDasharray="2 2"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M1 12h4M19 12h4M4.2 4.2l2.8 2.8M17 17l2.8 2.8M4.2 19.8L7 17M17 7l2.8-2.8"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></>,
    bell: <><path d="M6 8a6 6 0 0112 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21a2 2 0 004 0"/></>,
    refresh: <><path d="M21 12a9 9 0 11-3-6.7L21 8"/><path d="M21 3v5h-5"/></>,
    pool: <><path d="M4 6c2 1 4 0 4 0s2-1 4 0 4 0 4 0 2-1 4 0"/><path d="M4 12c2 1 4 0 4 0s2-1 4 0 4 0 4 0 2-1 4 0"/><path d="M4 18c2 1 4 0 4 0s2-1 4 0 4 0 4 0 2-1 4 0"/></>,
    terminal: <><rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M7 9l3 3-3 3"/><path d="M13 15h4"/></>,
    tenant: <><path d="M3 21V9l9-6 9 6v12"/><path d="M9 21v-6h6v6"/></>,
    dots: <><circle cx="12" cy="5" r="1.2" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="12" cy="19" r="1.2" fill="currentColor" stroke="none"/></>,
    export: <><path d="M12 3v12"/><path d="M8 11l4 4 4-4"/><path d="M5 21h14"/></>,
    plus: <><path d="M12 5v14"/><path d="M5 12h14"/></>,
    globe: <><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a15 15 0 010 18"/><path d="M12 3a15 15 0 000 18"/></>,
    chevronRight: <><path d="M9 6l6 6-6 6"/></>,
  }

  return <svg {...common}>{paths[name] || null}</svg>
}

const DEFAULT_NAV = [
  {
    title: 'Observability',
    items: [
      { href: '/overview', icon: 'overview', label: 'Overview' },
      { href: '/assets', icon: 'assets', label: 'Managed assets' },
      { href: '/alerts', icon: 'alerts', label: 'Alerts' },
      { href: '/audit', icon: 'audit', label: 'Audit log' },
    ],
  },
  {
    title: 'Infrastructure',
    items: [
      { href: '/vms', icon: 'vms', label: 'Proxmox VMs' },
      { href: '/pools', icon: 'pool', label: 'Pools' },
      { href: '/fleet-agents', icon: 'terminal', label: 'Fleet agents' },
    ],
  },
  {
    title: 'Admin',
    items: [
      { href: '/admin', icon: 'tenant', label: 'Tenants & access' },
      { href: '/support', icon: 'tickets', label: 'Support tickets' },
      { href: '/settings', icon: 'settings', label: 'Settings' },
    ],
  },
]

function Sidebar({ userName, userRole, navCounts }) {
  const router = useRouter()
  const path = router.pathname

  const nav = useMemo(() => DEFAULT_NAV.map(group => ({
    ...group,
    items: group.items.map(item => ({
      ...item,
      count: navCounts?.[item.href] ?? item.count,
    })),
  })), [navCounts])

  const isActive = (href) => {
    if (href === '/assets') return path.startsWith('/assets')
    if (href === '/vms') return path.startsWith('/vms')
    return path === href
  }

  const initials = (userName || 'U')
    .split(' ')
    .map(s => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const logout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token')
      localStorage.removeItem('refresh_token')
    }
    router.replace('/login')
  }

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark" />
        <div className="brand-name">Hyperox</div>
        <div className="brand-env mono">v2.0</div>
      </div>

      <div className="sidebar-content">
        {nav.map(group => (
          <div className="nav-group" key={group.title}>
            <div className="nav-title">{group.title}</div>
            {group.items.map(item => {
              const active = isActive(item.href)
              return (
                <Link className={`nav-item${active ? ' active' : ''}`} href={item.href} key={item.href}>
                  <Icon name={item.icon} className="ni-ico" />
                  <span>{item.label}</span>
                  {item.count != null && <span className="ni-count">{item.count}</span>}
                </Link>
              )
            })}
          </div>
        ))}
      </div>

      <div className="sidebar-foot">
        <div className="user-card">
          <div className="user-avatar">{initials}</div>
          <div className="user-info">
            <div className="user-name">{userName || 'K. Alcantar'}</div>
            <div className="user-role mono">{userRole || 'platform_admin'}</div>
          </div>
          <button className="user-menu-btn" onClick={logout} title="Cerrar sesión">
            <Icon name="dots" size={14} />
          </button>
        </div>
      </div>
    </aside>
  )
}

function Topbar({ breadcrumbs, searchValue, onSearchChange, searchPlaceholder, actions, region }) {
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

      <div className="topbar-search">
        <Icon name="search" className="ts-ico" />
        <input
          placeholder={searchPlaceholder || 'Search assets, agents, tenants...'}
          value={searchValue || ''}
          onChange={(e) => onSearchChange?.(e.target.value)}
        />
        <span className="ts-kbd">⌘K</span>
      </div>

      <div className="topbar-actions">
        {actions}
        <div className="tb-region">
          <span className="region-dot" />
          {region || 'mx-central-1'}
        </div>
        <button className="tb-btn tb-btn-icon" title="Notificaciones">
          <Icon name="bell" />
          <span className="tb-badge">3</span>
        </button>
        <button className="tb-btn tb-btn-icon" title="Refresh">
          <Icon name="refresh" />
        </button>
      </div>
    </div>
  )
}

export function ShellIcon(props) {
  return <Icon {...props} />
}

export default function AppShell({
  title,
  subtitle,
  breadcrumbs,
  children,
  actions,
  searchValue = '',
  onSearchChange,
  searchPlaceholder,
  topbarActions,
  userName,
  userRole,
  navCounts,
  region,
}) {
  const crumbs = breadcrumbs || (title ? ['Hyperox', title] : ['Hyperox'])

  return (
    <div className="app">
      <Sidebar userName={userName} userRole={userRole} navCounts={navCounts} />

      <main className="main">
        <Topbar
          breadcrumbs={crumbs}
          searchValue={searchValue}
          onSearchChange={onSearchChange}
          searchPlaceholder={searchPlaceholder}
          actions={topbarActions}
          region={region}
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
