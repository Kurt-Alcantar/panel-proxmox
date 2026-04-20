import { useCallback, useEffect, useMemo, useState } from 'react'
import AppShell from '../components/AppShell'
import { apiJson } from '../lib/auth'

export default function FleetAgentsPage() {
  const [agents, setAgents] = useState([])
  const [policies, setPolicies] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [agentRows, policyRows] = await Promise.all([
        apiJson('/api/fleet/agents'),
        apiJson('/api/fleet/policies').catch(() => []),
      ])
      setAgents(agentRows)
      setPolicies(policyRows)
    } catch (err) {
      setError(err.message || 'No se pudieron cargar los agentes de Fleet')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const triggerSync = async () => {
    setBusy(true)
    setError('')
    try {
      await apiJson('/api/fleet/sync', { method: 'POST' })
      await load()
    } catch (err) {
      setError(err.message || 'No se pudo ejecutar el sync de Fleet')
    } finally {
      setBusy(false)
    }
  }

  const filtered = useMemo(() => agents.filter(agent => {
    const text = `${agent.local_metadata?.host?.hostname || ''} ${agent.policy_id || ''} ${agent.current_error_events || ''} ${agent.status || ''}`.toLowerCase()
    return search ? text.includes(search.toLowerCase()) : true
  }), [agents, search])

  const policyMap = useMemo(() => Object.fromEntries(policies.map(p => [p.id, p.name])), [policies])

  return (
    <AppShell
      title="Fleet agents"
      subtitle="Inventario real de agentes Fleet y políticas activas."
      searchValue={search}
      onSearchChange={setSearch}
      actions={<div className="overview-toolbar"><button className="btn btn-secondary" onClick={load}>Refresh</button><button className="btn btn-primary" onClick={triggerSync} disabled={busy}>{busy ? 'Sincronizando...' : 'Sync assets'}</button></div>}
    >
      {error && <div className="errorBox" style={{ marginBottom: 16 }}>{error}</div>}
      <div className="card">
        <div className="overview-card-head compact">
          <h3>Registered agents</h3>
          <span className="ch-meta">{filtered.length} agents · {policies.length} policies</span>
        </div>
        <div className="table-wrapp">
          <table className="table">
            <thead>
              <tr><th>Host</th><th>Status</th><th>Policy</th><th>Version</th><th>Last check-in</th></tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan="5" className="muted">Cargando agentes...</td></tr>}
              {!loading && filtered.map(agent => (
                <tr key={agent.id || agent.agent?.id}>
                  <td>{agent.local_metadata?.host?.hostname || agent.id}</td>
                  <td>{agent.status || '-'}</td>
                  <td>{policyMap[agent.policy_id] || agent.policy_id || '-'}</td>
                  <td>{agent.local_metadata?.elastic?.agent?.version || agent.agent?.version || '-'}</td>
                  <td>{agent.last_checkin || '-'}</td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && <tr><td colSpan="5" className="muted">Sin resultados.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  )
}
