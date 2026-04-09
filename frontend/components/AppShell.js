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

          <Link className={`navItem ${isActive('/admin') ? 'active' : ''}`} href="/admin">
            Administración
          </Link>
        </div>

        <div className="navSection">
          <div className="navTitle">Sesión</div>
          <button className="navItem linkBtn" onClick={logout}>
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="content">
        <div className="contentHeader">
          <div>
            <div className="pageTitle">{title}</div>
            {subtitle ? <div className="pageSubtitle">{subtitle}</div> : null}
          </div>
        </div>

        {children}

        <style jsx>{`
          .pageShell {
            min-height: 100vh;
            display: grid;
            grid-template-columns: 240px 1fr;
            background: linear-gradient(180deg, #0a0320 0%, #14082e 100%);
          }
          .sidebar {
            padding: 28px 20px;
            border-right: 1px solid rgba(255,255,255,0.08);
            background: rgba(10,3,32,0.82);
          }
          .brand {
            font-size: 22px;
            font-weight: 800;
            color: #fff;
          }
          .brandSub {
            margin-top: 6px;
            font-size: 13px;
            color: #c7b9ff;
          }
          .navSection {
            margin-top: 28px;
            display: grid;
            gap: 8px;
          }
          .navTitle {
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: #9b89e8;
          }
          .navItem {
            display: block;
            width: 100%;
            text-align: left;
            border: none;
            border-radius: 12px;
            background: transparent;
            color: #fff;
            text-decoration: none;
            padding: 12px 14px;
            font-size: 15px;
            cursor: pointer;
          }
          .navItem:hover,
          .navItem.active {
            background: rgba(123, 97, 255, 0.18);
            box-shadow: inset 0 0 0 1px rgba(166, 145, 255, 0.25);
          }
          .linkBtn {
            font: inherit;
          }
          .content {
            padding: 28px;
          }
          .contentHeader {
            margin-bottom: 20px;
          }
          .pageTitle {
            font-size: 34px;
            font-weight: 800;
            color: #fff;
          }
          .pageSubtitle {
            margin-top: 8px;
            color: #bcaef6;
            font-size: 15px;
          }
          @media (max-width: 980px) {
            .pageShell {
              grid-template-columns: 1fr;
            }
            .sidebar {
              border-right: none;
              border-bottom: 1px solid rgba(255,255,255,0.08);
            }
          }
        `}</style>
      </main>
    </div>
  )
}
