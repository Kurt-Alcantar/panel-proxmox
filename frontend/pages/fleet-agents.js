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

  const ts = (v) => {
    if (!v) return '—'
    const d = new Date(v)
    if (isNaN(d.getTime())) return '—'
    const mins = Math.round((Date.now() - d.getTime()) / 60000)
    if (mins < 1) return 'hace un momento'
    if (mins < 60) return `hace ${mins}m`
    if (mins < 1440) return `hace ${Math.round(mins / 60)}h`
    return d.toLocaleDateString('es-MX')
  }

  const onlineCnt  = agents.filter(a => a.status === 'online').length
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

      <div className="gridStats">
        {[
          { label: 'Total agentes',    value: agents.length },
          { label: 'Online',           value: onlineCnt },
          { label: 'Offline / Error',  value: offlineCnt },
          { label: 'Políticas activas',value: policies.length },
        ].map(s => (
          <div key={s.label} className="card statCard">
            <div className="statLabel">{s.label}</div>
            <div className="statValue">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="overview-card-head compact">
          <h3>Agentes registrados</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span className="ch-meta">{filtered.length} agentes</span>
            {lastSync && (
              <span style={{ fontSize: 11, color: 'var(--text-4)', fontFamily: 'var(--font-mono)' }}>
                Último sync: {ts(lastSync)}
              </span>
            )}
          </div>
        </div>
        <div className="table-wrapp">
          <table className="table">
            <thead>
              <tr><th>Host</th><th>Estado</th><th>Política</th><th>Versión</th><th>Último check-in</th></tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan="5" className="muted" style={{ padding: 20, textAlign: 'center' }}>Cargando agentes...</td></tr>}
              {!loading && filtered.map(agent => {
                const hostname    = agent.local_metadata?.host?.hostname || agent.id
                const version     = agent.local_metadata?.elastic?.agent?.version || agent.agent?.version || '—'
                const policyName  = policyMap[agent.policy_id] || agent.policy_id || '—'
                const isOnline    = agent.status === 'online'
                const dotColor    = isOnline ? 'var(--green)' : agent.status === 'error' ? 'var(--amber)' : 'var(--red)'
                return (
                  <tr key={agent.id || agent.agent?.id}>
                    <td>
                      <strong>{hostname}</strong>
                      <div style={{ fontSize: 10, color: 'var(--text-4)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                        {(agent.id || '').slice(0, 18)}...
                      </div>
                    </td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <span style={{
                          width: 7, height: 7, borderRadius: '50%', background: dotColor, flexShrink: 0,
                          animation: isOnline ? 'pulse 2s infinite' : 'none',
                        }} />
                        <span style={{ fontSize: 12, color: dotColor, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                          {agent.status || '—'}
                        </span>
                      </span>
                    </td>
                    <td><span className="vmTag">{policyName}</span></td>
                    <td><span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{version}</span></td>
                    <td>{ts(agent.last_checkin || null)}</td>
                  </tr>
                )
              })}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan="5" className="emptyState">Sin resultados.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  )
}
