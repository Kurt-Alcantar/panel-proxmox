import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import AppShell from '../components/AppShell'
import { apiJson } from '../lib/auth'

// ─── Estilos base ────────────────────────────────────────────────

const inp = {
  width: '100%', background: 'var(--surface-2)', border: '1px solid var(--border)',
  borderRadius: 'var(--r-sm)', padding: '8px 10px', fontSize: 13, color: 'var(--text)',
  outline: 'none', boxSizing: 'border-box',
}
const btn = (variant = 'primary') => ({
  padding: '8px 18px', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer',
  borderRadius: 'var(--r-sm)',
  ...(variant === 'primary' ? { background: 'var(--cyan)', color: '#fff' } : {}),
  ...(variant === 'ghost'   ? { background: 'var(--surface-3)', color: 'var(--text-2)', border: '1px solid var(--border)' } : {}),
  ...(variant === 'danger'  ? { background: 'rgba(239,68,68,0.15)', color: 'var(--red)', border: '1px solid rgba(239,68,68,0.3)' } : {}),
})
const lbl = { fontSize: 12, color: 'var(--text-4)', display: 'block', marginBottom: 4 }

function Field({ label, children }) {
  return <div style={{ display: 'grid', gap: 4 }}><label style={lbl}>{label}</label>{children}</div>
}

function Alert({ type = 'error', children }) {
  const colors = { error: ['var(--red-dim)', 'var(--red)'], ok: ['var(--green-dim)', 'var(--green)'] }
  const [bg, color] = colors[type] || colors.error
  return <div style={{ background: bg, color, border: `1px solid ${color}`, borderRadius: 'var(--r-sm)', padding: '10px 14px', fontSize: 13 }}>{children}</div>
}

// ─── Wizard Shell ─────────────────────────────────────────────────

function Wizard({ steps, onClose, onFinish, title }) {
  const [step, setStep] = useState(0)
  const [data, setData] = useState({})
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const current = steps[step]
  const isLast = step === steps.length - 1

  const next = async (stepData) => {
    setErr('')
    const merged = { ...data, ...stepData }
    setData(merged)
    if (isLast) {
      setBusy(true)
      try {
        await onFinish(merged)
        onClose()
      } catch (e) {
        setErr(e.message || 'Error al guardar')
      } finally {
        setBusy(false)
      }
    } else {
      setStep(s => s + 1)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div style={{
        background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)',
        width: '100%', maxWidth: 540, boxShadow: 'var(--shadow-lg)',
      }}>
        {/* Header */}
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{title}</div>
            <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 2 }}>Paso {step + 1} de {steps.length} · {current.label}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>

        {/* Stepper */}
        <div style={{ display: 'flex', padding: '14px 22px 0', gap: 6 }}>
          {steps.map((s, i) => (
            <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= step ? 'var(--cyan)' : 'var(--surface-3)', transition: 'background 0.2s' }} />
          ))}
        </div>

        {/* Contenido */}
        <div style={{ padding: '20px 22px' }}>
          {err && <div style={{ marginBottom: 14 }}><Alert type="error">{err}</Alert></div>}
          <current.Component data={data} onNext={next} onBack={step > 0 ? () => { setErr(''); setStep(s => s - 1) } : null} busy={busy} isLast={isLast} />
        </div>
      </div>
    </div>
  )
}

// ─── Wizard: Nuevo Tenant ────────────────────────────────────────

function TenantStep1({ data, onNext }) {
  const [form, setForm] = useState({ code: data.code || '', name: data.name || '', type: data.type || 'client' })
  const s = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }))
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ fontSize: 13, color: 'var(--text-2)' }}>Define el tipo y datos básicos del tenant.</div>
      <Field label="Tipo *">
        <select style={inp} value={form.type} onChange={s('type')}>
          <option value="partner">Partner (ej. Conestra) — ve activos de sus clientes</option>
          <option value="client">Cliente final (ej. G-One) — ve solo sus activos</option>
        </select>
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Field label="Código *"><input style={inp} value={form.code} onChange={s('code')} placeholder="CONESTRA" /></Field>
        <Field label="Nombre *"><input style={inp} value={form.name} onChange={s('name')} placeholder="Conestra S.A." /></Field>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
        <button style={btn('primary')} onClick={() => { if (!form.code || !form.name) return; onNext(form) }}>Siguiente →</button>
      </div>
    </div>
  )
}

