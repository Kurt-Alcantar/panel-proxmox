import { useCallback, useEffect, useMemo, useState } from 'react'
import AppShell from '../components/AppShell'
import { apiJson } from '../lib/auth'

export default function FleetAgentsPage() {
  const [agents, setAgents] = useState([])
  const [policies, setPolicies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [lastSync, setLastSync] = useState(null)

  const load = useCallback(async () => {
    setError('')
    try {
      const [agentRows, policyRows] = await Promise.all([
        apiJson('/api/fleet/agents'),
        apiJson('/api/fleet/policies').catch(() => []),
      ])
      setAgents(agentRows)
      setPolicies(policyRows)
      setLastSync(new Date())
    } catch (err) {
      setError(err.message || 'No se pudieron cargar los agentes de Fleet')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => agents.filter(agent => {
    const text = `${agent.local_metadata?.host?.hostname || ''} ${agent.policy_id || ''} ${agent.status || ''}`.toLowerCase()
    return search ? text.includes(search.toLowerCase()) : true
  }), [agents, search])

  const policyMap = useMemo(() => Object.fromEntries(policies.map(p => [p.id, p.name])), [policies])

  const statusDot = (status) => {
    const colors = { online: 'var(--green)', offline: 'var(--red)', error: 'var(--amber)', degraded: 'var(--amber)' }
    const c = colors[status] || 'var(--text-4)'
    const isOnline = status === 'online'
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          width: 7, height: 7, borderRadius: '50%', background: c, flexShrink: 0,
          boxShadow: isOnline ? `0 0 0 2px ${c}33` : 'none',
          animation: isOnline ? 'pulse 2s infinite' : 'none',
        }} />
        <span style={{ fontSize: 12, color: c, fontWeight: 600 }}>{status || '—'}</span>
      </span>
    )
  }

  const ts = (v) => {
    if (!v) return '—'
    const d = new Date(v)
    if (isNaN(d)) return '—'
    const mins = Math.round((Date.now() - d.getTime()) / 60000)
    if (mins < 1) return 'hace un momento'
    if (mins < 60) return `hace ${mins}m`
    if (mins < 1440) return `hace ${Math.round(mins / 60)}h`
    return d.toLocaleDateString('es-MX')
  }

  const syncAgo = lastSync ? ts(lastSync) : '—'

  const onlineCnt = agents.filter(a => a.status === 'online').length
  const offlineCnt = agents.filter(a => a.status !== 'online').length

  return (
    <AppShell
      title="Fleet agents"
      subtitle="Inventario de agentes Fleet · sync automático cada 5 min"
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Buscar por host, policy, estado..."
    >
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>

      {error && <div className="errorBox" style={{ marginBottom: 16 }}>{error}</div>}

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total agentes', value: agents.length, color: 'var(--cyan)' },
          { label: 'Online', value: onlineCnt, color: 'var(--green)' },
          { label: 'Offline / Error', value: offlineCnt, color: 'var(--red)' },
          { label: 'Políticas activas', value: policies.length, color: 'var(--text-2)' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-4)', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="overview-card-head compact">
          <h3>Agentes registrados</h3>
          <span className="ch-meta" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span>{filtered.length} agentes</span>
            <span style={{ color: 'var(--text-4)', fontSize: 11 }}>Último sync: {syncAgo}</span>
          </span>
        </div>
        <div className="table-wrapp">
          <table className="table" style={{ fontSize: 13 }}>
            <thead>
              <tr>
                <th>Host</th>
                <th>Estado</th>
                <th>Política</th>
                <th>Versión</th>
                <th>Último check-in</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan="5" className="muted" style={{ padding: 20, textAlign: 'center' }}>Cargando agentes...</td></tr>}
              {!loading && filtered.map(agent => {
                const hostname = agent.local_metadata?.host?.hostname || agent.id
                const version = agent.local_metadata?.elastic?.agent?.version || agent.agent?.version || '—'
                const policyName = policyMap[agent.policy_id] || agent.policy_id || '—'
                const checkin = agent.last_checkin || null
                return (
                  <tr key={agent.id || agent.agent?.id}>
                    <td style={{ fontWeight: 600, color: 'var(--text)' }}>
                      {hostname}
                      <div style={{ fontSize: 11, color: 'var(--text-4)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                        {(agent.id || '').slice(0, 16)}...
                      </div>
                    </td>
                    <td>{statusDot(agent.status)}</td>
                    <td>
                      <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 'var(--r-xs)', background: 'var(--surface-3)', color: 'var(--text-3)' }}>
                        {policyName}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)' }}>{version}</td>
                    <td style={{ color: 'var(--text-3)' }}>{ts(checkin)}</td>
                  </tr>
                )
              })}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan="5" className="muted" style={{ padding: 20, textAlign: 'center' }}>Sin resultados.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  )
}
