import Link from 'next/link'
import { useRouter } from 'next/router'

export default function AppShell({ title, subtitle, children }) {
  const router = useRouter()

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('refresh_token')
    router.replace('/login')
  }

  const isActive = (path) => router.pathname === path

  return (
    <div className="pageShell">
      <aside className="sidebar">
        <div className="brand">Hyperox</div>
        <div className="brandSub">VM Panel / SIEM Ready</div>

        <div className="navSection">
          <div className="navTitle">Principal</div>
          <Link className={`navItem ${isActive('/vms') ? 'active' : ''}`} href="/vms">
            Mis VMs
          </Link>
          <Link className={`navItem ${isActive('/audit') ? 'active' : ''}`} href="/audit">
            Auditoría
          </Link>
        </div>

        <div className="navSection">
          <div className="navTitle">Sesión</div>
          <button className="navItem linkBtn" onClick={logout}>
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="mainArea">
        <div className="container">
          <div className="topbar">
            <div className="titleBlock">
              <h1>{title}</h1>
              <p>{subtitle}</p>
            </div>
          </div>

          {children}
        </div>
      </main>
    </div>
  )
}