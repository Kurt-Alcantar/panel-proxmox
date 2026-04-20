import '../styles/tokens.css'
import '../styles/base.css'
import '../styles/layout.css'
import '../styles/components.css'
import '../styles/auth.css'
import '../styles/vms.css'
import '../styles/vm-detail.css'
import '../styles/dashboard.css'
import '../styles/responsive.css'

import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { RoleProvider, useRole, canAccess } from '../lib/RoleContext'

const PUBLIC_ROUTES = ['/login']

function RouteGuard({ children }) {
  const router = useRouter()
  const { role, loading } = useRole()

  useEffect(() => {
    if (loading) return
    if (PUBLIC_ROUTES.includes(router.pathname)) return
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    if (!token) { router.replace('/login'); return }
    if (role && !canAccess(role, router.pathname)) {
      router.replace('/overview')
    }
  }, [role, loading, router])

  return children
}

function AppInner({ Component, pageProps }) {
  return (
    <RouteGuard>
      <Component {...pageProps} />
    </RouteGuard>
  )
}

export default function App({ Component, pageProps }) {
  return (
    <RoleProvider>
      <AppInner Component={Component} pageProps={pageProps} />
    </RoleProvider>
  )
}
