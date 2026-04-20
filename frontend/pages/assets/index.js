import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import AppShell from '../../components/AppShell'
import { apiJson } from '../../lib/auth'

const STATUS_CONFIG = {
  online:     { label: 'Online',     color: 'var(--green)',  bg: 'var(--green-dim)' },
  offline:    { label: 'Offline',    color: 'var(--red)',    bg: 'var(--red-dim)' },
  error:      { label: 'Error',      color: 'var(--amber)',  bg: 'var(--amber-dim)' },
  unenrolled: { label: 'Unenrolled', color: 'var(--text-4)', bg: 'var(--surface-3)' },
}

function StatusBadge({ status }) {
  const s = STATUS_CONFIG[status] || { label: status || '—', color: 'var(--text-4)', bg: 'var(--surface-3)' }
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 'var(--r-sm)',
      background: s.bg, color: s.color, whiteSpace: 'nowrap',
    }}>
      {s.label}
    </span>
  )
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
    setLoading(true)
    setError('')
    try {
      const data = await apiJson('/api/assets')
      setAssets(data || [])
    } catch (err) {
      setError(err.message || 'Error cargando activos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const stats = useMemo(() => ({
    total:   assets.length,
    online:  assets.filter(a => a.agent_status === 'online').length,
    offline: assets.filter(a => a.agent_status === 'offline').length,
    error:   assets.filter(a => a.agent_status === 'error').length,
  }), [assets])

  const filtered = useMemo(() => {
    let result = assets
    if (statusFilter !== 'all') result = result.filter(a => a.agent_status === statusFilter)
    if (osFilter !== 'all') result = result.filter(a => (a.os_type || '').toLowerCase() === osFilter)
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(a => `${a.display_name || ''} ${a.host_name || ''} ${a.fleet_policy_name || ''} ${(a.ip_addresses || []).join(' ')}`.toLowerCase().includes(q))
    }
    return result
  }, [assets, statusFilter, osFilter, search])

  const ts = (v) => v ? new Date(v).toLocaleDateString('es-MX') : '—'

  return (
    <AppShell
      title="Activos monitoreados"
      subtitle="Hosts con agente Fleet activo bajo observabilidad"
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Buscar por nombre, IP, policy..."
    >
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total', value: stats.total, color: 'var(--cyan)' },
          { label: 'Online', value: stats.online, color: 'var(--green)' },
          { label: 'Offline', value: stats.offline, color: 'var(--red)' },
          { label: 'Error', value: stats.error, color: 'var(--amber)' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-4)', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {error && <div className="errorBox" style={{ marginBottom: 16 }}>{error}</div>}

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', background: 'var(--surface-2)', borderRadius: 'var(--r-md)', padding: 2, gap: 2 }}>
          {[['all','Todos'],['online','Online'],['offline','Offline'],['error','Error'],['unenrolled','Unenrolled']].map(([val, label]) => (
            <button key={val} onClick={() => setStatusFilter(val)} style={{
              padding: '4px 10px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
              borderRadius: 'var(--r-sm)', background: statusFilter === val ? 'var(--surface-3)' : 'transparent',
              color: statusFilter === val ? 'var(--text)' : 'var(--text-3)',
            }}>{label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', background: 'var(--surface-2)', borderRadius: 'var(--r-md)', padding: 2, gap: 2 }}>
          {[['all','OS'],['windows','Windows'],['linux','Linux']].map(([val, label]) => (
            <button key={val} onClick={() => setOsFilter(val)} style={{
              padding: '4px 10px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
              borderRadius: 'var(--r-sm)', background: osFilter === val ? 'var(--surface-3)' : 'transparent',
              color: osFilter === val ? 'var(--text)' : 'var(--text-3)',
            }}>{label}</button>
          ))}
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-4)', marginLeft: 'auto' }}>{filtered.length} activos</span>
      </div>

      {loading ? (
        <div className="card cardPad"><p className="muted">Cargando activos...</p></div>
      ) : filtered.length === 0 ? (
        <div className="card cardPad"><div className="emptyState">Sin activos{search || statusFilter !== 'all' ? ' con ese criterio' : ''}.</div></div>
      ) : (
        <div className="card">
          <div className="table-wrapp">
            <table className="table" style={{ fontSize: 13 }}>
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
                  <tr
                    key={asset.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => router.push(`/assets/${asset.id}`)}
                  >
                    <td style={{ fontWeight: 600, color: 'var(--text)' }}>
                      {asset.display_name || asset.host_name || `Agent ${asset.fleet_agent_id?.slice(0, 8) || '—'}`}
                    </td>
                    <td><StatusBadge status={asset.agent_status} /></td>
                    <td style={{ color: 'var(--text-2)' }}>{asset.os_name || asset.os_type || '—'}</td>
                    <td style={{ color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>{asset.agent_version || '—'}</td>
                    <td style={{ color: 'var(--text-3)' }}>{ts(asset.last_checkin_at)}</td>
                    <td style={{ color: 'var(--text-3)', fontSize: 11 }}>
                      {(asset.ip_addresses || []).slice(0, 2).join(', ') || '—'}
                    </td>
                    <td style={{ color: 'var(--text-4)', fontSize: 11 }}>{asset.fleet_policy_name || '—'}</td>
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
