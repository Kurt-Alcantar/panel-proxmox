import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import AppShell from '../components/AppShell'

const theme = {
  pageText: '#f3edff',
  muted: '#b8abd9',
  card: '#171129',
  card2: '#21183a',
  card3: '#2a1f49',
  border: '#3b2d63',
  borderSoft: '#4c3b7f',
  inputBg: '#120d22',
  inputText: '#f3edff',
  primary: '#8b5cf6',
  primaryHover: '#a78bfa',
  successBg: 'rgba(34,197,94,0.12)',
  successBorder: 'rgba(34,197,94,0.35)',
  successText: '#86efac',
  errorBg: 'rgba(239,68,68,0.12)',
  errorBorder: 'rgba(239,68,68,0.35)',
  errorText: '#fca5a5',
  warningBg: 'rgba(245,158,11,0.12)',
  warningBorder: 'rgba(245,158,11,0.35)',
  warningText: '#fcd34d',
  shadow: '0 14px 34px rgba(0,0,0,0.35)',
}

const cardStyle = {
  background: theme.card,
  borderRadius: 16,
  padding: 18,
  border: `1px solid ${theme.border}`,
  boxShadow: theme.shadow,
}

const inputStyle = {
  width: '100%',
  border: `1px solid ${theme.borderSoft}`,
  borderRadius: 10,
  padding: '10px 12px',
  fontSize: 14,
  background: theme.inputBg,
  color: theme.inputText,
  outline: 'none',
}

const textareaStyle = {
  ...inputStyle,
  minHeight: 88,
  resize: 'vertical',
}

const labelStyle = {
  display: 'grid',
  gap: 6,
  fontSize: 13,
  color: theme.muted,
}

const buttonStyle = {
  border: 'none',
  borderRadius: 10,
  padding: '10px 14px',
  background: theme.primary,
  color: '#fff',
  cursor: 'pointer',
  fontWeight: 700,
}

const altButtonStyle = {
  ...buttonStyle,
  background: '#6d28d9',
}

const ghostButtonStyle = {
  ...buttonStyle,
  background: theme.card3,
  color: theme.pageText,
  border: `1px solid ${theme.borderSoft}`,
}

const dangerButtonStyle = {
  ...buttonStyle,
  background: '#b91c1c',
}

const successBoxStyle = {
  background: theme.successBg,
  color: theme.successText,
  border: `1px solid ${theme.successBorder}`,
  padding: 14,
  borderRadius: 12,
}

const errorBoxStyle = {
  background: theme.errorBg,
  color: theme.errorText,
  border: `1px solid ${theme.errorBorder}`,
  padding: 14,
  borderRadius: 12,
}

const chipStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 12px',
  border: `1px solid ${theme.borderSoft}`,
  borderRadius: 999,
  color: theme.pageText,
  background: theme.card2,
}

const tableHeadCellStyle = {
  textAlign: 'left',
  padding: '10px 8px',
  color: theme.muted,
  fontSize: 12,
  borderBottom: `1px solid ${theme.border}`,
}

const tableCellStyle = {
  padding: '10px 8px',
  color: theme.pageText,
  borderTop: `1px solid ${theme.border}`,
  verticalAlign: 'top',
}

function SectionTitle({ title, subtitle, actions }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 16,
        alignItems: 'flex-start',
        marginBottom: 14,
        flexWrap: 'wrap',
      }}
    >
      <div>
        <div style={{ fontSize: 18, fontWeight: 800, color: theme.pageText }}>{title}</div>
        {subtitle ? (
          <div style={{ fontSize: 13, color: theme.muted, marginTop: 4 }}>{subtitle}</div>
        ) : null}
      </div>
      {actions ? <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>{actions}</div> : null}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label style={labelStyle}>
      <span>{label}</span>
      {children}
    </label>
  )
}

const emptyBootstrap = {
  tenants: [],
  tenantGroups: [],
  pools: [],
  roles: [],
  users: [],
  vms: [],
}

const emptyTenantForm = {
  id: '',
  code: '',
  name: '',
  status: 'ACTIVE',
  type: 'client',
  parent_tenant_id: '',
}

const emptyTenantGroupForm = {
  id: '',
  tenant_id: '',
  code: '',
  name: '',
}

const emptyUserForm = {
  id: '',
  username: '',
  email: '',
  firstName: '',
  lastName: '',
  password: '',
  tenant_id: '',
  tenant_group_id: '',
  role_ids: [],
  enabled: true,
}

const emptyVmForm = {
  vmid: '',
  name: '',
  node: '',
  pool_id: '',
  tenant_id: '',
  tenant_group_id: '',
  status: '',
  os_type: '',
  elastic_host_name: '',
  kibana_base_url: '',
  monitored_services: '',
  observability_enabled: false,
}

