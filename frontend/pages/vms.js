import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'

export default function VmsPage() {
  const router = useRouter()
  const [vms, setVms] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState(null)

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

  return (
    <div style={{ padding: 40, fontFamily: 'Arial, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1>Mis VMs</h1>
        <button onClick={logout}>Cerrar sesión</button>
      </div>

      {loading && <p>Cargando...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}

      {!loading && !error && vms.length === 0 && (
        <p>No hay VMs asignadas.</p>
      )}

      {!loading && vms.length > 0 && (
        <table border="1" cellPadding="10" cellSpacing="0" style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th>VMID</th>
              <th>Nombre</th>
              <th>Nodo</th>
              <th>Pool</th>
              <th>Status</th>
              <th>CPU</th>
              <th>Memory</th>
              <th>Disk</th>
              <th>Acciones</th>
              <th>Consola</th>
            </tr>
          </thead>
          <tbody>
            {vms.map((vm) => (
              <tr key={vm.id}>
                <td>{vm.vmid}</td>
                <td>{vm.name}</td>
                <td>{vm.node}</td>
                <td>{vm.pool_id}</td>
                <td>{vm.status}</td>
                <td>{vm.cpu}</td>
                <td>{vm.memory}</td>
                <td>{vm.disk}</td>
                <td>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      onClick={() => action(vm.vmid, 'start')}
                      disabled={actionLoading === `${vm.vmid}-start`}
                    >
                      {actionLoading === `${vm.vmid}-start` ? '...' : 'Start'}
                    </button>

                    <button
                      onClick={() => action(vm.vmid, 'stop')}
                      disabled={actionLoading === `${vm.vmid}-stop`}
                    >
                      {actionLoading === `${vm.vmid}-stop` ? '...' : 'Stop'}
                    </button>

                    <button
                      onClick={() => action(vm.vmid, 'restart')}
                      disabled={actionLoading === `${vm.vmid}-restart`}
                    >
                      {actionLoading === `${vm.vmid}-restart` ? '...' : 'Restart'}
                    </button>
                  </div>
                </td>
                <td>
                  <button
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
      )}
    </div>
  )
}