function TenantStep2({ data, onNext, onBack, tenants }) {
  const [parentId, setParentId] = useState(data.parent_tenant_id || '')
  const partners = (tenants || []).filter(t => t.type === 'partner' || t.type === 'platform')
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ fontSize: 13, color: 'var(--text-2)' }}>
        {data.type === 'client' ? 'Asigna el partner responsable de este cliente.' : 'Los partners no requieren padre. Confirma para continuar.'}
      </div>
      {data.type === 'client' && (
        <Field label="Partner padre *">
          <select style={inp} value={parentId} onChange={e => setParentId(e.target.value)}>
            <option value="">Selecciona un partner</option>
            {partners.map(t => <option key={t.id} value={t.id}>{t.name} ({t.type})</option>)}
          </select>
        </Field>
      )}
      <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--r-md)', padding: '12px 14px' }}>
        <div style={{ fontSize: 11, color: 'var(--text-4)', marginBottom: 6 }}>Resumen</div>
        <div style={{ fontSize: 13, color: 'var(--text)', display: 'grid', gap: 4 }}>
          <span>Tipo: <strong>{data.type}</strong></span>
          <span>Código: <strong>{data.code}</strong></span>
          <span>Nombre: <strong>{data.name}</strong></span>
          {data.type === 'client' && parentId && <span>Partner: <strong>{partners.find(t => t.id === parentId)?.name || '—'}</strong></span>}
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 4 }}>
        <button style={btn('ghost')} onClick={onBack}>← Atrás</button>
        <button style={btn('primary')} onClick={() => {
          if (data.type === 'client' && !parentId) return
          onNext({ parent_tenant_id: parentId || null })
        }}>Crear tenant ✓</button>
      </div>
    </div>
  )
}

// ─── Wizard: Nuevo Usuario ────────────────────────────────────────

function UserStep1({ data, onNext }) {
  const [form, setForm] = useState({
    username: data.username || '', email: data.email || '',
    firstName: data.firstName || '', lastName: data.lastName || '', password: data.password || '',
  })
  const s = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }))
  const valid = form.username && form.email && form.password.length >= 8
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ fontSize: 13, color: 'var(--text-2)' }}>Datos de la cuenta en Keycloak.</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Field label="Nombre"><input style={inp} value={form.firstName} onChange={s('firstName')} placeholder="Kurt" /></Field>
        <Field label="Apellidos"><input style={inp} value={form.lastName} onChange={s('lastName')} placeholder="Alcantar" /></Field>
      </div>
      <Field label="Username *"><input style={inp} value={form.username} onChange={s('username')} placeholder="k.alcantar" /></Field>
      <Field label="Email *"><input style={inp} type="email" value={form.email} onChange={s('email')} placeholder="k@empresa.com" /></Field>
      <Field label="Contraseña inicial * (mín. 8 caracteres)"><input style={inp} type="password" value={form.password} onChange={s('password')} /></Field>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
        <button style={{ ...btn('primary'), opacity: valid ? 1 : 0.5 }} onClick={() => { if (valid) onNext(form) }}>Siguiente →</button>
      </div>
    </div>
  )
}