export default function AdminPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [data, setData] = useState(emptyBootstrap)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [poolGroupId, setPoolGroupId] = useState('')
  const [selectedPoolIds, setSelectedPoolIds] = useState([])

  const [tenantForm, setTenantForm] = useState(emptyTenantForm)
  const [tenantGroupForm, setTenantGroupForm] = useState(emptyTenantGroupForm)
  const [userForm, setUserForm] = useState(emptyUserForm)

  const [assets, setAssets] = useState([])
  const [vmSearch, setVmSearch] = useState('')
  const [selectedVmId, setSelectedVmId] = useState('')
  const [vmForm, setVmForm] = useState(emptyVmForm)

  const clearMessages = () => {
    setError('')
    setSuccess('')
  }

  const redirectToLogin = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token')
      localStorage.removeItem('refresh_token')
    }
    router.replace('/login')
  }

  const fetchWithRefresh = async (url, options = {}) => {
    if (typeof window === 'undefined') {
      throw new Error('Esta acción solo está disponible en el navegador')
    }

    const accessToken = localStorage.getItem('token')
    const refreshToken = localStorage.getItem('refresh_token')

    if (!accessToken && !refreshToken) {
      redirectToLogin()
      throw new Error('Sesión no disponible')
    }

    const attempt = async (currentToken) =>
      fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {}),
          ...(currentToken ? { Authorization: `Bearer ${currentToken}` } : {}),
        },
      })

    let response = await attempt(accessToken)

    if (response.status !== 401) return response

    if (!refreshToken) {
      redirectToLogin()
      throw new Error('Sesión expirada')
    }

    const refreshResponse = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })

    const refreshText = await refreshResponse.text()
    let refreshData = {}
    try {
      refreshData = refreshText ? JSON.parse(refreshText) : {}
    } catch {
      refreshData = {}
    }

    if (!refreshResponse.ok || !refreshData.access_token) {
      redirectToLogin()
      throw new Error('No se pudo refrescar la sesión')
    }

    localStorage.setItem('token', refreshData.access_token)
    localStorage.setItem('refresh_token', refreshData.refresh_token || refreshToken)

    response = await attempt(refreshData.access_token)
    return response
  }

  const request = async (url, options = {}) => {
    const response = await fetchWithRefresh(url, options)
    const text = await response.text()

    let payload = null
    try {
      payload = text ? JSON.parse(text) : null
    } catch {
      payload = text
    }

    if (!response.ok) {
      throw new Error(payload?.message || payload?.error || payload || `HTTP ${response.status}`)
    }

    return payload
  }

  const refreshData = async () => {
    clearMessages()
    setLoading(true)

    try {
      const [bootstrap, assetList] = await Promise.all([
        request('/api/admin/bootstrap'),
        request('/api/admin/assets').catch(() => []),
      ])
      setData(bootstrap || emptyBootstrap)
      setAssets(Array.isArray(assetList) ? assetList : [])

      const nextTenantGroups = bootstrap?.tenantGroups || []
      const nextVms = bootstrap?.vms || []

      setTenantGroupForm((current) => ({
        ...current,
        tenant_id: current.tenant_id || bootstrap?.tenants?.[0]?.id || '',
      }))

      setUserForm((current) => ({
        ...current,
        tenant_group_id: current.tenant_group_id || nextTenantGroups[0]?.id || '',
      }))

      const resolvedPoolGroupId =
        poolGroupId && nextTenantGroups.some((g) => g.id === poolGroupId)
          ? poolGroupId
          : nextTenantGroups[0]?.id || ''

      setPoolGroupId(resolvedPoolGroupId)

      const currentGroup = nextTenantGroups.find((g) => g.id === resolvedPoolGroupId)
      setSelectedPoolIds((currentGroup?.pools || []).map((pool) => pool.id))

      const resolvedVmId =
        selectedVmId && nextVms.some((vm) => String(vm.vmid) === String(selectedVmId))
          ? selectedVmId
          : nextVms[0]?.vmid
          ? String(nextVms[0].vmid)
          : ''

      setSelectedVmId(resolvedVmId)
    } catch (err) {
      setError(err.message || 'No se pudo cargar el módulo administrativo')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined') return

    const token = localStorage.getItem('token')
    const refreshToken = localStorage.getItem('refresh_token')

    if (!token && !refreshToken) {
      router.replace('/login')
      return
    }

    refreshData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const group = data.tenantGroups.find((item) => item.id === poolGroupId)
    setSelectedPoolIds((group?.pools || []).map((pool) => pool.id))
  }, [poolGroupId, data.tenantGroups])

  useEffect(() => {
    const vm = data.vms.find((item) => String(item.vmid) === String(selectedVmId))
    if (!vm) return

    setVmForm({
      vmid: String(vm.vmid),
      name: vm.name || '',
      node: vm.node || '',
      pool_id: vm.pool_id || '',
      tenant_id: vm.tenant_id || '',
      tenant_group_id: vm.tenant_group_id || '',
      status: vm.status || '',
      os_type: vm.os_type || '',
      elastic_host_name: vm.elastic_host_name || '',
      kibana_base_url: vm.kibana_base_url || '',
      monitored_services: vm.monitored_services || '',
      observability_enabled: !!vm.observability_enabled,
    })
  }, [selectedVmId, data.vms])

  const tenantOptions = data.tenants || []
  const tenantGroupOptions = data.tenantGroups || []
  const poolOptions = data.pools || []
  const roleOptions = data.roles || []

  const filteredVms = useMemo(() => {
    const term = vmSearch.trim().toLowerCase()
    if (!term) return data.vms || []

    return (data.vms || []).filter((vm) =>
      [vm.name, vm.node, vm.pool_id, vm.status, String(vm.vmid)]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    )
  }, [vmSearch, data.vms])

  const toggleRole = (roleId) => {
    setUserForm((current) => ({
      ...current,
      role_ids: current.role_ids.includes(roleId)
        ? current.role_ids.filter((value) => value !== roleId)
        : [...current.role_ids, roleId],
    }))
  }

  const togglePool = (poolId) => {
    setSelectedPoolIds((current) =>
      current.includes(poolId) ? current.filter((value) => value !== poolId) : [...current, poolId]
    )
  }

  const runAction = async (action, onSuccessMessage) => {
    clearMessages()
    setBusy(true)

    try {
      await action()
      await refreshData()
      if (onSuccessMessage) setSuccess(onSuccessMessage)
    } catch (err) {
      setError(err.message || 'Error inesperado')
    } finally {
      setBusy(false)
    }
  }

  const submitTenant = (e) => {
    e.preventDefault()

    const payload = {
      code: tenantForm.code,
      name: tenantForm.name,
      status: tenantForm.status,
      type: tenantForm.type,
      parent_tenant_id: tenantForm.parent_tenant_id || null,
    }

    const path = tenantForm.id ? `/api/admin/tenants/${tenantForm.id}` : '/api/admin/tenants'
    const method = tenantForm.id ? 'PATCH' : 'POST'

    runAction(async () => {
      await request(path, { method, body: JSON.stringify(payload) })
      setTenantForm(emptyTenantForm)
    }, tenantForm.id ? 'Tenant actualizado' : 'Tenant creado')
  }

  const deleteTenant = (tenant) => {
    if (!window.confirm(`Se eliminará el tenant ${tenant.name}. ¿Continúo?`)) return

    runAction(async () => {
      await request(`/api/admin/tenants/${tenant.id}`, { method: 'DELETE' })
      if (tenantForm.id === tenant.id) setTenantForm(emptyTenantForm)
    }, 'Tenant eliminado')
  }

  const submitTenantGroup = (e) => {
    e.preventDefault()

    const payload = {
      tenant_id: tenantGroupForm.tenant_id,
      code: tenantGroupForm.code,
      name: tenantGroupForm.name,
    }

    const path = tenantGroupForm.id
      ? `/api/admin/tenant-groups/${tenantGroupForm.id}`
      : '/api/admin/tenant-groups'
    const method = tenantGroupForm.id ? 'PATCH' : 'POST'

    runAction(async () => {
      await request(path, { method, body: JSON.stringify(payload) })
      setTenantGroupForm(emptyTenantGroupForm)
    }, tenantGroupForm.id ? 'Tenant group actualizado' : 'Tenant group creado')
  }

  const deleteTenantGroup = (group) => {
    if (!window.confirm(`Se eliminará el tenant group ${group.name}. ¿Continúo?`)) return

    runAction(async () => {
      await request(`/api/admin/tenant-groups/${group.id}`, { method: 'DELETE' })
      if (tenantGroupForm.id === group.id) setTenantGroupForm(emptyTenantGroupForm)
    }, 'Tenant group eliminado')
  }

  const submitUser = (e) => {
    e.preventDefault()

    const payload = {
      username: userForm.username,
      email: userForm.email,
      firstName: userForm.firstName,
      lastName: userForm.lastName,
      password: userForm.password,
      tenant_id: userForm.tenant_id || null,
      tenant_group_id: userForm.tenant_group_id || null,
      role_ids: userForm.role_ids,
      enabled: userForm.enabled,
    }

    const path = userForm.id ? `/api/admin/users/${userForm.id}` : '/api/admin/users'
    const method = userForm.id ? 'PATCH' : 'POST'

    runAction(async () => {
      await request(path, { method, body: JSON.stringify(payload) })
      setUserForm({
        ...emptyUserForm,
        tenant_group_id: tenantGroupOptions[0]?.id || '',
      })
    }, userForm.id ? 'Usuario actualizado' : 'Usuario creado')
  }

  const startEditUser = (user) => {
    setUserForm({
      id: user.id,
      username: user.username || '',
      email: user.email || '',
      firstName: user.first_name || '',
      lastName: user.last_name || '',
      password: '',
      tenant_id: user.tenant_id || user.tenant?.id || '',
      tenant_group_id: user.tenant_group?.id || '',
      role_ids: (user.roles || []).map((role) => role.id),
      enabled: user.enabled !== false,
    })

    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const toggleUserEnabled = (user, enabled) => {
    runAction(
      () =>
        request(`/api/admin/users/${user.id}/${enabled ? 'enable' : 'disable'}`, {
          method: 'POST',
        }),
      enabled ? 'Usuario habilitado' : 'Usuario deshabilitado'
    )
  }

  const deleteUser = (user) => {
    if (!window.confirm(`Se eliminará el usuario ${user.email}. También se borrará de Keycloak. ¿Continúo?`)) return

    runAction(async () => {
      await request(`/api/admin/users/${user.id}`, { method: 'DELETE' })
      if (userForm.id === user.id) {
        setUserForm({
          ...emptyUserForm,
          tenant_group_id: tenantGroupOptions[0]?.id || '',
        })
      }
    }, 'Usuario eliminado')
  }

  const savePoolBindings = () => {
    if (!poolGroupId) return

    runAction(
      () =>
        request(`/api/admin/tenant-groups/${poolGroupId}/pools`, {
          method: 'PUT',
          body: JSON.stringify({ pool_ids: selectedPoolIds }),
        }),
      'Asignación de pools guardada'
    )
  }

  const saveVm = (e) => {
    e.preventDefault()
    if (!vmForm.vmid) return

    runAction(
      () =>
        request(`/api/admin/vms/${vmForm.vmid}`, {
          method: 'PATCH',
          body: JSON.stringify({
            ...vmForm,
            tenant_id: vmForm.tenant_id || null,
            tenant_group_id: vmForm.tenant_group_id || null,
          }),
        }),
      'VM actualizada'
    )
  }

  const deleteVm = () => {
    if (!vmForm.vmid) return
    if (!window.confirm(`Se borrará la VM ${vmForm.vmid} del inventario local. ¿Continúo?`)) return

    runAction(async () => {
      await request(`/api/admin/vms/${vmForm.vmid}`, { method: 'DELETE' })
      setSelectedVmId('')
      setVmForm(emptyVmForm)
    }, 'VM eliminada del inventario local')
  }

  const syncAll = () => {
    runAction(() => request('/api/admin/sync-all', { method: 'POST' }), 'Sincronización completada')
  }

  return (
    <AppShell
      title="Administración"
      subtitle="CRUD operativo para tenants, grupos, usuarios, pools y metadatos de inventario."
    >
      <div style={{ display: 'grid', gap: 18 }}>
        {error ? <div style={errorBoxStyle}>{error}</div> : null}
        {success ? <div style={successBoxStyle}>{success}</div> : null}

        <div style={cardStyle}>
          <SectionTitle
            title="Operación"
            subtitle="Sincroniza pools y VMs desde Proxmox y recarga el bootstrap del panel."
            actions={[
              <button key="sync" type="button" style={altButtonStyle} onClick={syncAll} disabled={busy || loading}>
                {busy ? 'Procesando...' : 'Sincronizar pools + VMs'}
              </button>,
              <button key="reload" type="button" style={ghostButtonStyle} onClick={refreshData} disabled={busy || loading}>
                Recargar datos
              </button>,
            ]}
          />
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 18,
          }}
        >
          <form onSubmit={submitTenant} style={cardStyle}>
            <SectionTitle
              title={tenantForm.id ? 'Editar tenant' : 'Nuevo tenant'}
              subtitle="Catálogo principal para segmentar clientes o áreas."
            />
            <div style={{ display: 'grid', gap: 12 }}>
              <Field label="Code">
                <input
                  style={inputStyle}
                  value={tenantForm.code}
                  onChange={(e) => setTenantForm({ ...tenantForm, code: e.target.value })}
                />
              </Field>

              <Field label="Nombre">
                <input
                  style={inputStyle}
                  value={tenantForm.name}
                  onChange={(e) => setTenantForm({ ...tenantForm, name: e.target.value })}
                />
              </Field>

              <Field label="Status">
                <select
                  style={inputStyle}
                  value={tenantForm.status}
                  onChange={(e) => setTenantForm({ ...tenantForm, status: e.target.value })}
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </Field>

              <Field label="Tipo">
                <select
                  style={inputStyle}
                  value={tenantForm.type}
                  onChange={(e) => setTenantForm({ ...tenantForm, type: e.target.value, parent_tenant_id: '' })}
                >
                  <option value="partner">Partner (ej. Conestra)</option>
                  <option value="client">Cliente final (ej. G-One)</option>
                </select>
              </Field>

              {tenantForm.type === 'client' && (
                <Field label="Partner padre">
                  <select
                    style={inputStyle}
                    value={tenantForm.parent_tenant_id}
                    onChange={(e) => setTenantForm({ ...tenantForm, parent_tenant_id: e.target.value })}
                  >
                    <option value="">Selecciona el partner</option>
                    {tenantOptions.filter(t => t.type === 'partner' || t.type === 'platform').map((t) => (
                      <option key={t.id} value={t.id}>{t.name} ({t.type})</option>
                    ))}
                  </select>
                </Field>
              )}

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button style={buttonStyle} disabled={busy || loading}>
                  {tenantForm.id ? 'Guardar cambios' : 'Crear tenant'}
                </button>
                {tenantForm.id ? (
                  <button type="button" style={ghostButtonStyle} onClick={() => setTenantForm(emptyTenantForm)}>
                    Cancelar
                  </button>
                ) : null}
              </div>
            </div>
          </form>

          <form onSubmit={submitTenantGroup} style={cardStyle}>
            <SectionTitle
              title={tenantGroupForm.id ? 'Editar tenant group' : 'Nuevo tenant group'}
              subtitle="Unidad operativa que liga usuarios, pools y visibilidad."
            />
            <div style={{ display: 'grid', gap: 12 }}>
              <Field label="Tenant">
                <select
                  style={inputStyle}
                  value={tenantGroupForm.tenant_id}
                  onChange={(e) => setTenantGroupForm({ ...tenantGroupForm, tenant_id: e.target.value })}
                >
                  <option value="">Selecciona un tenant</option>
                  {tenantOptions.map((tenant) => (
                    <option key={tenant.id} value={tenant.id}>
                      {tenant.name} ({tenant.code})
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Code">
                <input
                  style={inputStyle}
                  value={tenantGroupForm.code}
                  onChange={(e) => setTenantGroupForm({ ...tenantGroupForm, code: e.target.value })}
                />
              </Field>

              <Field label="Nombre">
                <input
                  style={inputStyle}
                  value={tenantGroupForm.name}
                  onChange={(e) => setTenantGroupForm({ ...tenantGroupForm, name: e.target.value })}
                />
              </Field>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button style={buttonStyle} disabled={busy || loading}>
                  {tenantGroupForm.id ? 'Guardar cambios' : 'Crear tenant group'}
                </button>
                {tenantGroupForm.id ? (
                  <button
                    type="button"
                    style={ghostButtonStyle}
                    onClick={() => setTenantGroupForm(emptyTenantGroupForm)}
                  >
                    Cancelar
                  </button>
                ) : null}
              </div>
            </div>
          </form>
        </div>

        <form onSubmit={submitUser} style={cardStyle}>
          <SectionTitle
            title={userForm.id ? 'Editar usuario' : 'Alta de usuario'}
            subtitle="Crea o actualiza usuario en Keycloak, registro local y asignación de roles."
          />

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 12,
            }}
          >
            <Field label="Username">
              <input
                style={inputStyle}
                value={userForm.username}
                onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
              />
            </Field>

            <Field label="Email">
              <input
                style={inputStyle}
                value={userForm.email}
                onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
              />
            </Field>

            <Field label="Nombre(s)">
              <input
                style={inputStyle}
                value={userForm.firstName}
                onChange={(e) => setUserForm({ ...userForm, firstName: e.target.value })}
              />
            </Field>

            <Field label="Apellidos">
              <input
                style={inputStyle}
                value={userForm.lastName}
                onChange={(e) => setUserForm({ ...userForm, lastName: e.target.value })}
              />
            </Field>

            <Field label={userForm.id ? 'Nuevo password (opcional)' : 'Password inicial'}>
              <input
                type="password"
                style={inputStyle}
                value={userForm.password}
                onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
              />
            </Field>

            <Field label="Tenant (para visibilidad)">
              <select
                style={inputStyle}
                value={userForm.tenant_id}
                onChange={(e) => setUserForm({ ...userForm, tenant_id: e.target.value })}
              >
                <option value="">Sin tenant</option>
                {tenantOptions.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.type||'client'})
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Tenant group">
              <select
                style={inputStyle}
                value={userForm.tenant_group_id}
                onChange={(e) => setUserForm({ ...userForm, tenant_group_id: e.target.value })}
              >
                <option value="">Sin tenant group</option>
                {tenantGroupOptions.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name} ({group.code})
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: theme.muted, marginBottom: 10 }}>Roles</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {roleOptions.map((role) => (
                <label key={role.id} style={chipStyle}>
                  <input
                    type="checkbox"
                    checked={userForm.role_ids.includes(role.id)}
                    onChange={() => toggleRole(role.id)}
                  />
                  <span>{role.code}</span>
                </label>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
            <button style={buttonStyle} disabled={busy || loading}>
              {userForm.id ? 'Guardar usuario' : 'Crear usuario'}
            </button>
            {userForm.id ? (
              <button
                type="button"
                style={ghostButtonStyle}
                onClick={() =>
                  setUserForm({
                    ...emptyUserForm,
                    tenant_group_id: tenantGroupOptions[0]?.id || '',
                  })
                }
              >
                Cancelar edición
              </button>
            ) : null}
          </div>
        </form>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 18,
          }}
        >
          <div style={cardStyle}>
            <SectionTitle title="Tenants" subtitle="Edición y borrado del catálogo superior." />
            <div style={{ overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={tableHeadCellStyle}>Code</th>
                    <th style={tableHeadCellStyle}>Nombre</th>
                    <th style={tableHeadCellStyle}>Tipo</th>
                    <th style={tableHeadCellStyle}>Status</th>
                    <th style={tableHeadCellStyle}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {tenantOptions.map((tenant) => (
                    <tr key={tenant.id}>
                      <td style={{ ...tableCellStyle, fontWeight: 700 }}>{tenant.code}</td>
                      <td style={tableCellStyle}>{tenant.name}</td>
                      <td style={tableCellStyle}>
                        <span style={{ fontSize:11, padding:'2px 8px', borderRadius:999, background: tenant.type==='platform'?'rgba(139,92,246,0.2)':tenant.type==='partner'?'rgba(59,130,246,0.2)':'rgba(34,197,94,0.2)', color: tenant.type==='platform'?'#c4b5fd':tenant.type==='partner'?'#93c5fd':'#86efac' }}>
                          {tenant.type||'client'}
                        </span>
                      </td>
                      <td style={tableCellStyle}>{tenant.status}</td>
                      <td style={tableCellStyle}>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            style={ghostButtonStyle}
                            onClick={() =>
                              setTenantForm({
                                id: tenant.id,
                                code: tenant.code,
                                name: tenant.name,
                                status: tenant.status || 'ACTIVE',
                                type: tenant.type || 'client',
                                parent_tenant_id: tenant.parent_tenant_id || '',
                              })
                            }
                          >
                            Editar
                          </button>
                          <button type="button" style={dangerButtonStyle} onClick={() => deleteTenant(tenant)}>
                            Borrar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!tenantOptions.length ? (
                    <tr>
                      <td style={tableCellStyle} colSpan={4}>Sin registros</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div style={cardStyle}>
            <SectionTitle title="Tenant groups" subtitle="Edición, borrado y visualización de pools atados." />
            <div style={{ overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={tableHeadCellStyle}>Grupo</th>
                    <th style={tableHeadCellStyle}>Tenant</th>
                    <th style={tableHeadCellStyle}>Pools</th>
                    <th style={tableHeadCellStyle}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {tenantGroupOptions.map((group) => (
                    <tr key={group.id}>
                      <td style={tableCellStyle}>
                        <strong>{group.name}</strong>
                        <div style={{ fontSize: 12, color: theme.muted }}>{group.code}</div>
                      </td>
                      <td style={tableCellStyle}>{group.tenant?.name || 'n/a'}</td>
                      <td style={tableCellStyle}>
                        {(group.pools || []).map((pool) => pool.name).join(', ') || 'Sin pools'}
                      </td>
                      <td style={tableCellStyle}>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            style={ghostButtonStyle}
                            onClick={() =>
                              setTenantGroupForm({
                                id: group.id,
                                tenant_id: group.tenant?.id || '',
                                code: group.code,
                                name: group.name,
                              })
                            }
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            style={dangerButtonStyle}
                            onClick={() => deleteTenantGroup(group)}
                          >
                            Borrar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!tenantGroupOptions.length ? (
                    <tr>
                      <td style={tableCellStyle} colSpan={4}>Sin registros</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(320px, 1fr) minmax(360px, 1.2fr)',
            gap: 18,
          }}
        >
          <div style={cardStyle}>
            <SectionTitle
              title="Asignación de pools"
              subtitle="Selecciona un tenant group y define los pools visibles."
            />
            <div style={{ display: 'grid', gap: 12 }}>
              <Field label="Tenant group">
                <select style={inputStyle} value={poolGroupId} onChange={(e) => setPoolGroupId(e.target.value)}>
                  <option value="">Selecciona un tenant group</option>
                  {tenantGroupOptions.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name} ({group.code})
                    </option>
                  ))}
                </select>
              </Field>

              <div style={{ display: 'grid', gap: 8, maxHeight: 280, overflow: 'auto', paddingRight: 4 }}>
                {poolOptions.map((pool) => (
                  <label
                    key={pool.id}
                    style={{
                      display: 'flex',
                      gap: 8,
                      alignItems: 'center',
                      padding: '10px 12px',
                      border: `1px solid ${theme.border}`,
                      borderRadius: 10,
                      background: theme.card2,
                      color: theme.pageText,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedPoolIds.includes(pool.id)}
                      onChange={() => togglePool(pool.id)}
                    />
                    <div>
                      <div style={{ fontWeight: 700 }}>{pool.name}</div>
                      <div style={{ fontSize: 12, color: theme.muted }}>{pool.external_id}</div>
                    </div>
                  </label>
                ))}
                {!poolOptions.length ? <div style={{ color: theme.muted }}>No hay pools disponibles.</div> : null}
              </div>

              <button type="button" style={buttonStyle} onClick={savePoolBindings} disabled={busy || !poolGroupId}>
                Guardar pools
              </button>
            </div>
          </div>

          <div style={cardStyle}>
            <SectionTitle title="Usuarios" subtitle="Edición, habilitar/deshabilitar y borrado total." />
            <div style={{ overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={tableHeadCellStyle}>Usuario</th>
                    <th style={tableHeadCellStyle}>Tenant</th>
                    <th style={tableHeadCellStyle}>Roles</th>
                    <th style={tableHeadCellStyle}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {data.users.map((user) => (
                    <tr key={user.id}>
                      <td style={tableCellStyle}>
                        <div style={{ fontWeight: 700 }}>{user.email}</div>
                        <div style={{ color: theme.muted, fontSize: 12 }}>{user.keycloak_id}</div>
                      </td>
                      <td style={tableCellStyle}>
                        {user.tenant_name ? (
                          <div>
                            <div style={{ fontWeight:600 }}>{user.tenant_name}</div>
                            <div style={{ fontSize:11, color:'#b8abd9' }}>{user.tenant_type}</div>
                          </div>
                        ) : 'Sin asignar'}
                      </td>
                      <td style={tableCellStyle}>
                        {(user.roles || []).map((role) => role.code).join(', ') || 'Sin roles'}
                      </td>
                      <td style={tableCellStyle}>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button type="button" style={ghostButtonStyle} onClick={() => startEditUser(user)}>
                            Editar
                          </button>
                          <button type="button" style={ghostButtonStyle} onClick={() => toggleUserEnabled(user, false)}>
                            Deshabilitar
                          </button>
                          <button type="button" style={ghostButtonStyle} onClick={() => toggleUserEnabled(user, true)}>
                            Habilitar
                          </button>
                          <button type="button" style={dangerButtonStyle} onClick={() => deleteUser(user)}>
                            Borrar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!data.users.length ? (
                    <tr>
                      <td style={tableCellStyle} colSpan={4}>Sin registros</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>


        <div style={cardStyle}>
          <SectionTitle
            title="Asignar activos a clientes"
            subtitle="Define qué activos monitoreados pertenecen a cada cliente final."
          />
          <div style={{ overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={tableHeadCellStyle}>Activo</th>
                  <th style={tableHeadCellStyle}>OS</th>
                  <th style={tableHeadCellStyle}>Status agente</th>
                  <th style={tableHeadCellStyle}>Cliente asignado</th>
                  <th style={tableHeadCellStyle}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {assets.map((asset) => {
                  const assignment = asset.tenant_assignments?.[0]
                  const assignedTenant = assignment?.tenant_id
                    ? tenantOptions.find(t => t.id === assignment.tenant_id)
                    : null
                  return (
                    <tr key={asset.id}>
                      <td style={tableCellStyle}>
                        <div style={{ fontWeight: 700 }}>{asset.display_name || asset.host_name}</div>
                        <div style={{ fontSize: 11, color: '#b8abd9' }}>{asset.agent_version}</div>
                      </td>
                      <td style={tableCellStyle}>{asset.os_type || '—'}</td>
                      <td style={tableCellStyle}>
                        <span style={{ color: asset.agent_status === 'online' ? '#22c55e' : '#ef4444', fontWeight: 700 }}>
                          {asset.agent_status || '—'}
                        </span>
                      </td>
                      <td style={tableCellStyle}>
                        <select
                          style={{ ...inputStyle, width: 200 }}
                          value={assignment?.tenant_id || ''}
                          onChange={async (e) => {
                            const tenantId = e.target.value
                            try {
                              if (tenantId) {
                                await request(`/api/admin/assets/${asset.id}/assign`, {
                                  method: 'POST',
                                  body: JSON.stringify({ tenantId }),
                                })
                              } else {
                                await request(`/api/admin/assets/${asset.id}/assign`, { method: 'DELETE' })
                              }
                              const updated = await request('/api/admin/assets').catch(() => [])
                              setAssets(Array.isArray(updated) ? updated : [])
                              setSuccess('Asignación guardada')
                            } catch (err) {
                              setError(err.message || 'Error al asignar')
                            }
                          }}
                        >
                          <option value="">Sin asignar</option>
                          {tenantOptions.filter(t => t.type === 'client').map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                      </td>
                      <td style={tableCellStyle}>
                        {assignedTenant && (
                          <span style={{ fontSize: 11, color: '#86efac' }}>✓ {assignedTenant.name}</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {!assets.length && (
                  <tr><td colSpan={5} style={tableCellStyle}>Sin activos</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div style={cardStyle}>
          <SectionTitle
            title="Inventario VM"
            subtitle="Mantenimiento rápido de observabilidad y catálogos del inventario local."
          />

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(280px, 0.95fr) minmax(320px, 1.05fr)',
              gap: 18,
            }}
          >
            <div>
              <div style={{ marginBottom: 12 }}>
                <input
                  style={inputStyle}
                  placeholder="Buscar VM por nombre, vmid, nodo o pool"
                  value={vmSearch}
                  onChange={(e) => setVmSearch(e.target.value)}
                />
              </div>

              <div style={{ maxHeight: 420, overflow: 'auto', display: 'grid', gap: 8 }}>
                {filteredVms.map((vm) => (
                  <button
                    key={vm.vmid}
                    type="button"
                    onClick={() => setSelectedVmId(String(vm.vmid))}
                    style={{
                      textAlign: 'left',
                      padding: 12,
                      borderRadius: 12,
                      border:
                        selectedVmId === String(vm.vmid)
                          ? `2px solid ${theme.primary}`
                          : `1px solid ${theme.border}`,
                      background: selectedVmId === String(vm.vmid) ? theme.card3 : theme.card2,
                      color: theme.pageText,
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <strong>{vm.name || `VM ${vm.vmid}`}</strong>
                      <span style={{ color: theme.muted }}>{vm.status || 'unknown'}</span>
                    </div>
                    <div style={{ marginTop: 6, fontSize: 12, color: theme.muted }}>
                      vmid: {vm.vmid} · nodo: {vm.node || 'n/a'} · pool: {vm.pool_id || 'sin pool'}
                    </div>
                  </button>
                ))}
                {!filteredVms.length ? <div style={{ color: theme.muted }}>No hay VMs para mostrar.</div> : null}
              </div>
            </div>

            <form onSubmit={saveVm} style={{ display: 'grid', gap: 12 }}>
              {!selectedVmId ? (
                <div style={{ color: theme.muted, fontSize: 14 }}>Selecciona una VM para editarla.</div>
              ) : (
                <>
                  <Field label="OS type">
                    <select
                      style={inputStyle}
                      value={vmForm.os_type}
                      onChange={(e) => setVmForm({ ...vmForm, os_type: e.target.value })}
                    >
                      <option value="">Sin definir</option>
                      <option value="windows">windows</option>
                      <option value="linux">linux</option>
                    </select>
                  </Field>

                  <Field label="Elastic host name">
                    <input
                      style={inputStyle}
                      value={vmForm.elastic_host_name}
                      onChange={(e) => setVmForm({ ...vmForm, elastic_host_name: e.target.value })}
                    />
                  </Field>

                  <Field label="Kibana base URL">
                    <input
                      style={inputStyle}
                      value={vmForm.kibana_base_url}
                      onChange={(e) => setVmForm({ ...vmForm, kibana_base_url: e.target.value })}
                    />
                  </Field>

                  <Field label="Monitored services">
                    <textarea
                      style={textareaStyle}
                      value={vmForm.monitored_services}
                      onChange={(e) => setVmForm({ ...vmForm, monitored_services: e.target.value })}
                    />
                  </Field>

                  <Field label="Tenant">
                    <select
                      style={inputStyle}
                      value={vmForm.tenant_id}
                      onChange={(e) => setVmForm({ ...vmForm, tenant_id: e.target.value })}
                    >
                      <option value="">Sin tenant</option>
                      {tenantOptions.map((tenant) => (
                        <option key={tenant.id} value={tenant.id}>
                          {tenant.name} ({tenant.code})
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Tenant group">
                    <select
                      style={inputStyle}
                      value={vmForm.tenant_group_id}
                      onChange={(e) => setVmForm({ ...vmForm, tenant_group_id: e.target.value })}
                    >
                      <option value="">Sin tenant group</option>
                      {tenantGroupOptions.map((group) => (
                        <option key={group.id} value={group.id}>
                          {group.name} ({group.code})
                        </option>
                      ))}
                    </select>
                  </Field>

                  <label
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: 14,
                      color: theme.pageText,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={vmForm.observability_enabled}
                      onChange={(e) =>
                        setVmForm({ ...vmForm, observability_enabled: e.target.checked })
                      }
                    />
                    Observabilidad habilitada
                  </label>

                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button style={buttonStyle} disabled={busy || loading}>
                      Guardar VM
                    </button>
                    <button type="button" style={dangerButtonStyle} onClick={deleteVm}>
                      Borrar VM local
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      </div>
    </AppShell>
  )
}