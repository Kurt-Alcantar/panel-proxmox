import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import AppShell from '../../components/AppShell'
import { apiJson } from '../../lib/auth'

function StatusBadge({ status }) {
  const cfg = {
    online:     { cls: 'running',  label: 'Online' },
    offline:    { cls: 'stopped',  label: 'Offline' },
    error:      { cls: 'paused',   label: 'Error' },
    unenrolled: { cls: 'unknown',  label: 'Unenrolled' },
  }
  const s = cfg[status] || { cls: 'unknown', label: status || '—' }
  return <span className={`vm-status ${s.cls}`}>{s.label}</span>
}

export default function AssetsPage() {
  const router = useRouter()
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [osFilter, setOsFilter] = useState('all')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { setAssets(await apiJson('/api/assets') || []) }
    catch (err) { setError(err.message || 'Error cargando activos') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const stats = useMemo(() => ({
    total:   assets.length,
    online:  assets.filter(a => a.agent_status === 'online').length,
    offline: assets.filter(a => a.agent_status === 'offline').length,
    error:   assets.filter(a => a.agent_status === 'error').length,
  }), [assets])

  const filtered = useMemo(() => {
    let r = assets
    if (statusFilter !== 'all') r = r.filter(a => a.agent_status === statusFilter)
    if (osFilter !== 'all') r = r.filter(a => (a.os_type || '').toLowerCase() === osFilter)
    if (search) {
      const q = search.toLowerCase()
      r = r.filter(a => `${a.display_name || ''} ${a.host_name || ''} ${a.fleet_policy_name || ''} ${(a.ip_addresses || []).join(' ')}`.toLowerCase().includes(q))
    }
    return r
  }, [assets, statusFilter, osFilter, search])

  const ts = v => v ? new Date(v).toLocaleDateString('es-MX') : '—'

  const filters = [
    { type: 'status', values: [['all','Todos'],['online','Online'],['offline','Offline'],['error','Error'],['unenrolled','Unenrolled']], current: statusFilter, set: setStatusFilter },
    { type: 'os',     values: [['all','OS'],['windows','Windows'],['linux','Linux']], current: osFilter, set: setOsFilter },
  ]

  return (
    <AppShell
      title="Activos monitoreados"
      subtitle="Hosts con agente Fleet activo bajo observabilidad"
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Buscar por nombre, IP, policy..."
    >
      <div className="gridStats">
        {[
          { label: 'Total', value: stats.total },
          { label: 'Online', value: stats.online },
          { label: 'Offline', value: stats.offline },
          { label: 'Error', value: stats.error },
        ].map(s => (
          <div key={s.label} className="card statCard">
            <div className="statLabel">{s.label}</div>
            <div className="statValue">{s.value}</div>
          </div>
        ))}
      </div>

      {error && <div className="errorBox" style={{ marginBottom: 16 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        {filters.map(f => (
          <div key={f.type} className="poolFilterRow">
            {f.values.map(([val, label]) => (
              <button key={val} className={`chip${f.current === val ? ' active' : ''}`} onClick={() => f.set(val)}>{label}</button>
            ))}
          </div>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-4)', fontFamily: 'var(--font-mono)' }}>{filtered.length} activos</span>
      </div>

      {loading ? (
        <div className="card cardPad"><p className="muted">Cargando activos...</p></div>
      ) : filtered.length === 0 ? (
        <div className="card"><div className="emptyState">Sin activos{search || statusFilter !== 'all' ? ' con ese criterio' : ''}.</div></div>
      ) : (
        <div className="card">
          <div className="table-wrapp">
            <table className="table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Estado</th>
                  <th>OS</th>
                  <th>Versión agente</th>
                  <th>Último check-in</th>
                  <th>IPs</th>
                  <th>Policy</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(asset => (
                  <tr key={asset.id} style={{ cursor: 'pointer' }} onClick={() => router.push(`/assets/${asset.id}`)}>
                    <td><strong>{asset.display_name || asset.host_name || `Agent ${asset.fleet_agent_id?.slice(0, 8) || '—'}`}</strong></td>
                    <td><StatusBadge status={asset.agent_status} /></td>
                    <td>{asset.os_name || asset.os_type || '—'}</td>
                    <td><span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{asset.agent_version || '—'}</span></td>
                    <td>{ts(asset.last_checkin_at)}</td>
                    <td style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>{(asset.ip_addresses || []).slice(0, 2).join(', ') || '—'}</td>
                    <td>{asset.fleet_policy_name ? <span className="vmTag">{asset.fleet_policy_name}</span> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AppShell>
  )
}
