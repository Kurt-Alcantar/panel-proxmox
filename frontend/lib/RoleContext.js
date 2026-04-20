import { createContext, useContext, useEffect, useState } from 'react'
import { apiJson, clearSession } from './auth'
import { useRouter } from 'next/router'

const RoleContext = createContext({ role: null, tenantId: null, tenantType: null, displayName: '', loading: true })

export function RoleProvider({ children }) {
  const router = useRouter()
  const [ctx, setCtx] = useState({ role: null, tenantId: null, tenantType: null, displayName: '', loading: true })

  useEffect(() => {
    if (typeof window === 'undefined') return
    const token = localStorage.getItem('token')
    if (!token) { setCtx(c => ({ ...c, loading: false })); return }

    apiJson('/api/me')
      .then(data => setCtx({ role: data.role, tenantId: data.tenantId, tenantType: data.tenantType, displayName: data.displayName || data.email || '', loading: false }))
      .catch(() => { setCtx(c => ({ ...c, loading: false })) })
  }, [router.pathname])

  return <RoleContext.Provider value={ctx}>{children}</RoleContext.Provider>
}

export function useRole() {
  return useContext(RoleContext)
}

// Tabla de módulos visibles por rol
export const NAV_PERMISSIONS = {
  platform_admin: ['/overview', '/assets', '/alerts', '/vms', '/pools', '/fleet-agents', '/admin', '/support', '/settings'],
  partner_admin:  ['/overview', '/assets', '/alerts', '/vms', '/support', '/settings'],
  tenant_user:    ['/overview', '/assets', '/support', '/settings'],
}

export function canAccess(role, path) {
  if (!role) return false
  const allowed = NAV_PERMISSIONS[role] || []
  return allowed.some(p => path === p || path.startsWith(p + '/'))
}
