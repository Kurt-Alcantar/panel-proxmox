import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import AppShell from '../components/AppShell'

const STATUS_LABELS = {
  online: { label: 'Online', cls: 'running' },
  offline: { label: 'Offline', cls: 'stopped' },
  error: { label: 'Error', cls: 'stopped' },
  unenrolled: { label: 'Unenrolled', cls: 'unknown' },
}

function StatusBadge({ status }) {
  const s = STATUS_LABELS[status] || { label: status || 'Desconocido', cls: 'unknown' }
  return <span className={`vm-status ${s.cls}`}>{s.label}</span>
}

export default function AssetsPage() {
  const router = useRouter()
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  const clearSession = useCallback(() => {
    localStorage.removeItem('token')
    localStorage.removeItem('refresh_token')
    router.replace('/login')
  }, [router])

  const authFetch = useCallback(async (url, options = {}) => {
    const token = localStorage.getItem('token')
    if (!token) { clearSession(); throw new Error('Sesión expirada') }
    const res = await fetch(url, {
      ...options,
      headers: { ...(options.headers || {}), Authorization: `Bearer ${token}` },
    })
    if (res.status === 401) { clearSession(); throw new Error('Sesión expirada') }
    return res
  }, [clearSession])

  const loadAssets = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await authFetch('/api/assets')
      if (!res.ok) throw new Error('No se pudieron obtener los activos')
      setAssets(await res.json())
    } catch (err) {
      setError(err.message || 'Error cargando activos')
    } finally {
      setLoading(false)
    }
  }, [authFetch])

  useEffect(() => { loadAssets() }, [loadAssets])

  const stats = useMemo(() => ({
    total: assets.length,
    online: assets.filter(a => a.agent_status === 'online').length,
    offline: assets.filter(a => a.agent_status === 'offline').length,
    external: assets.filter(a => a.is_external).length,
  }), [assets])

  const filtered = useMemo(() => {
    if (!search) return assets
    const q = search.toLowerCase()
    return assets.filter(a => {
      const name = (a.display_name || a.host_name || '').toLowerCase()
      const policy = (a.fleet_policy_name || '').toLowerCase()
      return name.includes(q) || policy.includes(q)
    })
  }, [assets, search])

  return (
    <AppShell
      title="Activos monitoreados"
      subtitle="Hosts enrolados en Fleet con observabilidad disponible"
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Buscar por nombre, policy..."
      actions={
        <button className="btn btnSecondary" onClick={loadAssets} disabled={loading}>
          {loading ? 'Actualizando...' : 'Actualizar'}
        </button>
      }
    >
      {/* Stats */}
      <div className="gridStats" style={{ marginBottom: 24 }}>
        {[
          { label: 'Total activos', value: stats.total },
          { label: 'Online', value: stats.online },
          { label: 'Offline', value: stats.offline },
          { label: 'Externos', value: stats.external },
        ].map(s => (
          <div key={s.label} className="card statCard">
            <div className="statLabel">{s.label}</div>
            <div className="statValue">{s.value}</div>
          </div>
        ))}
      </div>

      {error && <div className="errorBox" style={{ marginBottom: 16 }}>{error}</div>}

      {loading ? (
        <div className="card cardPad"><p className="muted">Cargando activos...</p></div>
      ) : filtered.length === 0 ? (
        <div className="card cardPad"><div className="emptyState">Sin activos{search ? ' con ese criterio' : ''}.</div></div>
      ) : (
        <div className="vmCardGrid">
          {filtered.map(asset => (
            <div
              key={asset.id}
              className="vmCard"
              style={{ cursor: 'pointer' }}
              onClick={() => router.push(`/assets/${asset.id}`)}
            >
              <div className="vmCardTop">
                <div>
                  <button className="vmCardTitleBtn" onClick={e => { e.stopPropagation(); router.push(`/assets/${asset.id}`) }}>
                    {asset.display_name || asset.host_name || `Agent ${asset.fleet_agent_id?.slice(0, 8) || '—'}`}
                  </button>
                  <div className="vmCardTags" style={{ marginTop: 8 }}>
                    {asset.is_external && <span className="vmTag" style={{ color: 'var(--info)', borderColor: 'rgba(56,189,248,0.3)' }}>Externo</span>}
                    {asset.fleet_policy_name && <span className="vmTag">{asset.fleet_policy_name}</span>}
                  </div>
                </div>
                <StatusBadge status={asset.agent_status} />
              </div>

              <div className="vmMetrics">
                {[
                  { label: 'OS', value: asset.os_name || asset.os_type || '—' },
                  { label: 'Versión agente', value: asset.agent_version || '—' },
                  { label: 'Último check-in', value: asset.last_checkin_at ? new Date(asset.last_checkin_at).toLocaleDateString('es-MX') : '—' },
                ].map(m => (
                  <div key={m.label} className="vmMetric">
                    <div className="vmMetricLabel">{m.label}</div>
                    <div className="vmMetricValue" style={{ fontSize: 13 }}>{m.value}</div>
                  </div>
                ))}
              </div>

              {asset.ip_addresses?.length > 0 && (
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                  IP: {asset.ip_addresses.slice(0, 2).join(', ')}{asset.ip_addresses.length > 2 ? ` +${asset.ip_addresses.length - 2}` : ''}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </AppShell>
  )
}