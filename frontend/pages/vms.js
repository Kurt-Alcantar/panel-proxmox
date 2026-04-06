import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'

export default function VmsPage() {
  const router = useRouter()
  const [vms, setVms] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState(null)
  const [selectedPool, setSelectedPool] = useState('ALL')

  const fetchVMs = async () => {
    const token = localStorage.getItem('token')

    if (!token) {
      router.replace('/login')
      return
    }

    try {
      const res = await fetch('/api/my/vms', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })

      if (res.status === 401) {
        localStorage.removeItem('token')
        localStorage.removeItem('refresh_token')
        router.replace('/login')
        return
      }

      if (!res.ok) {
        throw new Error('No se pudieron obtener las VMs')
      }

      const data = await res.json()
      setVms(data)
    } catch (err) {
      setError(err.message || 'Error cargando VMs')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchVMs()
  }, [])

  const stats = useMemo(() => {
    const running = vms.filter((vm) => vm.status === 'running').length
    const stopped = vms.filter((vm) => vm.status === 'stopped').length
    const paused = vms.filter((vm) => vm.status === 'paused').length

    return {
      total: vms.length,
      running,
      stopped,
      paused
    }
  }, [vms])

  const poolEntries = useMemo(() => {
    const grouped = {}

    for (const vm of vms) {
      const pool = vm.pool_id || 'Sin pool'
      if (!grouped[pool]) grouped[pool] = []
      grouped[pool].push(vm)
    }

    return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b))
  }, [vms])

  const filteredPools = useMemo(() => {
    if (selectedPool === 'ALL') return poolEntries
    return poolEntries.filter(([poolName]) => poolName === selectedPool)
  }, [poolEntries, selectedPool])

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('refresh_token')
    router.replace('/login')
  }

  const action = async (vmid, type) => {
    const token = localStorage.getItem('token')
    setActionLoading(`${vmid}-${type}`)
    setError('')

    try {
      const res = await fetch(`/api/vms/${vmid}/${type}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        }
      })

      if (res.status === 401) {
        localStorage.removeItem('token')
        localStorage.removeItem('refresh_token')
        router.replace('/login')
        return
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.message || `No se pudo ejecutar ${type}`)
      }

      await fetchVMs()
    } catch (err) {
      setError(err.message || 'Error ejecutando acción')
    } finally {
      setActionLoading(null)
    }
  }

  const openConsole = async (vmid) => {
    const token = localStorage.getItem('token')
    setActionLoading(`${vmid}-console`)
    setError('')

    try {
      const res = await fetch(`/api/vms/${vmid}/console`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        }
      })

      if (res.status === 401) {
        localStorage.removeItem('token')
        localStorage.removeItem('refresh_token')
        router.replace('/login')
        return
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.message || 'No se pudo abrir la consola')
      }

      const data = await res.json()

      if (data.url) {
        window.open(data.url, '_blank', 'noopener,noreferrer')
      }
    } catch (err) {
      setError(err.message || 'Error abriendo consola')
    } finally {
      setActionLoading(null)
    }
  }

  const badgeClass = (status) => {
    if (status === 'running') return 'vm-status running'
    if (status === 'stopped') return 'vm-status stopped'
    if (status === 'paused') return 'vm-status paused'
    return 'vm-status unknown'
  }

  const formatBytes = (value) => {
    const n = Number(value || 0)
    if (!n) return '0 GB'
    return `${(n / 1024 / 1024 / 1024).toFixed(1)} GB`
  }

  return (
    <div className="portal-shell">
      <aside className="portal-sidebar">
        <div className="portal-brand">
          <div className="portal-brand-badge">HX</div>
          <div>
            <div className="portal-brand-title">HYPEROX</div>
            <div className="portal-brand-sub">VM Portal</div>
          </div>
        </div>

        <div className="portal-divider" />

        <div className="sidebar-section-title">Resumen</div>

        <div className="summary-grid">
          <div className="summary-card">
            <div className="summary-label">TOTAL</div>
            <div className="summary-value">{stats.total}</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">ON</div>
            <div className="summary-value green">{stats.running}</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">OFF</div>
            <div className="summary-value red">{stats.stopped}</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">PAUSE</div>
            <div className="summary-value yellow">{stats.paused}</div>
          </div>
        </div>

        <div className="portal-divider" />

        <div className="sidebar-section-title">Pools</div>

        <button
          className={`pool-filter ${selectedPool === 'ALL' ? 'active' : ''}`}
          onClick={() => setSelectedPool('ALL')}
        >
          <span>Todos</span>
          <span className="pool-count">{vms.length}</span>
        </button>

        {poolEntries.map(([poolName, items], idx) => (
          <button
            key={poolName}
            className={`pool-filter ${selectedPool === poolName ? 'active' : ''}`}
            onClick={() => setSelectedPool(poolName)}
          >
            <span className={`pool-dot color-${idx % 6}`} />
            <span className="pool-name">{poolName}</span>
            <span className="pool-count">{items.length}</span>
          </button>
        ))}

        <div className="sidebar-spacer" />

        <button className="portal-logout" onClick={logout}>
          Cerrar sesión
        </button>
      </aside>

      <main className="portal-main">
        <div className="portal-topbar">
          <div>
            <h1 className="portal-title">Todos los pools</h1>
            <div className="portal-subtitle">
              {stats.total} VMs visibles en tu tenant
            </div>
          </div>

          <div className="portal-actions">
            <button className="portal-btn secondary" onClick={fetchVMs}>
              Actualizar
            </button>
          </div>
        </div>

        {loading && <div className="portal-info">Cargando...</div>}
        {error && <div className="portal-error">{error}</div>}

        {!loading && filteredPools.length === 0 && (
          <div className="portal-info">No hay VMs disponibles.</div>
        )}

        {!loading &&
          filteredPools.map(([poolName, items], poolIndex) => {
            const running = items.filter((vm) => vm.status === 'running').length
            const stopped = items.filter((vm) => vm.status === 'stopped').length

            return (
              <section key={poolName} className="pool-section">
                <div className="pool-header">
                  <div className="pool-header-left">
                    <span className={`pool-dot large color-${poolIndex % 6}`} />
                    <div className="pool-header-title">{poolName}</div>
                    <div className="pool-header-meta">{items.length} VM{items.length !== 1 ? 's' : ''}</div>
                  </div>

                  <div className="pool-header-right">
                    {running > 0 && <span className="mini-badge success">{running} encendida{running !== 1 ? 's' : ''}</span>}
                    {stopped > 0 && <span className="mini-badge danger">{stopped} apagada{stopped !== 1 ? 's' : ''}</span>}
                  </div>
                </div>

                <div className="vm-card-grid">
                  {items.map((vm) => (
                    <div key={vm.id} className="vm-card">
                      <div className="vm-card-top">
                        <div>
                          <button
                            className="vm-card-title-btn"
                            onClick={() => router.push(`/vms/${vm.vmid}`)}
                          >
                            {vm.name}
                          </button>
                          <div className="vm-card-tags">
                            <span className="vm-tag">VM {vm.vmid}</span>
                            <span className="vm-tag">{vm.node}</span>
                          </div>
                        </div>

                        <span className={badgeClass(vm.status)}>
                          {vm.status === 'running'
                            ? 'Encendida'
                            : vm.status === 'stopped'
                            ? 'Apagada'
                            : vm.status || 'Unknown'}
                        </span>
                      </div>

                      <div className="vm-metrics">
                        <div className="vm-metric">
                          <div className="vm-metric-label">CPU</div>
                          <div className="vm-metric-value">{vm.cpu || 0} vCPU</div>
                        </div>
                        <div className="vm-metric">
                          <div className="vm-metric-label">RAM</div>
                          <div className="vm-metric-value">{formatBytes(vm.memory)}</div>
                        </div>
                        <div className="vm-metric">
                          <div className="vm-metric-label">DISCO</div>
                          <div className="vm-metric-value">{formatBytes(vm.disk)}</div>
                        </div>
                      </div>

                      <div className="vm-actions">
                        <button
                          className="portal-btn tiny"
                          onClick={() => action(vm.vmid, 'start')}
                          disabled={actionLoading === `${vm.vmid}-start`}
                        >
                          {actionLoading === `${vm.vmid}-start` ? '...' : 'Encender'}
                        </button>

                        <button
                          className="portal-btn tiny secondary"
                          onClick={() => action(vm.vmid, 'stop')}
                          disabled={actionLoading === `${vm.vmid}-stop`}
                        >
                          {actionLoading === `${vm.vmid}-stop` ? '...' : 'Apagar'}
                        </button>

                        <button
                          className="portal-btn tiny secondary"
                          onClick={() => action(vm.vmid, 'restart')}
                          disabled={actionLoading === `${vm.vmid}-restart`}
                        >
                          {actionLoading === `${vm.vmid}-restart` ? '...' : 'Reiniciar'}
                        </button>

                        <button
                          className="portal-btn tiny ghost"
                          onClick={() => openConsole(vm.vmid)}
                          disabled={actionLoading === `${vm.vmid}-console`}
                        >
                          {actionLoading === `${vm.vmid}-console` ? '...' : 'Consola'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )
          })}
      </main>
    </div>
  )
}