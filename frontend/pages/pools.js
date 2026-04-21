import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import AppShell from '../components/AppShell'
import { apiJson, clearSession } from '../lib/auth'

export default function GruposPage() {
  const router = useRouter()
  const [pools, setPools] = useState([])
  const [vms, setVms] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState({})

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [poolRows, vmRows] = await Promise.all([
        apiJson('/api/pools').catch(() => apiJson('/api/infra/pools').catch(() => [])),
        apiJson('/api/my/vms').catch(() => []),
      ])
      setPools(poolRows); setVms(vmRows)
    } catch (err) {
      if (err.message === 'AUTH_EXPIRED') { clearSession(); router.replace('/login'); return }
      setError(err.message || 'No se pudieron cargar los grupos')
    } finally { setLoading(false) }
  }, [router])

  useEffect(() => { load() }, [load])

  const rows = useMemo(() => {
    const grouped = new Map()
    pools.forEach(pool => grouped.set(pool.external_id || pool.name, { ...pool, vms: [] }))
    vms.forEach(vm => {
      const key = vm.pool_id || 'Sin grupo'
      if (!grouped.has(key)) grouped.set(key, { id: key, name: key, external_id: key, vms: [] })
      grouped.get(key).vms.push(vm)
    })
    return [...grouped.values()]
      .filter(item => query ? `${item.name} ${item.external_id}`.toLowerCase().includes(query.toLowerCase()) : true)
      .sort((a, b) => b.vms.length - a.vms.length)
  }, [pools, vms, query])

  const toggle = (key) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }))

  return (
    <AppShell
      title="Grupos"
      subtitle="Agrupación de VMs Proxmox por grupo de infraestructura"
      searchValue={query}
      onSearchChange={setQuery}
      searchPlaceholder="Buscar grupo..."
    >
      {error && <div className="errorBox" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="gridStats">
        {[
          { label: 'Total grupos', value: rows.length },
          { label: 'Total VMs',    value: vms.length },
          { label: 'Running',      value: vms.filter(v => v.status === 'running').length },
          { label: 'Stopped',      value: vms.filter(v => v.status !== 'running').length },
        ].map(s => (
          <div key={s.label} className="card statCard">
            <div className="statLabel">{s.label}</div>
            <div className="statValue">{s.value}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="card cardPad"><div className="muted">Cargando grupos...</div></div>
      ) : (
        <div className="poolsWrapper">
          {rows.map(pool => {
            const key     = pool.external_id || pool.name
            const isOpen  = expanded[key]
            const running = pool.vms.filter(v => v.status === 'running').length
            return (
              <div key={key} className="poolSection">
                <div className="poolHeader" style={{ cursor: 'pointer' }} onClick={() => toggle(key)}>
                  <div className="poolHeaderLeft">
                    <span style={{
                      fontSize: 12, color: 'var(--text-3)',
                      transform: isOpen ? 'rotate(90deg)' : 'none',
                      transition: 'transform 0.2s', display: 'inline-block',
                    }}>▶</span>
                    <div>
                      <div className="poolHeaderTitle">{pool.name}</div>
                      <div className="poolHeaderMeta">{pool.external_id}</div>
                    </div>
                  </div>
                  <div className="poolHeaderRight">
                    <div className="vmMetric" style={{ textAlign: 'center', minWidth: 60 }}>
                      <div className="vmMetricLabel">VMs</div>
                      <div className="vmMetricValue" style={{ fontSize: 18 }}>{pool.vms.length}</div>
                    </div>
                    <div className="vmMetric" style={{ textAlign: 'center', minWidth: 60 }}>
                      <div className="vmMetricLabel">Running</div>
                      <div className="vmMetricValue" style={{ fontSize: 18, color: 'var(--green)' }}>{running}</div>
                    </div>
                    <span className={`vm-status ${running > 0 ? 'running' : 'stopped'}`}>
                      {running > 0 ? 'activo' : 'inactivo'}
                    </span>
                  </div>
                </div>

                {isOpen && (
                  <div className="table-wrapp" style={{ marginTop: 14, borderTop: '1px solid var(--border-soft)', paddingTop: 14 }}>
                    {pool.vms.length === 0 ? (
                      <div className="emptyState" style={{ padding: '20px 0' }}>Sin VMs asignadas</div>
                    ) : (
                      <table className="table">
                        <thead><tr><th>VM</th><th>VMID</th><th>Nodo</th><th>Estado</th></tr></thead>
                        <tbody>
                          {pool.vms.map(vm => (
                            <tr key={vm.vmid} style={{ cursor: 'pointer' }} onClick={() => router.push(`/vms/${vm.vmid}`)}>
                              <td><strong>{vm.name || `VM ${vm.vmid}`}</strong></td>
                              <td><span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{vm.vmid}</span></td>
                              <td>{vm.node || '—'}</td>
                              <td><span className={`vm-status ${vm.status === 'running' ? 'running' : 'stopped'}`}>{vm.status || '—'}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            )
          })}
          {rows.length === 0 && <div className="card"><div className="emptyState">Sin grupos disponibles.</div></div>}
        </div>
      )}
    </AppShell>
  )
}
