import Link from 'next/link'
import { useRouter } from 'next/router'
import Image from 'next/image'

export default function AppShell({
  title,
  subtitle,
  children,
  actions,
  searchValue = '',
  onSearchChange,
  searchPlaceholder = 'Buscar...'
}) {
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
        <div className="sidebarTop">
          <div className="sidebarLogoWrap">
            <img src="/logo.png" alt="Logo Hyperox" className="sidebarLogo" />
          </div>
        </div>

        <div className="sidebarContent">
          <div className="navSection">
            <Link className={`navItem ${isActive('/usuario') ? 'active' : ''}`} href="/usuario">
              Mi cuenta
            </Link>

            <Link className={`navItem ${isActive('/vms') ? 'active' : ''}`} href="/vms">
              Mis VMs
            </Link>

            <Link className={`navItem  ${isActive('/support') ? 'active' : ''}`} href="/support">
              Soporte técnico
            </Link>
          </div>
        </div>

        <div className="sidebarFooter">
          <Link
              className={`navItem navItemCenter ${isActive('/admin') ? 'active' : ''}`}
              href="/admin"
            >
              Administrar tenants
          </Link>
          <button className="btn btnCloseSession sidebarLogoutBtn" onClick={logout}>
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="mainArea">
        <div className="container">
          <div className="appNavbar card cardPad">
            <div className="appNavbarInner">
              <div className="navbarSearchWrap">
                <input
                  type="text"
                  className="searchBox navbarSearchInput"
                  placeholder={searchPlaceholder}
                  value={searchValue}
                  onChange={(e) => onSearchChange?.(e.target.value)}
                />
              </div>

              <div className="navbarActions">
                {actions}

                <Link href="/support" className="btn btnSecondary navActionLink">
                  Centro de tickets
                </Link>
              </div>
            </div>
          </div>

          <div className="topbar">
            <div className="titleBlock">
              <h1>{title}</h1>
              <p>{subtitle}</p>
            </div>
          </div>

          <div className="appPageContent">
            {children}
          </div>

          <footer className="appFooter">
            <div className="appFooterInner">
              <div className="appFooterSide appFooterLeft">
                <div className="appFooterBrand">
                  <img src="/logo.png" alt="Logo Hyper-Ox" className="appFooterLogoImg" />
                </div>
              </div>

              <div className="appFooterCenter">
                <div className="appFooterText">
                  Copyright © Hyper-Ox 2026 | Todos los Derechos Reservados
                </div>
              </div>

              <div className="appFooterSide appFooterRight">
                <div className="appFooterActions">
                  {/* aquí luego puedes meter más botones */}
                  {/* <button className="btn btnSecondary">Ayuda</button> */}
                  {/* <Link href="/terminos" className="btn btnSecondary navActionLink">Términos</Link> */}
                </div>
              </div>
            </div>
          </footer>
        </div>
      </main>
    </div>
  )
}