function UserStep2({ data, onNext, onBack, tenants, roles }) {
  const [tenantId, setTenantId] = useState(data.tenant_id || '')
  const [roleIds, setRoleIds] = useState(data.role_ids || [])
  const toggleRole = (id) => setRoleIds(prev => prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id])
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ fontSize: 13, color: 'var(--text-2)' }}>Asigna el tenant y los permisos del usuario.</div>
      <Field label="Tenant *">
        <select style={inp} value={tenantId} onChange={e => setTenantId(e.target.value)}>
          <option value="">Selecciona un tenant</option>
          {(tenants || []).map(t => (
            <option key={t.id} value={t.id}>{t.name} ({t.type || 'client'})</option>
          ))}
        </select>
      </Field>
      <div>
        <label style={lbl}>Roles *</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {(roles || []).map(role => (
            <label key={role.id} style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px',
              border: `1px solid ${roleIds.includes(role.id) ? 'var(--cyan)' : 'var(--border)'}`,
              borderRadius: 'var(--r-sm)', cursor: 'pointer', fontSize: 12,
              background: roleIds.includes(role.id) ? 'var(--cyan-dim)' : 'var(--surface-2)',
              color: roleIds.includes(role.id) ? 'var(--cyan)' : 'var(--text-2)',
            }}>
              <input type="checkbox" checked={roleIds.includes(role.id)} onChange={() => toggleRole(role.id)} style={{ display: 'none' }} />
              {role.code}
            </label>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 4 }}>
        <button style={btn('ghost')} onClick={onBack}>← Atrás</button>
        <button style={btn('primary')} onClick={() => {
          if (!tenantId || !roleIds.length) return
          onNext({ tenant_id: tenantId, role_ids: roleIds })
        }}>Siguiente →</button>
      </div>
    </div>
  )
}

function UserStep3({ data, onNext, onBack, tenants, roles, busy }) {
  const tenant = (tenants || []).find(t => t.id === data.tenant_id)
  const userRoles = (roles || []).filter(r => (data.role_ids || []).includes(r.id))
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ fontSize: 13, color: 'var(--text-2)' }}>Confirma los datos antes de crear el usuario en Keycloak.</div>
      <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--r-md)', padding: '14px 16px', display: 'grid', gap: 8 }}>
        {[
          ['Nombre',   [data.firstName, data.lastName].filter(Boolean).join(' ') || '—'],
          ['Username', data.username],
          ['Email',    data.email],
          ['Tenant',   tenant ? `${tenant.name} (${tenant.type})` : '—'],
          ['Roles',    userRoles.map(r => r.code).join(', ') || '—'],
        ].map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span style={{ color: 'var(--text-4)' }}>{k}</span>
            <span style={{ color: 'var(--text)', fontWeight: 600 }}>{v}</span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 4 }}>
        <button style={btn('ghost')} onClick={onBack} disabled={busy}>← Atrás</button>
        <button style={btn('primary')} onClick={() => onNext({})} disabled={busy}>
          {busy ? 'Creando...' : 'Crear usuario ✓'}
        </button>
      </div>
    </div>
  )
}

// ─── Página principal Admin ───────────────────────────────────────

