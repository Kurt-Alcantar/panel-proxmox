import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import AppShell from '../components/AppShell'

const cardStyle = {
  background: '#fff',
  borderRadius: 14,
  padding: 18,
  boxShadow: '0 8px 26px rgba(15,23,42,0.08)',
  border: '1px solid #e5e7eb',
}

const inputStyle = {
  width: '100%',
  border: '1px solid #d1d5db',
  borderRadius: 10,
  padding: '10px 12px',
  fontSize: 14,
  background: '#fff',
}

const labelStyle = {
  display: 'grid',
  gap: 6,
  fontSize: 13,
  color: '#374151',
}

const buttonStyle = {
  border: 'none',
  borderRadius: 10,
  padding: '10px 14px',
  background: '#111827',
  color: '#fff',
  cursor: 'pointer',
  fontWeight: 600,
}

const ghostButtonStyle = {
  ...buttonStyle,
  background: '#e5e7eb',
  color: '#111827',
}

function SectionTitle({ title, subtitle }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>{title}</div>
      {subtitle ? <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>{subtitle}</div> : null}
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

export default function AdminPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [data, setData] = useState({
    tenants: [],
    tenantGroups: [],
    pools: [],
    roles: [],
    users: [],
    vms: [],
  })

  const [tenantForm, setTenantForm] = useState({ code: '', name: '', status: 'ACTIVE' })
  const [tenantGroupForm, setTenantGroupForm] = useState({ tenant_id: '', code: '', name: '' })
  const [userForm, setUserForm] = useState({
    username: '',
    email: '',
    firstName: '',
    lastName: '',
    password: '',
    tenant_group_id: '',
    role_ids: [],
  })
  const [poolGroupId, setPoolGroupId] = useState('')
  const [selectedPoolIds, setSelectedPoolIds] = useState([])
  const [vmSearch, setVmSearch] = useState('')
  const [selectedVmId, setSelectedVmId] = useState('')
  const [vmForm, setVmForm] = useState({
    os_type: '',
    elastic_host_name: '',
    kibana_base_url: '',
    monitored_services: '',
    observability_enabled: true,
    tenant_id: '',
    tenant_group_id: '',
  })

  const authFetch = async (url, options = {}) => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.replace('/login')
      throw new Error('Sesión no disponible')
    }

    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    })

    if (res.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('refresh_token')
      router.replace('/login')
      throw new Error('Sesión expirada')
    }

    const body = await res.text()
    let parsed = null
    try {
      parsed = body ? JSON.parse(body) : null
    } catch {
      parsed = body
    }

    if (!res.ok) {
      throw new Error(parsed?.message || parsed || 'Error inesperado')
    }

    return parsed
  }

  const loadBootstrap = async () => {
    setLoading(true)
    setError('')
    try {
      const payload = await authFetch('/api/admin/bootstrap')
      setData(payload)

      setTenantGroupForm((current) => ({
        ...current,
        tenant_id: current.tenant_id || payload.tenants?.[0]?.id || '',
      }))

      setUserForm((current) => ({
        ...current,
        tenant_group_id: current.tenant_group_id || payload.tenantGroups?.[0]?.id || '',
      }))

      const firstGroupId = poolGroupId || payload.tenantGroups?.[0]?.id || ''
      setPoolGroupId(firstGroupId)

      const firstGroup = payload.tenantGroups?.find((group) => group.id === firstGroupId)
      setSelectedPoolIds((firstGroup?.pools || []).map((pool) => pool.id))
    } catch (err) {
      setError(err.message || 'No se pudo cargar el módulo administrativo')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadBootstrap()
  }, [])

  useEffect(() => {
    const group = data.tenantGroups.find((item) => item.id === poolGroupId)
    setSelectedPoolIds((group?.pools || []).map((pool) => pool.id))
  }, [poolGroupId, data.tenantGroups])

  useEffect(() => {
    const vm = data.vms.find((item) => String(item.vmid) === String(selectedVmId))
    if (!vm) return

    setVmForm({
      os_type: vm.os_type || '',
      elastic_host_name: vm.elastic_host_name || '',
      kibana_base_url: vm.kibana_base_url || '',
      monitored_services: vm.monitored_services || '',
      observability_enabled: vm.observability_enabled !== false,
      tenant_id: vm.tenant_id || '',
      tenant_group_id: vm.tenant_group_id || '',
    })
  }, [selectedVmId, data.vms])

  const roleOptions = data.roles || []
  const tenantOptions = data.tenants || []
  const tenantGroupOptions = data.tenantGroups || []
  const poolOptions = data.pools || []

  const filteredVms = useMemo(() => {
    const search = vmSearch.trim().toLowerCase()
    if (!search) return data.vms
    return data.vms.filter((vm) => {
      return [vm.vmid, vm.name, vm.node, vm.pool_id, vm.status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search))
    })
  }, [data.vms, vmSearch])

  const submit = async (label, fn) => {
    setBusy(true)
    setError('')
    setSuccess('')
    try {
      await fn()
      setSuccess(label)
      await loadBootstrap()
    } catch (err) {
      setError(err.message || 'Error inesperado')
    } finally {
      setBusy(false)
    }
  }

  const createTenant = async (event) => {
    event.preventDefault()
    await submit('Tenant creado correctamente', async () => {
      await authFetch('/api/admin/tenants', {
        method: 'POST',
        body: JSON.stringify(tenantForm),
      })
      setTenantForm({ code: '', name: '', status: 'ACTIVE' })
    })
  }

  const createTenantGroup = async (event) => {
    event.preventDefault()
    await submit('Tenant group creado correctamente', async () => {
      await authFetch('/api/admin/tenant-groups', {
        method: 'POST',
        body: JSON.stringify(tenantGroupForm),
      })
      setTenantGroupForm((current) => ({ ...current, code: '', name: '' }))
    })
  }

  const createUser = async (event) => {
    event.preventDefault()
    await submit('Usuario creado o actualizado correctamente', async () => {
      await authFetch('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify(userForm),
      })
      setUserForm({
        username: '',
        email: '',
        firstName: '',
        lastName: '',
        password: '',
        tenant_group_id: tenantGroupOptions[0]?.id || '',
        role_ids: [],
      })
    })
  }

  const savePoolBindings = async () => {
    if (!poolGroupId) return
    await submit('Pools asignados correctamente', async () => {
      await authFetch(`/api/admin/tenant-groups/${poolGroupId}/pools`, {
        method: 'PUT',
        body: JSON.stringify({ pool_ids: selectedPoolIds }),
      })
    })
  }

  const saveVm = async (event) => {
    event.preventDefault()
    if (!selectedVmId) return

    await submit('VM actualizada correctamente', async () => {
      await authFetch(`/api/admin/vms/${selectedVmId}`, {
        method: 'PATCH',
        body: JSON.stringify(vmForm),
      })
    })
  }

  const syncAll = async () => {
    await submit('Sincronización completa ejecutada', async () => {
      await authFetch('/api/admin/sync-all', { method: 'POST' })
    })
  }

  const toggleRole = (roleId) => {
    setUserForm((current) => ({
      ...current,
      role_ids: current.role_ids.includes(roleId)
        ? current.role_ids.filter((item) => item !== roleId)
        : [...current.role_ids, roleId],
    }))
  }

  const togglePool = (poolId) => {
    setSelectedPoolIds((current) =>
      current.includes(poolId) ? current.filter((item) => item !== poolId) : [...current, poolId]
    )
  }

  return (
   

      <div style={{ display: 'grid', gap: 18 }}>
        {(error || success) && (
          <div
            style={{
              ...cardStyle,
              borderColor: error ? '#fecaca' : '#bbf7d0',
              background: error ? '#fef2f2' : '#f0fdf4',
              color: error ? '#991b1b' : '#166534',
            }}
          >
            {error || success}
          </div>
        )}

        <div style={{ ...cardStyle, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <SectionTitle title="Operación" subtitle="Sincroniza pools y VMs desde Proxmox antes de asignar." />
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button style={buttonStyle} onClick={syncAll} disabled={busy || loading}>
              {busy ? 'Procesando...' : 'Sincronizar pools + VMs'}
            </button>
            <button style={ghostButtonStyle} onClick={loadBootstrap} disabled={busy || loading}>
              Recargar datos
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 18 }}>
          <form onSubmit={createTenant} style={cardStyle}>
            <SectionTitle title="Nuevo tenant" subtitle="Crea el catálogo superior para agrupar tenant groups." />
            <div style={{ display: 'grid', gap: 12 }}>
              <Field label="Code">
                <input style={inputStyle} value={tenantForm.code} onChange={(e) => setTenantForm({ ...tenantForm, code: e.target.value })} />
              </Field>
              <Field label="Nombre">
                <input style={inputStyle} value={tenantForm.name} onChange={(e) => setTenantForm({ ...tenantForm, name: e.target.value })} />
              </Field>
              <Field label="Status">
                <select style={inputStyle} value={tenantForm.status} onChange={(e) => setTenantForm({ ...tenantForm, status: e.target.value })}>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </Field>
              <button style={buttonStyle} disabled={busy}>Guardar tenant</button>
            </div>
          </form>

          <form onSubmit={createTenantGroup} style={cardStyle}>
            <SectionTitle title="Nuevo tenant group" subtitle="Este grupo será el punto de unión entre usuarios y pools." />
            <div style={{ display: 'grid', gap: 12 }}>
              <Field label="Tenant">
                <select
                  style={inputStyle}
                  value={tenantGroupForm.tenant_id}
                  onChange={(e) => setTenantGroupForm({ ...tenantGroupForm, tenant_id: e.target.value })}
                >
                  {tenantOptions.map((tenant) => (
                    <option key={tenant.id} value={tenant.id}>
                      {tenant.name} ({tenant.code})
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Code">
                <input style={inputStyle} value={tenantGroupForm.code} onChange={(e) => setTenantGroupForm({ ...tenantGroupForm, code: e.target.value })} />
              </Field>
              <Field label="Nombre">
                <input style={inputStyle} value={tenantGroupForm.name} onChange={(e) => setTenantGroupForm({ ...tenantGroupForm, name: e.target.value })} />
              </Field>
              <button style={buttonStyle} disabled={busy}>Guardar tenant group</button>
            </div>
          </form>
        </div>

        <form onSubmit={createUser} style={cardStyle}>
          <SectionTitle title="Alta de usuario" subtitle="Crea usuario en Keycloak, registra usuario local y asigna tenant group + roles." />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <Field label="Username">
              <input style={inputStyle} value={userForm.username} onChange={(e) => setUserForm({ ...userForm, username: e.target.value })} />
            </Field>
            <Field label="Email">
              <input style={inputStyle} value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} />
            </Field>
            <Field label="Nombre(s)">
              <input style={inputStyle} value={userForm.firstName} onChange={(e) => setUserForm({ ...userForm, firstName: e.target.value })} />
            </Field>
            <Field label="Apellidos">
              <input style={inputStyle} value={userForm.lastName} onChange={(e) => setUserForm({ ...userForm, lastName: e.target.value })} />
            </Field>
            <Field label="Password inicial">
              <input type="password" style={inputStyle} value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} />
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
            <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 10 }}>Roles</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {roleOptions.map((role) => (
                <label key={role.id} style={{ display: 'inline-flex', gap: 8, alignItems: 'center', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 999 }}>
                  <input type="checkbox" checked={userForm.role_ids.includes(role.id)} onChange={() => toggleRole(role.id)} />
                  <span>{role.code}</span>
                </label>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <button style={buttonStyle} disabled={busy}>Crear usuario</button>
          </div>
        </form>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1fr) minmax(320px, 1.3fr)', gap: 18 }}>
          <div style={cardStyle}>
            <SectionTitle title="Asignación de pools" subtitle="Selecciona un tenant group y amarra los pools que podrá ver." />
            <div style={{ display: 'grid', gap: 12 }}>
              <Field label="Tenant group">
                <select style={inputStyle} value={poolGroupId} onChange={(e) => setPoolGroupId(e.target.value)}>
                  {tenantGroupOptions.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name} ({group.code})
                    </option>
                  ))}
                </select>
              </Field>

              <div style={{ display: 'grid', gap: 8, maxHeight: 280, overflow: 'auto', paddingRight: 6 }}>
                {poolOptions.map((pool) => (
                  <label key={pool.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 10 }}>
                    <input type="checkbox" checked={selectedPoolIds.includes(pool.id)} onChange={() => togglePool(pool.id)} />
                    <div>
                      <div style={{ fontWeight: 600, color: '#111827' }}>{pool.name}</div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>{pool.external_id}</div>
                    </div>
                  </label>
                ))}
              </div>

              <button style={buttonStyle} onClick={savePoolBindings} disabled={busy || !poolGroupId}>
                Guardar asignación de pools
              </button>
            </div>
          </div>

          <div style={cardStyle}>
            <SectionTitle title="Usuarios existentes" subtitle="Vista operativa de usuarios con roles y tenant group asignado." />
            <div style={{ overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '10px 8px' }}>Email</th>
                    <th style={{ textAlign: 'left', padding: '10px 8px' }}>Tenant group</th>
                    <th style={{ textAlign: 'left', padding: '10px 8px' }}>Roles</th>
                  </tr>
                </thead>
                <tbody>
                  {data.users.map((user) => (
                    <tr key={user.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '10px 8px' }}>
                        <div style={{ fontWeight: 600 }}>{user.email}</div>
                        <div style={{ color: '#6001f8', fontSize: 12 }}>{user.keycloak_id}</div>
                      </td>
                      <td style={{ padding: '10px 8px' }}>
                        {user.tenant_group ? `${user.tenant_group.name} (${user.tenant_group.code})` : 'Sin asignar'}
                      </td>
                      <td style={{ padding: '10px 8px' }}>{(user.roles || []).map((role) => role.code).join(', ') || 'Sin roles'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div style={cardStyle}>
          <SectionTitle title="Inventario VM" subtitle="Mantenimiento rápido para metadatos de observabilidad y asignaciones de negocio." />
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 0.95fr) minmax(320px, 1.05fr)', gap: 18 }}>
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
                    type="button"
                    key={vm.vmid}
                    onClick={() => setSelectedVmId(String(vm.vmid))}
                    style={{
                      textAlign: 'left',
                      padding: 12,
                      borderRadius: 12,
                      border: selectedVmId === String(vm.vmid) ? '2px solid #111827' : '1px solid #e5e7eb',
                      background: '#fff',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <strong>{vm.name || `VM ${vm.vmid}`}</strong>
                      <span style={{ color: '#6b7280' }}>{vm.status || 'unknown'}</span>
                    </div>
                    <div style={{ marginTop: 6, fontSize: 12, color: '#6b7280' }}>
                      vmid: {vm.vmid} · nodo: {vm.node || 'n/a'} · pool: {vm.pool_id || 'sin pool'}
                    </div>
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
                  <Field label="Elastic host name">
                    <input style={inputStyle} value={vmForm.elastic_host_name} onChange={(e) => setVmForm({ ...vmForm, elastic_host_name: e.target.value })} />
                  </Field>
                  <Field label="Kibana base URL">
                    <input style={inputStyle} value={vmForm.kibana_base_url} onChange={(e) => setVmForm({ ...vmForm, kibana_base_url: e.target.value })} />
                  </Field>
                  <Field label="Monitored services">
                    <input style={inputStyle} value={vmForm.monitored_services} onChange={(e) => setVmForm({ ...vmForm, monitored_services: e.target.value })} />
                  </Field>
                  <Field label="Tenant">
                    <select style={inputStyle} value={vmForm.tenant_id} onChange={(e) => setVmForm({ ...vmForm, tenant_id: e.target.value })}>
                      <option value="">Sin tenant</option>
                      {tenantOptions.map((tenant) => (
                        <option key={tenant.id} value={tenant.id}>
                          {tenant.name} ({tenant.code})
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Tenant group">
                    <select style={inputStyle} value={vmForm.tenant_group_id} onChange={(e) => setVmForm({ ...vmForm, tenant_group_id: e.target.value })}>
                      <option value="">Sin tenant group</option>
                      {tenantGroupOptions.map((group) => (
                        <option key={group.id} value={group.id}>
                          {group.name} ({group.code})
                        </option>
                      ))}
                    </select>
                  </Field>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#374151' }}>
                    <input
                      type="checkbox"
                      checked={vmForm.observability_enabled}
                      onChange={(e) => setVmForm({ ...vmForm, observability_enabled: e.target.checked })}
                    />
                    Observabilidad habilitada
                  </label>
                  <div>
                    <button style={buttonStyle} disabled={busy}>Guardar VM</button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      </div>
   
  )
}
