import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import AppShell from '../components/AppShell'
import { apiJson } from '../lib/auth'

// ─── Wizard ──────────────────────────────────────────────────────

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
      try { await onFinish(merged); onClose() }
      catch (e) { setErr(e.message || 'Error al guardar') }
      finally { setBusy(false) }
    } else {
      setStep(s => s + 1)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="card" style={{ width: '100%', maxWidth: 520 }}>
        <div className="card-head">
          <div>
            <h3 style={{ fontSize: 15 }}>{title}</h3>
            <div className="ch-meta">Paso {step + 1} de {steps.length} · {current.label}</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div style={{ display: 'flex', gap: 4, padding: '10px 18px 0' }}>
          {steps.map((s, i) => (
            <div key={i} style={{ flex: 1, height: 2, borderRadius: 2, background: i <= step ? 'var(--cyan)' : 'var(--border)', transition: 'background 0.2s' }} />
          ))}
        </div>
        <div className="cardPad">
          {err && <div className="errorBox" style={{ marginBottom: 14 }}>{err}</div>}
          <current.Component data={data} onNext={next} onBack={step > 0 ? () => { setErr(''); setStep(s => s - 1) } : null} busy={busy} isLast={isLast} />
        </div>
      </div>
    </div>
  )
}

// ─── Pasos wizard Tenant ─────────────────────────────────────────

function TenantStep1({ data, onNext }) {
  const [form, setForm] = useState({ code: data.code || '', name: data.name || '', type: data.type || 'client' })
  const s = k => e => setForm(p => ({ ...p, [k]: e.target.value }))
  return (
    <div className="adminFormGrid">
      <label className="authField" style={{ gridColumn: '1 / -1' }}>
        <span>Tipo *</span>
        <select className="authInput" value={form.type} onChange={s('type')}>
          <option value="partner">Partner — ve activos de sus clientes</option>
          <option value="client">Cliente final — ve solo sus activos</option>
        </select>
      </label>
      <label className="authField"><span>Código *</span><input className="authInput" value={form.code} onChange={s('code')} placeholder="CONESTRA" /></label>
      <label className="authField"><span>Nombre *</span><input className="authInput" value={form.name} onChange={s('name')} placeholder="Conestra S.A." /></label>
      <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn-primary" onClick={() => { if (form.code && form.name) onNext(form) }}>Siguiente →</button>
      </div>
    </div>
  )
}

function TenantStep2({ data, onNext, onBack, tenants }) {
  const [parentId, setParentId] = useState(data.parent_tenant_id || '')
  const partners = (tenants || []).filter(t => t.type === 'partner' || t.type === 'platform')
  return (
    <div className="adminFormGrid" style={{ gridTemplateColumns: '1fr' }}>
      {data.type === 'client' && (
        <label className="authField">
          <span>Partner padre *</span>
          <select className="authInput" value={parentId} onChange={e => setParentId(e.target.value)}>
            <option value="">Selecciona un partner</option>
            {partners.map(t => <option key={t.id} value={t.id}>{t.name} ({t.type})</option>)}
          </select>
        </label>
      )}
      <div className="card cardPad" style={{ background: 'var(--surface-2)' }}>
        <div className="statLabel">Resumen</div>
        {[['Tipo', data.type], ['Código', data.code], ['Nombre', data.name], ...(data.type === 'client' && parentId ? [['Partner', partners.find(t => t.id === parentId)?.name || '—']] : [])].map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 6 }}>
            <span style={{ color: 'var(--text-3)' }}>{k}</span><strong>{v}</strong>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <button className="btn btn-ghost" onClick={onBack}>← Atrás</button>
        <button className="btn btn-primary" onClick={() => { if (data.type !== 'client' || parentId) onNext({ parent_tenant_id: parentId || null }) }}>Crear tenant ✓</button>
      </div>
    </div>
  )
}

// ─── Pasos wizard Usuario ────────────────────────────────────────

function UserStep1({ data, onNext }) {
  const [form, setForm] = useState({ username: data.username || '', email: data.email || '', firstName: data.firstName || '', lastName: data.lastName || '', password: data.password || '' })
  const s = k => e => setForm(p => ({ ...p, [k]: e.target.value }))
  const valid = form.username && form.email && form.password.length >= 8
  return (
    <div className="adminFormGrid">
      <label className="authField"><span>Nombre</span><input className="authInput" value={form.firstName} onChange={s('firstName')} placeholder="Kurt" /></label>
      <label className="authField"><span>Apellidos</span><input className="authInput" value={form.lastName} onChange={s('lastName')} placeholder="Alcantar" /></label>
      <label className="authField"><span>Username *</span><input className="authInput" value={form.username} onChange={s('username')} placeholder="k.alcantar" /></label>
      <label className="authField"><span>Email *</span><input className="authInput" type="email" value={form.email} onChange={s('email')} placeholder="k@empresa.com" /></label>
      <label className="authField" style={{ gridColumn: '1 / -1' }}><span>Contraseña inicial * (mín. 8)</span><input className="authInput" type="password" value={form.password} onChange={s('password')} /></label>
      <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn-primary" disabled={!valid} onClick={() => { if (valid) onNext(form) }}>Siguiente →</button>
      </div>
    </div>
  )
}

