import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import AppShell from '../components/AppShell'
import { apiJson, clearSession } from '../lib/auth'
import { loadTickets } from '../lib/panel'

function buildAlertFeed(assets = [], audit = [], tickets = []) {
  const generated = []

  assets.filter(asset => ['offline', 'error', 'unenrolled'].includes(asset.agent_status)).forEach(asset => {
    generated.push({
      id: `asset-${asset.id}`,
      title: `${asset.display_name || asset.host_name || 'Asset'} con estado ${asset.agent_status}`,
      source: asset.fleet_policy_name || 'fleet',
      rule: 'agent_status != online',
      severity: asset.agent_status === 'error' ? 'critical' : 'warning',
      href: `/assets/${asset.id}`,
      updatedAt: new Date().toISOString(),
      kind: 'asset',
    })
  })

  audit.slice(0, 25).forEach(row => {
    if (/error|fail|forbidden|denied/i.test(`${row.action || ''} ${row.result || ''}`)) {
      generated.push({
        id: `audit-${row.id}`,
        title: row.action || 'Audit event',
        source: row.target || 'audit',
        rule: row.result || 'error',
        severity: 'critical',
        href: '/audit',
        updatedAt: row.created_at,
        kind: 'audit',
      })
    }
  })

  tickets.filter(t => t.status !== 'closed').forEach(ticket => {
    generated.push({
      id: `ticket-${ticket.id}`,
      title: ticket.title,
      source: ticket.owner || 'support',
      rule: ticket.status,
      severity: ticket.priority === 'high' ? 'critical' : 'warning',
      href: '/support',
      updatedAt: ticket.updatedAt,
      kind: 'ticket',
    })
  })

  return generated.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
}

export default function AlertsPage() {
  const router = useRouter()
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [severity, setSeverity] = useState('all')
  const [query, setQuery] = useState('')
  const [resolvedIds, setResolvedIds] = useState([])

  useEffect(() => {
    try {
      setResolvedIds(JSON.parse(localStorage.getItem('hyperox_resolved_alerts_v1') || '[]'))
    } catch {
      setResolvedIds([])
    }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [assets, audit] = await Promise.all([
        apiJson('/api/assets').catch(() => []),
        apiJson('/api/audit').catch(() => []),
      ])
      const tickets = loadTickets()
      setAlerts(buildAlertFeed(assets, audit, tickets))
    } catch (err) {
      if (err.message === 'AUTH_EXPIRED') {
        clearSession()
        router.replace('/login')
        return
      }
      setError(err.message || 'No se pudieron cargar las alertas')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { load() }, [load])

  const visible = useMemo(() => alerts
    .filter(item => !resolvedIds.includes(item.id))
    .filter(item => severity === 'all' ? true : item.severity === severity)
    .filter(item => query ? `${item.title} ${item.source} ${item.rule}`.toLowerCase().includes(query.toLowerCase()) : true)
  , [alerts, resolvedIds, severity, query])

  const resolveAlert = (id) => {
    const next = Array.from(new Set([...resolvedIds, id]))
    setResolvedIds(next)
    localStorage.setItem('hyperox_resolved_alerts_v1', JSON.stringify(next))
  }

  return (
    <AppShell
      title="Alerts"
      subtitle="Incidentes agregados desde estado de activos, auditoría y tickets abiertos."
      searchValue={query}
      onSearchChange={setQuery}
      actions={
        <div className="overview-toolbar">
          <button className={`chip ${severity === 'all' ? 'active' : ''}`} onClick={() => setSeverity('all')}>All</button>
          <button className={`chip ${severity === 'warning' ? 'active' : ''}`} onClick={() => setSeverity('warning')}>Warning</button>
          <button className={`chip ${severity === 'critical' ? 'active' : ''}`} onClick={() => setSeverity('critical')}>Critical</button>
          <button className="btn btn-secondary" onClick={load}>Actualizar</button>
        </div>
      }
    >
      {error && <div className="errorBox" style={{ marginBottom: 16 }}>{error}</div>}
      <div className="card">
        <div className="overview-card-head compact">
          <h3>Open incidents</h3>
          <span className="ch-meta">{visible.length} active</span>
        </div>
        <div className="overview-list-wrap">
          {loading && <div className="cardPad muted">Cargando alertas...</div>}
          {!loading && visible.length === 0 && <div className="emptyState">Sin alertas activas para ese filtro.</div>}
          {!loading && visible.map((alert) => (
            <div className="alert-row" key={alert.id}>
              <span className={`alert-accent ${alert.severity}`} />
              <div style={{ flex: 1 }}>
                <div className="alert-title">{alert.title}</div>
                <div className="alert-meta">{alert.source} · {alert.rule}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => router.push(alert.href)}>Abrir</button>
                <button className="btn btn-secondary btn-sm" onClick={() => resolveAlert(alert.id)}>Resolver</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  )
}
