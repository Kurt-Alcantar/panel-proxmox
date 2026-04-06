import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    localStorage.removeItem('token')
    localStorage.removeItem('refresh_token')
  }, [])

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      })

      const data = await res.json()

      if (!res.ok || !data.access_token) {
        throw new Error(data.error_description || 'Credenciales inválidas')
      }

      localStorage.setItem('token', data.access_token)
      localStorage.setItem('refresh_token', data.refresh_token || '')
      router.replace('/vms')
    } catch (err) {
      setError(err.message || 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="loginWrap">
      <div className="card loginCard">
        <h1 className="loginTitle">Hyperox Panel</h1>
        <p className="loginSubtitle">Accede a tu entorno Proxmox multitenant.</p>

        <form onSubmit={handleLogin}>
          <div className="formGroup">
            <label>Usuario</label>
            <input
              className="input"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          <div className="formGroup">
            <label>Password</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && <div className="errorBox">{error}</div>}

          <button className="btn btnPrimary" type="submit" disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Entrando...' : 'Iniciar sesión'}
          </button>
        </form>
      </div>
    </div>
  )
}