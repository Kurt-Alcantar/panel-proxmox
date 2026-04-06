import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'

export default function VmsPage() {
  const router = useRouter()
  const [vms, setVms] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState(null)
  const [search, setSearch] = useState('')

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

  const filteredVMs = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return vms

    return vms.filter((vm) => {
      return (
        String(vm.vmid).includes(q) ||
        (vm.name || '').toLowerCase().includes(q) ||
        (vm.node || '').toLowerCase().includes(q) ||
        (vm.pool_id || '').toLowerCase().includes(q) ||
        (vm.status || '').toLowerCase().includes(q)
      )
    })
  }, [vms, search])

  const stats = useMemo(() => {
    const running = vms.filter((vm) => vm.status === 'running').length
    const stopped = vms.filter((vm) => vm.status === 'stopped').length
    return {
      total: vms.length,
      running,
      stopped,
      pools: new Set(vms.map((vm) => vm.pool_id).filter(Boolean)).size
    }
  }, [vms])

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

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('refresh_token')
    router.replace('/login')
  }

  const badgeClass = (status) => {
    if (status === 'running') return 'badge running'
    if (status === 'stopped') return 'badge stopped'
    return 'badge unknown'
  }

  return (
    <div className="page">
      <div className="container">
        <div className="topbar">
          <div className="titleBlock">
            <h1>Mis VMs</h1>
            <p>Vista filtrada por tenant group con control operativo.</p>
          </div>
          <button className="btn btnSecondary" onClick={logout}>
            Cerrar sesión
          </button>
        </div>

        <div className="gridStats">
          <div className="card statCard">
            <div className="statLabel">Total de VMs</div>
            <div className="statValue">{stats.total}</div>
          </div>
          <div className="card statCard">
            <div className="statLabel">Encendidas</div>
            <div className="statValue">{stats.running}</div>
          </div>
          <div className="card statCard">
            <div className="statLabel">Apagadas</div>
            <div className="statValue">{stats.stopped}</div>
          </div>
          <div className="card statCard">
            <div className="statLabel">Pools visibles</div>
            <div className="statValue">{stats.pools}</div>
          </div>
        </div>

        <div className="card cardPad">
          <div className="toolbar">
            <input
              className="searchBox"
              placeholder="Buscar por nombre, vmid, pool, nodo o status..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="muted">{filteredVMs.length} resultado(s)</div>
          </div>

          {loading && <p className="muted">Cargando...</p>}
          {error && <div className="errorBox">{error}</div>}
          {!loading && !error && filteredVMs.length === 0 && (
            <div className="emptyState">No hay VMs asignadas.</div>
          )}

          {!loading && filteredVMs.length > 0 && (
            <div className="tableWrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>VMID</th>
                    <th>VM</th>
                    <th>Pool</th>
                    <th>Estado</th>
                    <th>CPU</th>
                    <th>Memory</th>
                    <th>Disk</th>
                    <th>Acciones</th>
                    <th>Consola</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVMs.map((vm) => (
                    <tr key={vm.id}>
                      <td>{vm.vmid}</td>
                      <td>
                        <div className="vmName">{vm.name}</div>
                        <div className="vmSub">{vm.node}</div>
                      </td>
                      <td>{vm.pool_id || '-'}</td>
                      <td>
                        <span className={badgeClass(vm.status)}>
                          {vm.status || 'unknown'}
                        </span>
                      </td>
                      <td>{vm.cpu ?? '-'}</td>
                      <td>{vm.memory ?? '-'}</td>
                      <td>{vm.disk ?? '-'}</td>
                      <td>
                        <div className="actions">
                          <button
                            className="btn btnPrimary"
                            onClick={() => action(vm.vmid, 'start')}
                            disabled={actionLoading === `${vm.vmid}-start`}
                          >
                            {actionLoading === `${vm.vmid}-start` ? '...' : 'Start'}
                          </button>

                          <button
                            className="btn btnSecondary"
                            onClick={() => action(vm.vmid, 'restart')}
                            disabled={actionLoading === `${vm.vmid}-restart`}
                          >
                            {actionLoading === `${vm.vmid}-restart` ? '...' : 'Restart'}
                          </button>

                          <button
                            className="btn btnDanger"
                            onClick={() => action(vm.vmid, 'stop')}
                            disabled={actionLoading === `${vm.vmid}-stop`}
                          >
                            {actionLoading === `${vm.vmid}-stop` ? '...' : 'Stop'}
                          </button>
                        </div>
                      </td>
                      <td>
                        <button
                          className="btn btnSecondary"
                          onClick={() => openConsole(vm.vmid)}
                          disabled={actionLoading === `${vm.vmid}-console`}
                        >
                          {actionLoading === `${vm.vmid}-console` ? '...' : 'Abrir'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}