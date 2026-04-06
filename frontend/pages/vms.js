import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'

export default function VmsPage() {
  const router = useRouter()
  const [vms, setVms] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const token = localStorage.getItem('token')

    if (!token) {
      router.push('/login')
      return
    }

    const fetchVMs = async () => {
      try {
        const res = await fetch('http://192.168.10.163/api/my/vms', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        })

        if (res.status === 401) {
          localStorage.removeItem('token')
          localStorage.removeItem('refresh_token')
          router.push('/login')
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

    fetchVMs()
  }, [router])

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('refresh_token')
    router.push('/login')
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

      {!loading && !error && vms.length > 0 && (
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
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}