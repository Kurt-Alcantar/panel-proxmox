import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import AppShell from '../components/AppShell'

export default function VmsPage() {
  const router = useRouter()
  const [vms, setVms] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState(null)
  const [selectedPool, setSelectedPool] = useState('ALL')

  const clearSession = useCallback(() => {
    localStorage.removeItem('token')
    localStorage.removeItem('refresh_token')
    router.replace('/login')
  }, [router])

  const authFetch = useCallback(async (url, options = {}) => {
    const token = localStorage.getItem('token')

    if (!token) {
      clearSession()
      throw new Error('Sesión expirada')
    }

    const res = await fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`
      }
    })

    if (res.status === 401) {
      clearSession()
      throw new Error('Sesión expirada')
    }

    return res
  }, [clearSession])

  const fetchVMs = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const res = await authFetch('/api/my/vms')

      if (!res.ok) throw new Error('No se pudieron obtener las VMs')

      const data = await res.json()
      setVms(data)
    } catch (err) {
      setError(err.message || 'Error cargando VMs')
    } finally {
      setLoading(false)
    }
  }, [authFetch])

  useEffect(() => {
    fetchVMs()
  }, [fetchVMs])

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

  const action = async (vmid, type) => {
    setActionLoading(`${vmid}-${type}`)
    setError('')

    try {
      const res = await authFetch(`/api/vms/${vmid}/${type}`, {
        method: 'POST'
      })

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
    setActionLoading(`${vmid}-console`)
    setError('')

    try {
      const res = await authFetch(`/api/vms/${vmid}/console`, {
        method: 'POST'
      })

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
    <AppShell
      title="Mis VMs"
      subtitle={`${stats.total} VMs visibles en tu tenant`}
    >
      {error && <div className="errorBox">{error}</div>}

      {loading && <div className="emptyState">Cargando...</div>}

      {!loading && (
        <>
          <section className="card cardPad sectionBlock">
            <div className="sectionHeader">
              <div>
                <h2 className="sectionTitle">Resumen general</h2>
                <p className="sectionSub">Estado consolidado de tus máquinas virtuales.</p>
              </div>
            </div>

            <div className="gridStats vmStatsGrid">
              <div className="card statCard vmMiniStat">
                <div className="statLabel">Total</div>
                <div className="statValue">{stats.total}</div>
              </div>

              <div className="card statCard vmMiniStat">
                <div className="statLabel">Encendidas</div>
                <div className="statValue">{stats.running}</div>
              </div>

              <div className="card statCard vmMiniStat">
                <div className="statLabel">Apagadas</div>
                <div className="statValue">{stats.stopped}</div>
              </div>

              <div className="card statCard vmMiniStat">
                <div className="statLabel">Pausadas</div>
                <div className="statValue">{stats.paused}</div>
              </div>
            </div>
          </section>

          <section className="card cardPad sectionBlock">
            <div className="sectionHeader">
              <div>
                <h2 className="sectionTitle">Filtros por pool</h2>
                <p className="sectionSub">Selecciona un pool para filtrar las VMs visibles.</p>
              </div>
            </div>

            <div className="poolFilterRow">
              <button
                className={`poolChip ${selectedPool === 'ALL' ? 'active' : ''}`}
                onClick={() => setSelectedPool('ALL')}
              >
                Todos <span>{vms.length}</span>
              </button>

              {poolEntries.map(([poolName, items], idx) => (
                <button
                  key={poolName}
                  className={`poolChip ${selectedPool === poolName ? 'active' : ''}`}
                  onClick={() => setSelectedPool(poolName)}
                >
                  <span className={`poolDot color-${idx % 6}`} />
                  {poolName}
                  <span>{items.length}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="card cardPad sectionBlock">
            <div className="sectionHeader">
              <div>
                <h2 className="sectionTitle">Pools y VMs</h2>
                <p className="sectionSub">Listado agrupado por pool dentro de Mis VMs.</p>
              </div>
            </div>

            {filteredPools.length === 0 && (
              <div className="emptyState">No hay VMs disponibles.</div>
            )}

            <div className="poolsWrapper">
              {filteredPools.map(([poolName, items], poolIndex) => {
                const running = items.filter((vm) => vm.status === 'running').length
                const stopped = items.filter((vm) => vm.status === 'stopped').length

                return (
                  <section key={poolName} className="poolSection">
                    <div className="poolHeader">
                      <div className="poolHeaderLeft">
                        <span className={`poolDot large color-${poolIndex % 6}`} />
                        <div>
                          <div className="poolHeaderTitle">{poolName}</div>
                          <div className="poolHeaderMeta">
                            {items.length} VM{items.length !== 1 ? 's' : ''}
                          </div>
                        </div>
                      </div>

                      <div className="poolHeaderRight">
                        {running > 0 && (
                          <span className="miniBadge success">
                            {running} encendida{running !== 1 ? 's' : ''}
                          </span>
                        )}
                        {stopped > 0 && (
                          <span className="miniBadge danger">
                            {stopped} apagada{stopped !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="vmCardGrid">
                      {items.map((vm) => (
                        <div key={vm.id} className="vmCard">
                          <div className="vmCardTop">
                            <div>
                              <button
                                className="vmCardTitleBtn"
                                onClick={() => router.push(`/vms/${vm.vmid}`)}
                              >
                                {vm.name}
                              </button>

                              <div className="vmCardTags">
                                <span className="vmTag">VM {vm.vmid}</span>
                                <span className="vmTag">{vm.node}</span>
                              </div>
                            </div>

                            <span className={badgeClass(vm.status)}>
                              {vm.status === 'running'
                                ? 'Encendida'
                                : vm.status === 'stopped'
                                ? 'Apagada'
                                : vm.status === 'paused'
                                ? 'Pausada'
                                : vm.status || 'Unknown'}
                            </span>
                          </div>

                          <div className="vmMetrics">
                            <div className="vmMetric">
                              <div className="vmMetricLabel">CPU</div>
                              <div className="vmMetricValue">{vm.cpu || 0} vCPU</div>
                            </div>

                            <div className="vmMetric">
                              <div className="vmMetricLabel">RAM</div>
                              <div className="vmMetricValue">{formatBytes(vm.memory)}</div>
                            </div>

                            <div className="vmMetric">
                              <div className="vmMetricLabel">DISCO</div>
                              <div className="vmMetricValue">{formatBytes(vm.disk)}</div>
                            </div>
                          </div>

                          <div className="actions">
                            <button
                              className="btn btnPrimary"
                              onClick={() => action(vm.vmid, 'start')}
                              disabled={actionLoading === `${vm.vmid}-start`}
                            >
                              {actionLoading === `${vm.vmid}-start` ? '...' : 'Encender'}
                            </button>

                            <button
                              className="btn btnSecondary"
                              onClick={() => action(vm.vmid, 'stop')}
                              disabled={actionLoading === `${vm.vmid}-stop`}
                            >
                              {actionLoading === `${vm.vmid}-stop` ? '...' : 'Apagar'}
                            </button>

                            <button
                              className="btn btnSecondary"
                              onClick={() => action(vm.vmid, 'restart')}
                              disabled={actionLoading === `${vm.vmid}-restart`}
                            >
                              {actionLoading === `${vm.vmid}-restart` ? '...' : 'Reiniciar'}
                            </button>

                            <button
                              className="btn btnSecondary"
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
            </div>
          </section>
        </>
      )}
    </AppShell>
  )
}