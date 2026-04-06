import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import AppShell from '../components/AppShell'

export default function AuditPage() {
  const router = useRouter()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      const token = localStorage.getItem('token')

      if (!token) {
        router.replace('/login')
        return
      }

      try {
        const res = await fetch('/api/audit', {
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
          throw new Error('No se pudo cargar auditoría')
        }

        const data = await res.json()
        setRows(data)
      } catch (err) {
        setError(err.message || 'Error')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  return (
    <AppShell
      title="Auditoría"
      subtitle="Registro reciente de acciones sobre VMs."
    >
      <div className="card cardPad">
        {loading && <p className="muted">Cargando...</p>}
        {error && <div className="errorBox">{error}</div>}

        {!loading && rows.length === 0 && (
          <div className="emptyState">Sin eventos.</div>
        )}

        {!loading && rows.length > 0 && (
          <div className="tableWrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>User ID</th>
                  <th>Acción</th>
                  <th>Target</th>
                  <th>Resultado</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.created_at}</td>
                    <td>{row.user_id || '-'}</td>
                    <td>{row.action}</td>
                    <td>{row.target}</td>
                    <td>{row.result}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  )
}