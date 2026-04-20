import AppShell from '../components/AppShell'

export default function SettingsPage() {
  return (
    <AppShell title="Settings" subtitle="Punto de entrada visual para preferencias del panel y tema.">
      <div className="overview-floating-tweaks card" style={{ position: 'static', width: 320 }}>
        <div className="overview-tweaks-head"><strong>Tweaks</strong><button>×</button></div>
        <div className="overview-tweaks-label">Accent hue</div>
        <div className="overview-swatch-row">
          <span className="swatch cyan" />
          <span className="swatch teal" />
          <span className="swatch green" />
          <span className="swatch violet active" />
          <span className="swatch coral" />
        </div>
        <div className="overview-tweaks-label">Radius</div>
        <div className="overview-range"><span /><span className="knob" /></div>
        <div className="overview-tweaks-foot">hyperox.redesign · dark · cyan 285°</div>
      </div>
    </AppShell>
  )
}