function UserStep2({ data, onNext, onBack, tenants, roles }) {
  const [tenantId, setTenantId] = useState(data.tenant_id || '')
  const [roleIds, setRoleIds] = useState(data.role_ids || [])
  const toggleRole = id => setRoleIds(prev => prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id])
  return (
    <div className="adminFormGrid" style={{ gridTemplateColumns: '1fr' }}>
      <label className="authField">
        <span>Tenant *</span>
        <select className="authInput" value={tenantId} onChange={e => setTenantId(e.target.value)}>
          <option value="">Selecciona un tenant</option>
          {(tenants || []).map(t => <option key={t.id} value={t.id}>{t.name} ({t.type || 'client'})</option>)}
        </select>
      </label>
      <div>
        <div className="statLabel">Roles *</div>
        <div className="poolFilterRow">
          {(roles || []).map(role => (
            <button key={role.id} className={`chip${roleIds.includes(role.id) ? ' active' : ''}`} onClick={() => toggleRole(role.id)}>{role.code}</button>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <button className="btn btn-ghost" onClick={onBack}>← Atrás</button>
        <button className="btn btn-primary" disabled={!tenantId || !roleIds.length} onClick={() => { if (tenantId && roleIds.length) onNext({ tenant_id: tenantId, role_ids: roleIds }) }}>Siguiente →</button>
      </div>
    </div>
  )
}

function UserStep3({ data, onNext, onBack, tenants, roles, busy }) {
  const tenant = (tenants || []).find(t => t.id === data.tenant_id)
  const userRoles = (roles || []).filter(r => (data.role_ids || []).includes(r.id))
  return (
    <div className="adminFormGrid" style={{ gridTemplateColumns: '1fr' }}>
      <div className="card cardPad" style={{ background: 'var(--surface-2)' }}>
        <div className="statLabel">Confirmación</div>
        {[['Nombre', [data.firstName, data.lastName].filter(Boolean).join(' ') || '—'], ['Username', data.username], ['Email', data.email], ['Tenant', tenant ? `${tenant.name} (${tenant.type})` : '—'], ['Roles', userRoles.map(r => r.code).join(', ') || '—']].map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 8 }}>
            <span style={{ color: 'var(--text-3)' }}>{k}</span><strong>{v}</strong>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <button className="btn btn-ghost" onClick={onBack} disabled={busy}>← Atrás</button>
        <button className="btn btn-primary" onClick={() => onNext({})} disabled={busy}>{busy ? 'Creando...' : 'Crear usuario ✓'}</button>
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────

export default function AdminPage() {
  const router = useRouter()
  const [data, setData] = useState({ tenants: [], roles: [], users: [], vms: [], assets: [] })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState({ type: '', text: '' })
  const [wizard, setWizard] = useState(null)
  const [activeTab, setActiveTab] = useState('tenants')

  const flash = (type, text) => { setMsg({ type, text }); setTimeout(() => setMsg({ type: '', text: '' }), 4000) }

  const load = async () => {
    setLoading(true)
    try {
      const [bootstrap, assets] = await Promise.all([
        apiJson('/api/admin/bootstrap'),
        apiJson('/api/admin/assets').catch(() => []),
      ])
      setData({ tenants: bootstrap?.tenants || [], roles: bootstrap?.roles || [], users: bootstrap?.users || [], vms: bootstrap?.vms || [], assets: Array.isArray(assets) ? assets : [] })
    } catch (err) { flash('err', err.message || 'Error cargando datos') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleCreateTenant = async (fd) => {
    await apiJson('/api/admin/tenants', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: fd.code, name: fd.name, type: fd.type, parent_tenant_id: fd.parent_tenant_id || null, status: 'ACTIVE' }) })
    await load(); flash('ok', `Tenant "${fd.name}" creado.`)
  }
  const handleCreateUser = async (fd) => {
    await apiJson('/api/admin/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: fd.username, email: fd.email, firstName: fd.firstName, lastName: fd.lastName, password: fd.password, tenant_id: fd.tenant_id, role_ids: fd.role_ids }) })
    await load(); flash('ok', `Usuario "${fd.email}" creado.`)
  }
  const deleteTenant = async (t) => {
    if (!window.confirm(`¿Eliminar tenant "${t.name}"?`)) return
    setBusy(true)
    try { await apiJson(`/api/admin/tenants/${t.id}`, { method: 'DELETE' }); await load(); flash('ok', 'Tenant eliminado.') }
    catch (err) { flash('err', err.message) } finally { setBusy(false) }
  }
  const deleteUser = async (u) => {
    if (!window.confirm(`¿Eliminar usuario "${u.email}"? Se borrará de Keycloak.`)) return
    setBusy(true)
    try { await apiJson(`/api/admin/users/${u.id}`, { method: 'DELETE' }); await load(); flash('ok', 'Usuario eliminado.') }
    catch (err) { flash('err', err.message) } finally { setBusy(false) }
  }
  const assignAsset = async (assetId, tenantId) => {
    try {
      if (tenantId) await apiJson(`/api/admin/assets/${assetId}/assign`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenantId }) })
      else await apiJson(`/api/admin/assets/${assetId}/assign`, { method: 'DELETE' })
      const updated = await apiJson('/api/admin/assets').catch(() => [])
      setData(prev => ({ ...prev, assets: Array.isArray(updated) ? updated : prev.assets }))
    } catch (err) { flash('err', err.message) }
  }
  const syncAll = async () => {
    setBusy(true)
    try { await apiJson('/api/admin/sync-all', { method: 'POST' }); await load(); flash('ok', 'Sincronización completada.') }
    catch (err) { flash('err', err.message) } finally { setBusy(false) }
  }

  const typeBadge = (type) => {
    const cfg = { platform: 'running', partner: 'paused', client: 'unknown' }
    return <span className={`vm-status ${cfg[type] || 'unknown'}`}>{type}</span>
  }

  const clientTenants = useMemo(() => data.tenants.filter(t => t.type === 'client'), [data.tenants])

  const tabs = [['tenants','Tenants',data.tenants.length],['users','Usuarios',data.users.length],['assets','Activos',data.assets.length],['vms','VMs',(data.vms||[]).length]]

  return (
    <AppShell
      title="Tenants & access"
      subtitle="Gestión de tenants, usuarios y asignación de activos"
      actions={
        <div className="overview-toolbar">
          <button className="btn btn-secondary" onClick={syncAll} disabled={busy || loading}>{busy ? 'Procesando...' : 'Sync Proxmox'}</button>
          <button className="btn btn-secondary" onClick={load} disabled={loading}>Recargar</button>
          <button className="btn btn-secondary" onClick={() => setWizard('tenant')}>+ Tenant</button>
          <button className="btn btn-primary" onClick={() => setWizard('user')}>+ Usuario</button>
        </div>
      }
    >
      {wizard === 'tenant' && (
        <Wizard title="Nuevo tenant" onClose={() => setWizard(null)} onFinish={handleCreateTenant}
          steps={[
            { label: 'Tipo y datos', Component: p => <TenantStep1 {...p} /> },
            { label: 'Confirmación', Component: p => <TenantStep2 {...p} tenants={data.tenants} /> },
          ]} />
      )}
      {wizard === 'user' && (
        <Wizard title="Nuevo usuario" onClose={() => setWizard(null)} onFinish={handleCreateUser}
          steps={[
            { label: 'Datos de cuenta', Component: p => <UserStep1 {...p} /> },
            { label: 'Tenant y roles',  Component: p => <UserStep2 {...p} tenants={data.tenants} roles={data.roles} /> },
            { label: 'Confirmación',    Component: p => <UserStep3 {...p} tenants={data.tenants} roles={data.roles} /> },
          ]} />
      )}

      {msg.text && <div className={msg.type === 'ok' ? 'card cardPad' : 'errorBox'} style={{ marginBottom: 14, ...(msg.type === 'ok' ? { color: 'var(--green)', borderColor: 'var(--green)', background: 'var(--green-dim)' } : {}) }}>{msg.text}</div>}

      <div className="poolFilterRow" style={{ marginBottom: 18 }}>
        {tabs.map(([key, label, count]) => (
          <button key={key} className={`chip${activeTab === key ? ' active' : ''}`} onClick={() => setActiveTab(key)}>
            {label} <span className="chip-count">{count}</span>
          </button>
        ))}
      </div>

      {loading ? <div className="card cardPad"><p className="muted">Cargando...</p></div> : (
        <>
          {activeTab === 'tenants' && (
            <div className="card">
              <div className="overview-card-head compact"><h3>Jerarquía de tenants</h3><span className="ch-meta">{data.tenants.length} tenants</span></div>
              <div className="table-wrapp">
                <table className="table">
                  <thead><tr><th>Código</th><th>Nombre</th><th>Tipo</th><th>Parent</th><th>Estado</th><th>Acciones</th></tr></thead>
                  <tbody>
                    {data.tenants.map(t => {
                      const parent = data.tenants.find(p => p.id === t.parent_tenant_id)
                      return (
                        <tr key={t.id}>
                          <td><span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{t.code}</span></td>
                          <td><strong>{t.name}</strong></td>
                          <td>{typeBadge(t.type)}</td>
                          <td>{parent?.name || '—'}</td>
                          <td><span style={{ fontSize: 11, color: t.status === 'ACTIVE' ? 'var(--green)' : 'var(--red)' }}>{t.status}</span></td>
                          <td>{t.type !== 'platform' && <button className="btn btn-danger btn-sm" onClick={() => deleteTenant(t)} disabled={busy}>Eliminar</button>}</td>
                        </tr>
                      )
                    })}
                    {!data.tenants.length && <tr><td colSpan={6} className="emptyState">Sin tenants</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="card">
              <div className="overview-card-head compact"><h3>Usuarios del panel</h3><span className="ch-meta">{data.users.length} usuarios</span></div>
              <div className="table-wrapp">
                <table className="table">
                  <thead><tr><th>Email</th><th>Tenant</th><th>Tipo</th><th>Roles</th><th>Acciones</th></tr></thead>
                  <tbody>
                    {data.users.map(user => (
                      <tr key={user.id}>
                        <td>
                          <strong>{user.email}</strong>
                          <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-4)' }}>{user.id?.slice(0, 16)}...</div>
                        </td>
                        <td>{user.tenant_name || user.tenant?.name || '—'}</td>
                        <td>{user.tenant_type ? typeBadge(user.tenant_type) : '—'}</td>
                        <td>
                          <div className="vmCardTags">
                            {(user.roles || []).map(r => <span key={r.id || r} className="vmTag">{r.code || r}</span>)}
                          </div>
                        </td>
                        <td><button className="btn btn-danger btn-sm" onClick={() => deleteUser(user)} disabled={busy}>Eliminar</button></td>
                      </tr>
                    ))}
                    {!data.users.length && <tr><td colSpan={5} className="emptyState">Sin usuarios</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'assets' && (
            <div className="card">
              <div className="overview-card-head compact"><h3>Asignación de activos a clientes</h3><span className="ch-meta">{data.assets.length} activos</span></div>
              <div className="table-wrapp">
                <table className="table">
                  <thead><tr><th>Activo</th><th>OS</th><th>Estado</th><th>Cliente asignado</th></tr></thead>
                  <tbody>
                    {data.assets.map(asset => {
                      const assignment = asset.tenant_assignments?.[0]
                      return (
                        <tr key={asset.id}>
                          <td><strong>{asset.display_name || asset.host_name}</strong><div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-4)' }}>{asset.agent_version}</div></td>
                          <td>{asset.os_type || '—'}</td>
                          <td><span className={`vm-status ${asset.agent_status === 'online' ? 'running' : 'stopped'}`}>{asset.agent_status || '—'}</span></td>
                          <td>
                            <select className="select" style={{ minWidth: 180 }} value={assignment?.tenant_id || ''} onChange={e => assignAsset(asset.id, e.target.value)}>
                              <option value="">Sin asignar</option>
                              {clientTenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                          </td>
                        </tr>
                      )
                    })}
                    {!data.assets.length && <tr><td colSpan={4} className="emptyState">Sin activos</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'vms' && (
            <div className="card">
              <div className="overview-card-head compact"><h3>Inventario VM</h3><span className="ch-meta">{(data.vms||[]).length} VMs</span></div>
              <div className="table-wrapp">
                <table className="table">
                  <thead><tr><th>VM</th><th>VMID</th><th>Nodo</th><th>Grupo</th><th>Estado</th></tr></thead>
                  <tbody>
                    {(data.vms||[]).map(vm => (
                      <tr key={vm.vmid} style={{ cursor: 'pointer' }} onClick={() => router.push(`/vms/${vm.vmid}`)}>
                        <td><strong>{vm.name || `VM ${vm.vmid}`}</strong></td>
                        <td><span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{vm.vmid}</span></td>
                        <td>{vm.node || '—'}</td>
                        <td>{vm.pool_id ? <span className="vmTag">{vm.pool_id}</span> : '—'}</td>
                        <td><span className={`vm-status ${vm.status === 'running' ? 'running' : 'stopped'}`}>{vm.status || '—'}</span></td>
                      </tr>
                    ))}
                    {!(data.vms||[]).length && <tr><td colSpan={5} className="emptyState">Sin VMs</td></tr>}
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
