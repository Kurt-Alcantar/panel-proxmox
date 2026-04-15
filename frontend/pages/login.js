import Link from 'next/link'
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
      router.replace('/assets')
    } catch (err) {
      setError(err.message || 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="authPage">
      <header className="authHeader">
        <div className="authHeaderInner">
          <div className="authBrand">
            <img src="/logo.png" alt="Logo Hyper-Ox" className="authBrandLogo" />
          </div>

          <div className="authHeaderActions">
            <Link href="/support" className="btn btnSecondary authSupportBtn">
              Soporte técnico
            </Link>
          </div>
        </div>
      </header>

      <main className="authMain">
        <section className="authFrame">
          <div className="authPanel">
            <div className="authHero">
              <h1>Bienvenido a HYPER-OX</h1>
              <p>Tu consola segura te espera. Ingresa tus credenciales para continuar.</p>
            </div>

            <form className="authForm" onSubmit={handleLogin}>
              <div className="authField">
                <label>Usuario</label>
                <input
                  className="authInput"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Ingresa tu usuario"
                  required
                />
              </div>

              <div className="authField">
                <label>Password</label>
                <input
                  className="authInput"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Ingresa tu contraseña"
                  required
                />
              </div>

              {error && <div className="errorBox">{error}</div>}

              <div className="authSubmitRow">
                <button className="btn btnPrimary authSubmitBtn" type="submit" disabled={loading}>
                  {loading ? 'Entrando...' : 'Validar e iniciar'}
                </button>
              </div>
            </form>
          </div>
        </section>
      </main>

      <footer className="authFooter">
        <div className="authFooterInner">
          <div className="authFooterSide authFooterLeft">
            <div className="authFooterBrand">
              <img src="/logo.png" alt="Logo Hyper-Ox" className="authFooterLogo" />
            </div>
          </div>

          <div className="authFooterCenter">
            <div className="authFooterText">
              Copyright © Hyper-Ox 2026 | Todos los Derechos Reservados
            </div>
          </div>

          <div className="authFooterSide authFooterRight">
            <div className="authFooterActions">
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}