export default function AdminPage() {
  const router = useRouter()
  const [data, setData] = useState({ tenants: [], roles: [], users: [], assets: [] })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState({ type: '', text: '' })
  const [wizard, setWizard] = useState(null) // 'tenant' | 'user' | null
  const [activeTab, setActiveTab] = useState('tenants') // tenants | users | assets | vms

  const showMsg = (type, text) => { setMsg({ type, text }); setTimeout(() => setMsg({ type: '', text: '' }), 4000) }

  const load = async () => {
    setLoading(true)
    try {
      const [bootstrap, assets] = await Promise.all([
        apiJson('/api/admin/bootstrap'),
        apiJson('/api/admin/assets').catch(() => []),
      ])
      setData({
        tenants: bootstrap?.tenants || [],
        roles:   bootstrap?.roles   || [],
        users:   bootstrap?.users   || [],
        vms:     bootstrap?.vms     || [],
        assets:  Array.isArray(assets) ? assets : [],
      })
    } catch (err) {
      showMsg('error', err.message || 'Error cargando datos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const request = async (url, options = {}) => {
    const res = await apiJson(url, options)
    return res
  }

  // Wizard tenant
  const handleCreateTenant = async (formData) => {
    await request('/api/admin/tenants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: formData.code, name: formData.name, type: formData.type, parent_tenant_id: formData.parent_tenant_id || null, status: 'ACTIVE' }),
    })
    await load()
    showMsg('ok', `Tenant "${formData.name}" creado correctamente.`)
  }

  // Wizard usuario
  const handleCreateUser = async (formData) => {
    await request('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: formData.username, email: formData.email,
        firstName: formData.firstName, lastName: formData.lastName,
        password: formData.password, tenant_id: formData.tenant_id,
        role_ids: formData.role_ids,
      }),
    })
    await load()
    showMsg('ok', `Usuario "${formData.email}" creado correctamente.`)
  }

  const deleteTenant = async (tenant) => {
    if (!window.confirm(`¿Eliminar tenant "${tenant.name}"?`)) return
    setBusy(true)
    try {
      await request(`/api/admin/tenants/${tenant.id}`, { method: 'DELETE' })
      await load()
      showMsg('ok', 'Tenant eliminado.')
    } catch (err) { showMsg('error', err.message) } finally { setBusy(false) }
  }

  const deleteUser = async (user) => {
    if (!window.confirm(`¿Eliminar usuario "${user.email}"? Se borrará también de Keycloak.`)) return
    setBusy(true)
    try {
      await request(`/api/admin/users/${user.id}`, { method: 'DELETE' })
      await load()
      showMsg('ok', 'Usuario eliminado.')
    } catch (err) { showMsg('error', err.message) } finally { setBusy(false) }
  }

  const assignAsset = async (assetId, tenantId) => {
    try {
      if (tenantId) {
        await request(`/api/admin/assets/${assetId}/assign`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tenantId }),
        })
      } else {
        await request(`/api/admin/assets/${assetId}/assign`, { method: 'DELETE' })
      }
      const updated = await request('/api/admin/assets').catch(() => [])
      setData(prev => ({ ...prev, assets: Array.isArray(updated) ? updated : prev.assets }))
    } catch (err) { showMsg('error', err.message) }
  }

  const syncAll = async () => {
    setBusy(true)
    try {
      await request('/api/admin/sync-all', { method: 'POST' })
      await load()
      showMsg('ok', 'Sincronización completada.')
    } catch (err) { showMsg('error', err.message) } finally { setBusy(false) }
  }

  const typeBadge = (type) => {
    const cfg = { platform: ['var(--cyan)', 'var(--cyan-dim)'], partner: ['#93c5fd','rgba(147,197,253,0.15)'], client: ['var(--green)','var(--green-dim)'] }
    const [color, bg] = cfg[type] || ['var(--text-4)', 'var(--surface-3)']
    return <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 'var(--r-xs)', color, background: bg, letterSpacing: '0.04em' }}>{type}</span>
  }

  const clientTenants = useMemo(() => data.tenants.filter(t => t.type === 'client'), [data.tenants])

  return (
    <AppShell
      title="Tenants & access"
      subtitle="Gestión de tenants, usuarios y asignación de activos"
      actions={
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={btn('ghost')} onClick={syncAll} disabled={busy || loading}>{busy ? 'Procesando...' : 'Sync Proxmox'}</button>
          <button style={btn('ghost')} onClick={load} disabled={loading}>Recargar</button>
          <button style={btn('primary')} onClick={() => setWizard('user')}>+ Usuario</button>
          <button style={btn('primary')} onClick={() => setWizard('tenant')} style={{ ...btn('primary'), background: 'var(--surface-3)', color: 'var(--text)', border: '1px solid var(--border)' }}>+ Tenant</button>
        </div>
      }
    >
      {/* Wizards */}
      {wizard === 'tenant' && (
        <Wizard
          title="Nuevo tenant"
          onClose={() => setWizard(null)}
          onFinish={handleCreateTenant}
          steps={[
            { label: 'Tipo y datos', Component: (p) => <TenantStep1 {...p} /> },
            { label: 'Confirmación', Component: (p) => <TenantStep2 {...p} tenants={data.tenants} /> },
          ]}
        />
      )}
      {wizard === 'user' && (
        <Wizard
          title="Nuevo usuario"
          onClose={() => setWizard(null)}
          onFinish={handleCreateUser}
          steps={[
            { label: 'Datos de cuenta',  Component: (p) => <UserStep1 {...p} /> },
            { label: 'Tenant y roles',   Component: (p) => <UserStep2 {...p} tenants={data.tenants} roles={data.roles} /> },
            { label: 'Confirmación',     Component: (p) => <UserStep3 {...p} tenants={data.tenants} roles={data.roles} /> },
          ]}
        />
      )}

      {msg.text && <div style={{ marginBottom: 14 }}><Alert type={msg.type === 'ok' ? 'ok' : 'error'}>{msg.text}</Alert></div>}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, background: 'var(--surface-2)', borderRadius: 'var(--r-md)', padding: 3, width: 'fit-content', marginBottom: 20 }}>
        {[['tenants','Tenants'],['users','Usuarios'],['assets','Activos'],['vms','VMs']].map(([key, label]) => (
          <button key={key} onClick={() => setActiveTab(key)} style={{
            padding: '5px 14px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
            borderRadius: 'var(--r-sm)', background: activeTab === key ? 'var(--surface-3)' : 'transparent',
            color: activeTab === key ? 'var(--text)' : 'var(--text-3)',
          }}>
            {label}
            {key === 'tenants' && <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.7 }}>{data.tenants.length}</span>}
            {key === 'users'   && <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.7 }}>{data.users.length}</span>}
            {key === 'assets'  && <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.7 }}>{data.assets.length}</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card cardPad"><p className="muted">Cargando...</p></div>
      ) : (
        <>
          {/* ── Tab Tenants ── */}
          {activeTab === 'tenants' && (
            <div className="card">
              <div className="overview-card-head compact">
                <h3>Jerarquía de tenants</h3>
                <span className="ch-meta">{data.tenants.length} tenants</span>
              </div>
              <div className="table-wrapp">
                <table className="table" style={{ fontSize: 13 }}>
                  <thead><tr><th>Código</th><th>Nombre</th><th>Tipo</th><th>Parent</th><th>Estado</th><th>Acciones</th></tr></thead>
                  <tbody>
                    {data.tenants.map(t => {
                      const parent = data.tenants.find(p => p.id === t.parent_tenant_id)
                      return (
                        <tr key={t.id}>
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)' }}>{t.code}</td>
                          <td style={{ fontWeight: 600, color: 'var(--text)' }}>{t.name}</td>
                          <td>{typeBadge(t.type)}</td>
                          <td style={{ color: 'var(--text-3)', fontSize: 12 }}>{parent?.name || '—'}</td>
                          <td><span style={{ fontSize: 11, color: t.status === 'ACTIVE' ? 'var(--green)' : 'var(--red)' }}>{t.status}</span></td>
                          <td>
                            {t.type !== 'platform' && (
                              <button style={{ ...btn('danger'), padding: '4px 10px', fontSize: 11 }} onClick={() => deleteTenant(t)} disabled={busy}>Eliminar</button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                    {!data.tenants.length && <tr><td colSpan={6} className="muted" style={{ textAlign: 'center', padding: 20 }}>Sin tenants</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Tab Usuarios ── */}
          {activeTab === 'users' && (
            <div className="card">
              <div className="overview-card-head compact">
                <h3>Usuarios del panel</h3>
                <span className="ch-meta">{data.users.length} usuarios</span>
              </div>
              <div className="table-wrapp">
                <table className="table" style={{ fontSize: 13 }}>
                  <thead><tr><th>Email</th><th>Tenant</th><th>Tipo</th><th>Roles</th><th>Acciones</th></tr></thead>
                  <tbody>
                    {data.users.map(user => (
                      <tr key={user.id}>
                        <td>
                          <div style={{ fontWeight: 600, color: 'var(--text)' }}>{user.email}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-4)', fontFamily: 'var(--font-mono)' }}>{user.id?.slice(0, 16)}...</div>
                        </td>
                        <td style={{ color: 'var(--text-2)' }}>{user.tenant_name || user.tenant?.name || '—'}</td>
                        <td>{user.tenant_type ? typeBadge(user.tenant_type) : <span style={{ color: 'var(--text-4)', fontSize: 11 }}>—</span>}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {(user.roles || []).map(r => (
                              <span key={r.id || r} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 'var(--r-xs)', background: 'var(--cyan-dim)', color: 'var(--cyan)', fontWeight: 700 }}>{r.code || r}</span>
                            ))}
                          </div>
                        </td>
                        <td>
                          <button style={{ ...btn('danger'), padding: '4px 10px', fontSize: 11 }} onClick={() => deleteUser(user)} disabled={busy}>Eliminar</button>
                        </td>
                      </tr>
                    ))}
                    {!data.users.length && <tr><td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 20 }}>Sin usuarios</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Tab Activos ── */}
          {activeTab === 'assets' && (
            <div className="card">
              <div className="overview-card-head compact">
                <h3>Asignación de activos a clientes</h3>
                <span className="ch-meta">{data.assets.length} activos</span>
              </div>
              <div className="table-wrapp">
                <table className="table" style={{ fontSize: 13 }}>
                  <thead><tr><th>Activo</th><th>OS</th><th>Estado</th><th>Cliente asignado</th></tr></thead>
                  <tbody>
                    {data.assets.map(asset => {
                      const assignment = asset.tenant_assignments?.[0]
                      return (
                        <tr key={asset.id}>
                          <td>
                            <div style={{ fontWeight: 600, color: 'var(--text)' }}>{asset.display_name || asset.host_name}</div>
                            <div style={{ fontSize: 10, color: 'var(--text-4)', fontFamily: 'var(--font-mono)' }}>{asset.agent_version}</div>
                          </td>
                          <td style={{ color: 'var(--text-3)' }}>{asset.os_type || '—'}</td>
                          <td>
                            <span style={{ fontSize: 11, fontWeight: 700, color: asset.agent_status === 'online' ? 'var(--green)' : 'var(--red)' }}>
                              {asset.agent_status || '—'}
                            </span>
                          </td>
                          <td>
                            <select
                              style={{ ...inp, width: 200, fontSize: 12 }}
                              value={assignment?.tenant_id || ''}
                              onChange={e => assignAsset(asset.id, e.target.value)}
                            >
                              <option value="">Sin asignar</option>
                              {clientTenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                          </td>
                        </tr>
                      )
                    })}
                    {!data.assets.length && <tr><td colSpan={4} className="muted" style={{ textAlign: 'center', padding: 20 }}>Sin activos</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Tab VMs ── */}
          {activeTab === 'vms' && (
            <div className="card">
              <div className="overview-card-head compact">
                <h3>Inventario VM</h3>
                <span className="ch-meta">{(data.vms || []).length} VMs</span>
              </div>
              <div className="table-wrapp">
                <table className="table" style={{ fontSize: 13 }}>
                  <thead><tr><th>VM</th><th>VMID</th><th>Nodo</th><th>Pool/Grupo</th><th>Estado</th><th>OS</th></tr></thead>
                  <tbody>
                    {(data.vms || []).map(vm => (
                      <tr key={vm.vmid} style={{ cursor: 'pointer' }} onClick={() => router.push(`/vms/${vm.vmid}`)}>
                        <td style={{ fontWeight: 600, color: 'var(--text)' }}>{vm.name || `VM ${vm.vmid}`}</td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-4)' }}>{vm.vmid}</td>
                        <td style={{ color: 'var(--text-3)' }}>{vm.node || '—'}</td>
                        <td style={{ color: 'var(--text-3)' }}>{vm.pool_id || '—'}</td>
                        <td><span style={{ fontSize: 11, fontWeight: 700, color: vm.status === 'running' ? 'var(--green)' : 'var(--red)' }}>{vm.status || '—'}</span></td>
                        <td style={{ color: 'var(--text-3)' }}>{vm.os_type || '—'}</td>
                      </tr>
                    ))}
                    {!(data.vms || []).length && <tr><td colSpan={6} className="muted" style={{ textAlign: 'center', padding: 20 }}>Sin VMs</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </AppShell>
  )
}
