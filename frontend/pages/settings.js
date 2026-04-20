import { useEffect, useState } from 'react'
import AppShell from '../components/AppShell'
import { applySettings, DEFAULT_SETTINGS, loadSettings, saveSettings } from '../lib/panel'

const accents = ['cyan', 'teal', 'green', 'violet', 'coral']

export default function SettingsPage() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)

  useEffect(() => {
    const current = loadSettings()
    setSettings(current)
    applySettings(current)
  }, [])

  const update = (patch) => {
    const next = { ...settings, ...patch }
    setSettings(next)
    saveSettings(next)
    applySettings(next)
  }

  return (
    <AppShell title="Settings" subtitle="Preferencias visuales persistentes del panel.">
      <div className="overview-floating-tweaks card" style={{ position: 'static', width: 380 }}>
        <div className="overview-tweaks-head"><strong>Tweaks</strong></div>
        <div className="overview-tweaks-label">Accent hue</div>
        <div className="overview-swatch-row">
          {accents.map(accent => <button key={accent} className={`swatch ${accent} ${settings.accent === accent ? 'active' : ''}`} onClick={() => update({ accent })} />)}
        </div>
        <div className="overview-tweaks-label">Radius</div>
        <input type="range" min="12" max="26" value={settings.radius} onChange={(e) => update({ radius: Number(e.target.value) })} style={{ width: '100%' }} />
        <label className="muted" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14 }}><input type="checkbox" checked={settings.dense} onChange={(e) => update({ dense: e.target.checked })} /> Dense layout</label>
        <div className="overview-tweaks-foot">hyperox.ui · dark · {settings.accent} · r{settings.radius}</div>
      </div>
    </AppShell>
  )
}
