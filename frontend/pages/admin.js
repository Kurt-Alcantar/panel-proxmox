import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import AppShell from '../components/AppShell'

const cardStyle = {
  background: 'rgba(255,255,255,0.97)',
  borderRadius: 16,
  padding: 18,
  border: '1px solid #e5e7eb',
  boxShadow: '0 12px 30px rgba(15,23,42,0.10)',
}

const inputStyle = {
  width: '100%',
  border: '1px solid #d1d5db',
  borderRadius: 10,
  padding: '10px 12px',
  fontSize: 14,
  background: '#fff',
}

const buttonStyle = {
  border: 'none',
  borderRadius: 10,
  padding: '10px 14px',
  background: '#111827',
  color: '#fff',
  cursor: 'pointer',
  fontWeight: 700,
}

const altButtonStyle = {
  ...buttonStyle,
  background: '#7c3aed',
}

const ghostButtonStyle = {
  ...buttonStyle,
  background: '#e5e7eb',
  color: '#111827',
}

const dangerButtonStyle = {
  ...buttonStyle,
  background: '#b91c1c',
}

const labelStyle = {
  display: 'grid',
  gap: 6,
  fontSize: 13,
  color: '#374151',
}

function SectionTitle({ title, subtitle, actions }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', marginBottom: 14 }}>
      <div>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#111827' }}>{title}</div>
        {subtitle ? <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>{subtitle}</div> : null}
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

const emptyTenantForm = { id: '', code: '', name: '', status: 'ACTIVE' }
const emptyTenantGroupForm = { id: '', tenant_id: '', code: '', name: '' }
const emptyUserForm = {
  id: '',
  username: '',
  email: '',
  firstName: '',
  lastName: '',
  password: '',
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
  const [data, setData] = useState(emptyBootstrap)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [poolGroupId, setPoolGroupId] = useState('')
  const [selectedPoolIds, setSelectedPoolIds] = useState([])
  const [tenantForm, setTenantForm] = useState(emptyTenantForm)
  const [tenantGroupForm, setTenantGroupForm] = useState(emptyTenantGroupForm)
  const [userForm, setUserForm] = useState(emptyUserForm)
  const [vmForm, setVmForm] = useState(emptyVmForm)
  const [vmSearch, setVmSearch] = useState('')
  const [selectedVmId, setSelectedVmId] = useState('')

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null

  const clearMessages = () => {
    setError('')
    setSuccess('')
  }

  const fetchWithRefresh = async (url, options = {}) => {
    const accessToken = localStorage.getItem('token')
    const refreshToken = localStorage.getItem('refresh_token')

    const attempt = async (currentToken) => fetch(url, {
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
      localStorage.removeItem('token')
      localStorage.removeItem('refresh_token')
      router.replace('/login')
      throw new Error('Sesión expirada')
    }

    const refreshResponse = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })

    const refreshData = await refreshResponse.json().catch(() => ({}))
    if (!refreshResponse.ok || !refreshData.access_token) {
      localStorage.removeItem('token')
      localStorage.removeItem('refresh_token')
      router.replace('/login')
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
    const payload = text ? JSON.parse(text) : null
    if (!response.ok) {
      throw new Error(payload?.message || payload?.error || `HTTP ${response.status}`)
    }
    return payload
  }

  const refreshData = async () => {
    clearMessages()
    try {
      const bootstrap = await request('/api/admin/bootstrap')
      setData(bootstrap)

      if (!poolGroupId && bootstrap.tenantGroups?.length) {
        setPoolGroupId(bootstrap.tenantGroups[0].id)
        setSelectedPoolIds((bootstrap.tenantGroups[0].pools || []).map((pool) => pool.id))
      }

      if (!selectedVmId && bootstrap.vms?.length) {
        setSelectedVmId(String(bootstrap.vms[0].vmid))
      }
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    if (!token) {
      router.replace('/login')
      return
    }
    refreshData()
  }, [])

  useEffect(() => {
    if (!poolGroupId) return
    const group = data.tenantGroups.find((item) => item.id === poolGroupId)
    setSelectedPoolIds((group?.pools || []).map((pool) => pool.id))
  }, [poolGroupId, data.tenantGroups])

  useEffect(() => {
    if (!selectedVmId) return
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
    return (data.vms || []).filter((vm) => [vm.name, vm.node, vm.pool_id, String(vm.vmid)].some((value) => String(value || '').toLowerCase().includes(term)))
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
    setSelectedPoolIds((current) => current.includes(poolId) ? current.filter((value) => value !== poolId) : [...current, poolId])
  }

  const runAction = async (action, onSuccessMessage) => {
    clearMessages()
    setBusy(true)
    try {
      await action()
      await refreshData()
      if (onSuccessMessage) setSuccess(onSuccessMessage)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const submitTenant = (e) => {
    e.preventDefault()
    const payload = { code: tenantForm.code, name: tenantForm.name, status: tenantForm.status }
    const path = tenantForm.id ? `/api/admin/tenants/${tenantForm.id}` : '/api/admin/tenants'
    const method = tenantForm.id ? 'PATCH' : 'POST'

    runAction(async () => {
      await request(path, { method, body: JSON.stringify(payload) })
      setTenantForm(emptyTenantForm)
    }, tenantForm.id ? 'Tenant actualizado' : 'Tenant creado')
  }

  const deleteTenant = (tenant) => {
    if (!confirm(`Se eliminará el tenant ${tenant.name}. Continúo?`)) return
    runAction(() => request(`/api/admin/tenants/${tenant.id}`, { method: 'DELETE' }), 'Tenant eliminado')
  }

  const submitTenantGroup = (e) => {
    e.preventDefault()
    const payload = { tenant_id: tenantGroupForm.tenant_id, code: tenantGroupForm.code, name: tenantGroupForm.name }
    const path = tenantGroupForm.id ? `/api/admin/tenant-groups/${tenantGroupForm.id}` : '/api/admin/tenant-groups'
    const method = tenantGroupForm.id ? 'PATCH' : 'POST'

    runAction(async () => {
      await request(path, { method, body: JSON.stringify(payload) })
      setTenantGroupForm(emptyTenantGroupForm)
    }, tenantGroupForm.id ? 'Tenant group actualizado' : 'Tenant group creado')
  }

  const deleteTenantGroup = (group) => {
    if (!confirm(`Se eliminará el tenant group ${group.name}. Continúo?`)) return
    runAction(() => request(`/api/admin/tenant-groups/${group.id}`, { method: 'DELETE' }), 'Tenant group eliminado')
  }

  const submitUser = (e) => {
    e.preventDefault()
    const payload = {
      username: userForm.username,
      email: userForm.email,
      firstName: userForm.firstName,
      lastName: userForm.lastName,
      password: userForm.password,
      tenant_group_id: userForm.tenant_group_id || null,
      role_ids: userForm.role_ids,
      enabled: userForm.enabled,
    }
    const path = userForm.id ? `/api/admin/users/${userForm.id}` : '/api/admin/users'
    const method = userForm.id ? 'PATCH' : 'POST'

    runAction(async () => {
      await request(path, { method, body: JSON.stringify(payload) })
      setUserForm(emptyUserForm)
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
      tenant_group_id: user.tenant_group?.id || '',
      role_ids: (user.roles || []).map((role) => role.id),
      enabled: true,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const toggleUserEnabled = (user, enabled) => {
    runAction(() => request(`/api/admin/users/${user.id}/${enabled ? 'enable' : 'disable'}`, { method: 'POST' }), enabled ? 'Usuario habilitado' : 'Usuario deshabilitado')
  }

  const deleteUser = (user) => {
    if (!confirm(`Se eliminará el usuario ${user.email}. También se borrará de Keycloak. Continúo?`)) return
    runAction(async () => {
      await request(`/api/admin/users/${user.id}`, { method: 'DELETE' })
      setUserForm(emptyUserForm)
    }, 'Usuario eliminado')
  }

  const savePoolBindings = () => {
    if (!poolGroupId) return
    runAction(() => request(`/api/admin/tenant-groups/${poolGroupId}/pools`, {
      method: 'PUT',
      body: JSON.stringify({ pool_ids: selectedPoolIds }),
    }), 'Asignación de pools guardada')
  }

  const saveVm = (e) => {
    e.preventDefault()
    if (!vmForm.vmid) return
    runAction(() => request(`/api/admin/vms/${vmForm.vmid}`, {
      method: 'PATCH',
      body: JSON.stringify({
        ...vmForm,
        tenant_id: vmForm.tenant_id || null,
        tenant_group_id: vmForm.tenant_group_id || null,
      }),
    }), 'VM actualizada')
  }

  const deleteVm = () => {
    if (!vmForm.vmid) return
    if (!confirm(`Se borrará la VM ${vmForm.vmid} del inventario local. Continúo?`)) return
    runAction(async () => {
      await request(`/api/admin/vms/${vmForm.vmid}`, { method: 'DELETE' })
      setSelectedVmId('')
      setVmForm(emptyVmForm)
    }, 'VM eliminada del inventario local')
  }

  const syncAll = () => runAction(() => request('/api/admin/sync-all', { method: 'POST' }), 'Sincronización completada')

  return (
    <AppShell title="Administración" subtitle="CRUD operativo para tenants, grupos, usuarios, pools y metadatos de inventario.">
      <div style={{ display: 'grid', gap: 18 }}>
        {error ? <div style={{ background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', padding: 14, borderRadius: 12 }}>{error}</div> : null}
        {success ? <div style={{ background: '#ecfdf5', color: '#166534', border: '1px solid #bbf7d0', padding: 14, borderRadius: 12 }}>{success}</div> : null}

        <div style={cardStyle}>
          <SectionTitle
            title="Operación"
            subtitle="Sincroniza pools y VMs desde Proxmox y recarga el bootstrap del panel."
            actions={[
              <button key="sync" style={altButtonStyle} onClick={syncAll} disabled={busy}>Sincronizar pools + VMs</button>,
              <button key="reload" style={ghostButtonStyle} onClick={refreshData} disabled={busy}>Recargar datos</button>,
            ]}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(320px, 1fr))', gap: 18 }}>
          <form onSubmit={submitTenant} style={cardStyle}>
            <SectionTitle title={tenantForm.id ? 'Editar tenant' : 'Nuevo tenant'} subtitle="Catálogo principal para segmentar clientes o áreas." />
            <div style={{ display: 'grid', gap: 12 }}>
              <Field label="Code"><input style={inputStyle} value={tenantForm.code} onChange={(e) => setTenantForm({ ...tenantForm, code: e.target.value })} /></Field>
              <Field label="Nombre"><input style={inputStyle} value={tenantForm.name} onChange={(e) => setTenantForm({ ...tenantForm, name: e.target.value })} /></Field>
              <Field label="Status">
                <select style={inputStyle} value={tenantForm.status} onChange={(e) => setTenantForm({ ...tenantForm, status: e.target.value })}>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </Field>
              <div style={{ display: 'flex', gap: 10 }}>
                <button style={buttonStyle} disabled={busy}>{tenantForm.id ? 'Guardar cambios' : 'Crear tenant'}</button>
                {tenantForm.id ? <button type="button" style={ghostButtonStyle} onClick={() => setTenantForm(emptyTenantForm)}>Cancelar</button> : null}
              </div>
            </div>
          </form>

          <form onSubmit={submitTenantGroup} style={cardStyle}>
            <SectionTitle title={tenantGroupForm.id ? 'Editar tenant group' : 'Nuevo tenant group'} subtitle="Unidad operativa que liga usuarios, pools y visibilidad." />
            <div style={{ display: 'grid', gap: 12 }}>
              <Field label="Tenant">
                <select style={inputStyle} value={tenantGroupForm.tenant_id} onChange={(e) => setTenantGroupForm({ ...tenantGroupForm, tenant_id: e.target.value })}>
                  <option value="">Selecciona un tenant</option>
                  {tenantOptions.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name} ({tenant.code})</option>)}
                </select>
              </Field>
              <Field label="Code"><input style={inputStyle} value={tenantGroupForm.code} onChange={(e) => setTenantGroupForm({ ...tenantGroupForm, code: e.target.value })} /></Field>
              <Field label="Nombre"><input style={inputStyle} value={tenantGroupForm.name} onChange={(e) => setTenantGroupForm({ ...tenantGroupForm, name: e.target.value })} /></Field>
              <div style={{ display: 'flex', gap: 10 }}>
                <button style={buttonStyle} disabled={busy}>{tenantGroupForm.id ? 'Guardar cambios' : 'Crear tenant group'}</button>
                {tenantGroupForm.id ? <button type="button" style={ghostButtonStyle} onClick={() => setTenantGroupForm(emptyTenantGroupForm)}>Cancelar</button> : null}
              </div>
            </div>
          </form>
        </div>

        <form onSubmit={submitUser} style={cardStyle}>
          <SectionTitle title={userForm.id ? 'Editar usuario' : 'Alta de usuario'} subtitle="Crea o actualiza usuario en Keycloak, registro local y asignación de roles." />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 12 }}>
            <Field label="Username"><input style={inputStyle} value={userForm.username} onChange={(e) => setUserForm({ ...userForm, username: e.target.value })} /></Field>
            <Field label="Email"><input style={inputStyle} value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} /></Field>
            <Field label="Nombre(s)"><input style={inputStyle} value={userForm.firstName} onChange={(e) => setUserForm({ ...userForm, firstName: e.target.value })} /></Field>
            <Field label="Apellidos"><input style={inputStyle} value={userForm.lastName} onChange={(e) => setUserForm({ ...userForm, lastName: e.target.value })} /></Field>
            <Field label={userForm.id ? 'Nuevo password (opcional)' : 'Password inicial'}><input type="password" style={inputStyle} value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} /></Field>
            <Field label="Tenant group">
              <select style={inputStyle} value={userForm.tenant_group_id} onChange={(e) => setUserForm({ ...userForm, tenant_group_id: e.target.value })}>
                <option value="">Sin tenant group</option>
                {tenantGroupOptions.map((group) => <option key={group.id} value={group.id}>{group.name} ({group.code})</option>)}
              </select>
            </Field>
          </div>

          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 10 }}>Roles</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {roleOptions.map((role) => (
                <label key={role.id} style={{ display: 'inline-flex', gap: 8, alignItems: 'center', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 999 }}>
                  <input type="checkbox" checked={userForm.role_ids.includes(role.id)} onChange={() => toggleRole(role.id)} />
                  <span>{role.code}</span>
                </label>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button style={buttonStyle} disabled={busy}>{userForm.id ? 'Guardar usuario' : 'Crear usuario'}</button>
            {userForm.id ? <button type="button" style={ghostButtonStyle} onClick={() => setUserForm(emptyUserForm)}>Cancelar edición</button> : null}
          </div>
        </form>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(320px, 1fr))', gap: 18 }}>
          <div style={cardStyle}>
            <SectionTitle title="Tenants" subtitle="Edición y borrado del catálogo superior." />
            <div style={{ overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr><th style={{ textAlign: 'left', padding: '10px 8px' }}>Code</th><th style={{ textAlign: 'left', padding: '10px 8px' }}>Nombre</th><th style={{ textAlign: 'left', padding: '10px 8px' }}>Status</th><th style={{ textAlign: 'left', padding: '10px 8px' }}>Acciones</th></tr>
                </thead>
                <tbody>
                  {tenantOptions.map((tenant) => (
                    <tr key={tenant.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '10px 8px', fontWeight: 700 }}>{tenant.code}</td>
                      <td style={{ padding: '10px 8px' }}>{tenant.name}</td>
                      <td style={{ padding: '10px 8px' }}>{tenant.status}</td>
                      <td style={{ padding: '10px 8px' }}>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button type="button" style={ghostButtonStyle} onClick={() => setTenantForm({ id: tenant.id, code: tenant.code, name: tenant.name, status: tenant.status || 'ACTIVE' })}>Editar</button>
                          <button type="button" style={dangerButtonStyle} onClick={() => deleteTenant(tenant)}>Borrar</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={cardStyle}>
            <SectionTitle title="Tenant groups" subtitle="Edición, borrado y visualización de pools atados." />
            <div style={{ overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr><th style={{ textAlign: 'left', padding: '10px 8px' }}>Grupo</th><th style={{ textAlign: 'left', padding: '10px 8px' }}>Tenant</th><th style={{ textAlign: 'left', padding: '10px 8px' }}>Pools</th><th style={{ textAlign: 'left', padding: '10px 8px' }}>Acciones</th></tr>
                </thead>
                <tbody>
                  {tenantGroupOptions.map((group) => (
                    <tr key={group.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '10px 8px' }}><strong>{group.name}</strong><div style={{ fontSize: 12, color: '#6b7280' }}>{group.code}</div></td>
                      <td style={{ padding: '10px 8px' }}>{group.tenant?.name || 'n/a'}</td>
                      <td style={{ padding: '10px 8px' }}>{(group.pools || []).map((pool) => pool.name).join(', ') || 'Sin pools'}</td>
                      <td style={{ padding: '10px 8px' }}>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button type="button" style={ghostButtonStyle} onClick={() => setTenantGroupForm({ id: group.id, tenant_id: group.tenant?.id || '', code: group.code, name: group.name })}>Editar</button>
                          <button type="button" style={dangerButtonStyle} onClick={() => deleteTenantGroup(group)}>Borrar</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1fr) minmax(360px, 1.2fr)', gap: 18 }}>
          <div style={cardStyle}>
            <SectionTitle title="Asignación de pools" subtitle="Selecciona un tenant group y define los pools visibles." />
            <div style={{ display: 'grid', gap: 12 }}>
              <Field label="Tenant group">
                <select style={inputStyle} value={poolGroupId} onChange={(e) => setPoolGroupId(e.target.value)}>
                  <option value="">Selecciona un tenant group</option>
                  {tenantGroupOptions.map((group) => <option key={group.id} value={group.id}>{group.name} ({group.code})</option>)}
                </select>
              </Field>
              <div style={{ display: 'grid', gap: 8, maxHeight: 280, overflow: 'auto', paddingRight: 4 }}>
                {poolOptions.map((pool) => (
                  <label key={pool.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 10 }}>
                    <input type="checkbox" checked={selectedPoolIds.includes(pool.id)} onChange={() => togglePool(pool.id)} />
                    <div>
                      <div style={{ fontWeight: 700 }}>{pool.name}</div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>{pool.external_id}</div>
                    </div>
                  </label>
                ))}
              </div>
              <button style={buttonStyle} onClick={savePoolBindings} disabled={busy || !poolGroupId}>Guardar pools</button>
            </div>
          </div>

          <div style={cardStyle}>
            <SectionTitle title="Usuarios" subtitle="Edición, habilitar/deshabilitar y borrado total." />
            <div style={{ overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr><th style={{ textAlign: 'left', padding: '10px 8px' }}>Usuario</th><th style={{ textAlign: 'left', padding: '10px 8px' }}>Tenant group</th><th style={{ textAlign: 'left', padding: '10px 8px' }}>Roles</th><th style={{ textAlign: 'left', padding: '10px 8px' }}>Acciones</th></tr>
                </thead>
                <tbody>
                  {data.users.map((user) => (
                    <tr key={user.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '10px 8px' }}>
                        <div style={{ fontWeight: 700 }}>{user.email}</div>
                        <div style={{ color: '#6b7280', fontSize: 12 }}>{user.keycloak_id}</div>
                      </td>
                      <td style={{ padding: '10px 8px' }}>{user.tenant_group ? `${user.tenant_group.name} (${user.tenant_group.code})` : 'Sin asignar'}</td>
                      <td style={{ padding: '10px 8px' }}>{(user.roles || []).map((role) => role.code).join(', ') || 'Sin roles'}</td>
                      <td style={{ padding: '10px 8px' }}>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button type="button" style={ghostButtonStyle} onClick={() => startEditUser(user)}>Editar</button>
                          <button type="button" style={ghostButtonStyle} onClick={() => toggleUserEnabled(user, false)}>Deshabilitar</button>
                          <button type="button" style={ghostButtonStyle} onClick={() => toggleUserEnabled(user, true)}>Habilitar</button>
                          <button type="button" style={dangerButtonStyle} onClick={() => deleteUser(user)}>Borrar</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div style={cardStyle}>
          <SectionTitle title="Inventario VM" subtitle="Mantenimiento rápido de observabilidad y catálogos del inventario local." />
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 0.95fr) minmax(320px, 1.05fr)', gap: 18 }}>
            <div>
              <div style={{ marginBottom: 12 }}>
                <input style={inputStyle} placeholder="Buscar VM por nombre, vmid, nodo o pool" value={vmSearch} onChange={(e) => setVmSearch(e.target.value)} />
              </div>
              <div style={{ maxHeight: 420, overflow: 'auto', display: 'grid', gap: 8 }}>
                {filteredVms.map((vm) => (
                  <button key={vm.vmid} type="button" onClick={() => setSelectedVmId(String(vm.vmid))} style={{ textAlign: 'left', padding: 12, borderRadius: 12, border: selectedVmId === String(vm.vmid) ? '2px solid #111827' : '1px solid #e5e7eb', background: '#fff', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <strong>{vm.name || `VM ${vm.vmid}`}</strong>
                      <span style={{ color: '#6b7280' }}>{vm.status || 'unknown'}</span>
                    </div>
                    <div style={{ marginTop: 6, fontSize: 12, color: '#6b7280' }}>vmid: {vm.vmid} · nodo: {vm.node || 'n/a'} · pool: {vm.pool_id || 'sin pool'}</div>
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={saveVm} style={{ display: 'grid', gap: 12 }}>
              {!selectedVmId ? (
                <div style={{ color: '#6b7280', fontSize: 14 }}>Selecciona una VM para editarla.</div>
              ) : (
                <>
                  <Field label="OS type">
                    <select style={inputStyle} value={vmForm.os_type} onChange={(e) => setVmForm({ ...vmForm, os_type: e.target.value })}>
                      <option value="">Sin definir</option>
                      <option value="windows">windows</option>
                      <option value="linux">linux</option>
                    </select>
                  </Field>
                  <Field label="Elastic host name"><input style={inputStyle} value={vmForm.elastic_host_name} onChange={(e) => setVmForm({ ...vmForm, elastic_host_name: e.target.value })} /></Field>
                  <Field label="Kibana base URL"><input style={inputStyle} value={vmForm.kibana_base_url} onChange={(e) => setVmForm({ ...vmForm, kibana_base_url: e.target.value })} /></Field>
                  <Field label="Monitored services"><input style={inputStyle} value={vmForm.monitored_services} onChange={(e) => setVmForm({ ...vmForm, monitored_services: e.target.value })} /></Field>
                  <Field label="Tenant">
                    <select style={inputStyle} value={vmForm.tenant_id} onChange={(e) => setVmForm({ ...vmForm, tenant_id: e.target.value })}>
                      <option value="">Sin tenant</option>
                      {tenantOptions.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name} ({tenant.code})</option>)}
                    </select>
                  </Field>
                  <Field label="Tenant group">
                    <select style={inputStyle} value={vmForm.tenant_group_id} onChange={(e) => setVmForm({ ...vmForm, tenant_group_id: e.target.value })}>
                      <option value="">Sin tenant group</option>
                      {tenantGroupOptions.map((group) => <option key={group.id} value={group.id}>{group.name} ({group.code})</option>)}
                    </select>
                  </Field>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#374151' }}>
                    <input type="checkbox" checked={vmForm.observability_enabled} onChange={(e) => setVmForm({ ...vmForm, observability_enabled: e.target.checked })} />
                    Observabilidad habilitada
                  </label>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button style={buttonStyle} disabled={busy}>Guardar VM</button>
                    <button type="button" style={dangerButtonStyle} onClick={deleteVm}>Borrar VM local</button>
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
