import { useEffect, useState } from 'react'
import AppShell from '../components/AppShell'
import { applySettings, DEFAULT_SETTINGS, loadSettings, saveSettings } from '../lib/panel'
import { apiJson } from '../lib/auth'

const accents = ['cyan', 'teal', 'green', 'violet', 'coral']

const inp = {
  width: '100%', background: 'var(--surface-2)', border: '1px solid var(--border)',
  borderRadius: 'var(--r-sm)', padding: '8px 10px', fontSize: 13, color: 'var(--text)', outline: 'none', boxSizing: 'border-box',
}

export default function SettingsPage() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [tab, setTab] = useState('appearance')

  // Cuenta
  const [profile, setProfile] = useState({ firstName: '', lastName: '', username: '' })
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState({ type: '', text: '' })

  useEffect(() => {
    const current = loadSettings()
    setSettings(current)
    applySettings(current)
    // Cargar perfil actual
    apiJson('/api/me').then(data => {
      setProfile({
        firstName: data.displayName?.split(' ')[0] || '',
        lastName:  data.displayName?.split(' ').slice(1).join(' ') || '',
        username:  data.email || '',
      })
    }).catch(() => {})
  }, [])

  const update = (patch) => {
    const next = { ...settings, ...patch }
    setSettings(next)
    saveSettings(next)
    applySettings(next)
  }

  const saveProfile = async (e) => {
    e.preventDefault()
    setSaving(true)
    setMsg({ type: '', text: '' })
    try {
      await apiJson('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName: profile.firstName, lastName: profile.lastName }),
      })
      setMsg({ type: 'ok', text: 'Perfil actualizado correctamente.' })
    } catch (err) {
      setMsg({ type: 'err', text: err.message || 'Error al actualizar perfil' })
    } finally {
      setSaving(false)
    }
  }

  const savePassword = async (e) => {
    e.preventDefault()
    if (pwForm.next !== pwForm.confirm) { setMsg({ type: 'err', text: 'Las contraseñas no coinciden.' }); return }
    if (pwForm.next.length < 8) { setMsg({ type: 'err', text: 'Mínimo 8 caracteres.' }); return }
    setSaving(true)
    setMsg({ type: '', text: '' })
    try {
      await apiJson('/api/me/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: pwForm.current, newPassword: pwForm.next }),
      })
      setPwForm({ current: '', next: '', confirm: '' })
      setMsg({ type: 'ok', text: 'Contraseña actualizada correctamente.' })
    } catch (err) {
      setMsg({ type: 'err', text: err.message || 'Error al cambiar contraseña' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppShell title="Settings" subtitle="Preferencias de cuenta y apariencia del panel.">
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, background: 'var(--surface-2)', borderRadius: 'var(--r-md)', padding: 3, width: 'fit-content', marginBottom: 20 }}>
        {[['appearance','Apariencia'],['account','Cuenta']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            padding: '6px 18px', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
            borderRadius: 'var(--r-sm)', background: tab === key ? 'var(--surface-3)' : 'transparent',
            color: tab === key ? 'var(--text)' : 'var(--text-3)',
          }}>{label}</button>
        ))}
      </div>

      {msg.text && (
        <div style={{
          padding: '10px 14px', borderRadius: 'var(--r-md)', marginBottom: 16, fontSize: 13,
          background: msg.type === 'ok' ? 'var(--green-dim)' : 'var(--red-dim)',
          color: msg.type === 'ok' ? 'var(--green)' : 'var(--red)',
          border: `1px solid ${msg.type === 'ok' ? 'var(--green)' : 'var(--red)'}`,
        }}>{msg.text}</div>
      )}

      {tab === 'appearance' && (
        <div className="card" style={{ padding: '20px 22px', maxWidth: 480 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 20 }}>Apariencia</div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: 'var(--text-4)', marginBottom: 8 }}>Color de acento</div>
            <div style={{ display: 'flex', gap: 10 }}>
              {accents.map(accent => (
                <button key={accent} className={`swatch ${accent} ${settings.accent === accent ? 'active' : ''}`} onClick={() => update({ accent })} />
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: 'var(--text-4)', marginBottom: 8 }}>Radio de bordes ({settings.radius}px)</div>
            <input type="range" min="12" max="26" value={settings.radius} onChange={(e) => update({ radius: Number(e.target.value) })} style={{ width: '100%' }} />
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--text-2)', cursor: 'pointer' }}>
            <input type="checkbox" checked={settings.dense} onChange={(e) => update({ dense: e.target.checked })} />
            Layout denso (más contenido visible)
          </label>

          <div style={{ marginTop: 16, fontSize: 11, color: 'var(--text-4)', fontFamily: 'var(--font-mono)' }}>
            hyperox · dark · {settings.accent} · r{settings.radius}
          </div>
        </div>
      )}

      {tab === 'account' && (
        <div style={{ display: 'grid', gap: 16, maxWidth: 480 }}>
          {/* Perfil */}
          <div className="card" style={{ padding: '20px 22px' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>Información de perfil</div>
            <form onSubmit={saveProfile} style={{ display: 'grid', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-4)', display: 'block', marginBottom: 4 }}>Nombre</label>
                  <input style={inp} value={profile.firstName} onChange={e => setProfile(p => ({ ...p, firstName: e.target.value }))} placeholder="Nombre" />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-4)', display: 'block', marginBottom: 4 }}>Apellidos</label>
                  <input style={inp} value={profile.lastName} onChange={e => setProfile(p => ({ ...p, lastName: e.target.value }))} placeholder="Apellidos" />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-4)', display: 'block', marginBottom: 4 }}>Email / Usuario</label>
                <input style={{ ...inp, color: 'var(--text-3)' }} value={profile.username} disabled />
                <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 4 }}>El email se gestiona desde Keycloak</div>
              </div>
              <button type="submit" disabled={saving} style={{
                padding: '8px 18px', background: 'var(--cyan)', border: 'none', borderRadius: 'var(--r-sm)',
                color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', width: 'fit-content',
              }}>
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </form>
          </div>

          {/* Contraseña */}
          <div className="card" style={{ padding: '20px 22px' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>Cambiar contraseña</div>
            <form onSubmit={savePassword} style={{ display: 'grid', gap: 12 }}>
              {[
                { key: 'current', label: 'Contraseña actual', val: pwForm.current },
                { key: 'next',    label: 'Nueva contraseña', val: pwForm.next },
                { key: 'confirm', label: 'Confirmar nueva contraseña', val: pwForm.confirm },
              ].map(({ key, label, val }) => (
                <div key={key}>
                  <label style={{ fontSize: 12, color: 'var(--text-4)', display: 'block', marginBottom: 4 }}>{label}</label>
                  <input style={inp} type="password" value={val} onChange={e => setPwForm(p => ({ ...p, [key]: e.target.value }))} required />
                </div>
              ))}
              <button type="submit" disabled={saving} style={{
                padding: '8px 18px', background: 'var(--surface-3)', border: '1px solid var(--border)',
                borderRadius: 'var(--r-sm)', color: 'var(--text)', fontWeight: 700, fontSize: 13, cursor: 'pointer', width: 'fit-content',
              }}>
                {saving ? 'Actualizando...' : 'Actualizar contraseña'}
              </button>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  )
}
