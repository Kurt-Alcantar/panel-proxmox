import { useEffect, useState } from 'react'
import AppShell from '../components/AppShell'
import { applySettings, DEFAULT_SETTINGS, loadSettings, saveSettings } from '../lib/panel'
import { apiJson } from '../lib/auth'

const accents = ['cyan', 'teal', 'green', 'violet', 'coral']

export default function SettingsPage() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [tab, setTab] = useState('appearance')
  const [profile, setProfile] = useState({ firstName: '', lastName: '', username: '' })
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState({ type: '', text: '' })

  useEffect(() => {
    const current = loadSettings()
    setSettings(current)
    applySettings(current)
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
    setSettings(next); saveSettings(next); applySettings(next)
  }

  const flash = (type, text) => {
    setMsg({ type, text })
    setTimeout(() => setMsg({ type: '', text: '' }), 4000)
  }

  const saveProfile = async (e) => {
    e.preventDefault(); setSaving(true)
    try {
      await apiJson('/api/me', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName: profile.firstName, lastName: profile.lastName }),
      })
      flash('ok', 'Perfil actualizado correctamente.')
    } catch (err) { flash('err', err.message || 'Error al actualizar perfil') }
    finally { setSaving(false) }
  }

  const savePassword = async (e) => {
    e.preventDefault()
    if (pwForm.next !== pwForm.confirm) { flash('err', 'Las contraseñas no coinciden.'); return }
    if (pwForm.next.length < 8) { flash('err', 'Mínimo 8 caracteres.'); return }
    setSaving(true)
    try {
      await apiJson('/api/me/password', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: pwForm.current, newPassword: pwForm.next }),
      })
      setPwForm({ current: '', next: '', confirm: '' })
      flash('ok', 'Contraseña actualizada correctamente.')
    } catch (err) { flash('err', err.message || 'Error al cambiar contraseña') }
    finally { setSaving(false) }
  }

  return (
    <AppShell title="Settings" subtitle="Preferencias de cuenta y apariencia del panel.">
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[['appearance','Apariencia'],['account','Cuenta']].map(([key, label]) => (
          <button key={key} className={`chip${tab === key ? ' active' : ''}`} onClick={() => setTab(key)}>{label}</button>
        ))}
      </div>

      {msg.text && (
        <div className={msg.type === 'ok' ? 'card cardPad' : 'errorBox'} style={{
          marginBottom: 16,
          ...(msg.type === 'ok' ? { color: 'var(--green)', borderColor: 'var(--green)', background: 'var(--green-dim)' } : {}),
        }}>
          {msg.text}
        </div>
      )}

      {tab === 'appearance' && (
        <div className="card cardPad" style={{ maxWidth: 440 }}>
          <div className="sectionTitle" style={{ fontSize: 15, marginBottom: 20 }}>Apariencia</div>

          <div style={{ marginBottom: 20 }}>
            <div className="overview-tweaks-label">Color de acento</div>
            <div className="overview-swatch-row">
              {accents.map(accent => (
                <button key={accent} className={`swatch ${accent} ${settings.accent === accent ? 'active' : ''}`} onClick={() => update({ accent })} />
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <div className="overview-tweaks-label">Radio de bordes ({settings.radius}px)</div>
            <input type="range" min="12" max="26" value={settings.radius} onChange={(e) => update({ radius: Number(e.target.value) })} style={{ width: '100%' }} />
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--text-2)', cursor: 'pointer' }}>
            <input type="checkbox" checked={settings.dense} onChange={(e) => update({ dense: e.target.checked })} />
            Layout denso
          </label>

          <div className="overview-tweaks-foot" style={{ marginTop: 16 }}>
            hyperox · dark · {settings.accent} · r{settings.radius}
          </div>
        </div>
      )}

      {tab === 'account' && (
        <div style={{ display: 'grid', gap: 16, maxWidth: 480 }}>
          <div className="card cardPad">
            <div className="sectionTitle" style={{ fontSize: 15, marginBottom: 16 }}>Información de perfil</div>
            <form onSubmit={saveProfile} className="adminFormGrid">
              <label className="authField">
                <span>Nombre</span>
                <input className="authInput" value={profile.firstName} onChange={e => setProfile(p => ({ ...p, firstName: e.target.value }))} placeholder="Nombre" />
              </label>
              <label className="authField">
                <span>Apellidos</span>
                <input className="authInput" value={profile.lastName} onChange={e => setProfile(p => ({ ...p, lastName: e.target.value }))} placeholder="Apellidos" />
              </label>
              <label className="authField" style={{ gridColumn: '1 / -1' }}>
                <span>Email / Usuario</span>
                <input className="authInput" value={profile.username} disabled style={{ opacity: 0.5 }} />
                <span style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 4 }}>El email se gestiona desde Keycloak</span>
              </label>
              <div>
                <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Guardar cambios'}</button>
              </div>
            </form>
          </div>

          <div className="card cardPad">
            <div className="sectionTitle" style={{ fontSize: 15, marginBottom: 16 }}>Cambiar contraseña</div>
            <form onSubmit={savePassword} className="adminFormGrid" style={{ gridTemplateColumns: '1fr' }}>
              {[
                { key: 'current', label: 'Contraseña actual' },
                { key: 'next',    label: 'Nueva contraseña (mín. 8 caracteres)' },
                { key: 'confirm', label: 'Confirmar nueva contraseña' },
              ].map(({ key, label }) => (
                <label key={key} className="authField">
                  <span>{label}</span>
                  <input className="authInput" type="password" value={pwForm[key]} onChange={e => setPwForm(p => ({ ...p, [key]: e.target.value }))} required />
                </label>
              ))}
              <div>
                <button className="btn btn-secondary" type="submit" disabled={saving}>{saving ? 'Actualizando...' : 'Actualizar contraseña'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  )
}
