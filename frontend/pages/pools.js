import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import AppShell from '../components/AppShell'
import { apiJson, clearSession } from '../lib/auth'

export default function PoolsPage() {
  const router = useRouter()
  const [pools, setPools] = useState([])
  const [vms, setVms] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [poolRows, vmRows] = await Promise.all([
        apiJson('/api/pools').catch(() => apiJson('/api/infra/pools').catch(() => [])),
        apiJson('/api/my/vms').catch(() => []),
      ])
      setPools(poolRows)
      setVms(vmRows)
    } catch (err) {
      if (err.message === 'AUTH_EXPIRED') {
        clearSession(); router.replace('/login'); return
      }
      setError(err.message || 'No se pudieron cargar los pools')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { load() }, [load])

  const rows = useMemo(() => {
    const grouped = new Map()
    pools.forEach(pool => grouped.set(pool.external_id || pool.name, { ...pool, vms: [] }))
    vms.forEach(vm => {
      const key = vm.pool_id || 'Sin pool'
      if (!grouped.has(key)) grouped.set(key, { id: key, name: key, external_id: key, vms: [] })
      grouped.get(key).vms.push(vm)
    })
    return [...grouped.values()]
      .filter(item => query ? `${item.name} ${item.external_id}`.toLowerCase().includes(query.toLowerCase()) : true)
      .sort((a, b) => b.vms.length - a.vms.length)
  }, [pools, vms, query])

  return (
    <AppShell
      title="Pools"
      subtitle="Agrupación real de VMs por pool Proxmox con acceso directo al detalle."
      searchValue={query}
      onSearchChange={setQuery}
      actions={<button className="btn btn-secondary" onClick={load}>{loading ? 'Actualizando...' : 'Actualizar'}</button>}
    >
      {error && <div className="errorBox" style={{ marginBottom: 16 }}>{error}</div>}
      {loading ? <div className="card cardPad"><div className="muted">Cargando pools...</div></div> : (
        <div className="vmCardGrid">
          {rows.map((pool, idx) => {
            const running = pool.vms.filter(vm => vm.status === 'running').length
            const stopped = pool.vms.filter(vm => vm.status === 'stopped').length
            return (
              <div className="vmCard" key={pool.external_id || pool.name}>
                <div className="vmCardTop">
                  <div>
                    <div className="vmCardTitleBtn">{pool.name}</div>
                    <div className="vmCardTags"><span className="vmTag">{pool.external_id || 'manual'}</span></div>
                  </div>
                  <span className={`vm-status ${running ? 'running' : 'stopped'}`}>{running ? 'healthy' : 'idle'}</span>
                </div>
                <div className="vmMetrics">
                  <div className="vmMetric"><div className="vmMetricLabel">VMs</div><div className="vmMetricValue">{pool.vms.length}</div></div>
                  <div className="vmMetric"><div className="vmMetricLabel">Running</div><div className="vmMetricValue">{running}</div></div>
                  <div className="vmMetric"><div className="vmMetricLabel">Stopped</div><div className="vmMetricValue">{stopped}</div></div>
                </div>
                <div className="table-wrapp" style={{ marginTop: 14 }}>
                  <table className="table">
                    <thead><tr><th>VM</th><th>Node</th><th>Status</th></tr></thead>
                    <tbody>
                      {pool.vms.slice(0, 5).map(vm => (
                        <tr key={vm.vmid} style={{ cursor: 'pointer' }} onClick={() => router.push(`/vms/${vm.vmid}`)}>
                          <td>{vm.name || `VM ${vm.vmid}`}</td>
                          <td>{vm.node || '-'}</td>
                          <td>{vm.status || '-'}</td>
                        </tr>
                      ))}
                      {pool.vms.length === 0 && <tr><td colSpan="3" className="muted">Sin VMs asignadas</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </AppShell>
  )
}
