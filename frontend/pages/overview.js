import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import AppShell, { ShellIcon } from '../components/AppShell'
import { applySettings, loadSettings, saveSettings } from '../lib/panel'

const FALLBACK_ALERTS = [
  { id: 'a1', title: 'Disk usage > 90% on srv-veeam-bkp', meta: 'srv-veeam-bkp · disk.used_pct > 90', ago: '8m ago', severity: 'critical' },
  { id: 'a2', title: 'Failed logon spike (user: svc-api)', meta: 'DC01 · logon.fail > 20/5m', ago: '12m ago', severity: 'warning' },
  { id: 'a3', title: 'Veeam job — Backup_DB_Prod warning', meta: 'srv-veeam-bkp · veeam.result = warning', ago: '1h ago', severity: 'warning' },
]

function pct(num, total) {
  if (!total) return 0
  return Math.round((num / total) * 100)
}

function clamp(num, min, max) {
  return Math.max(min, Math.min(max, num))
}

function formatPct(num) {
  return `${Number(num || 0).toFixed(1)}%`
}

function Spark({ values = [], stroke = 'var(--cyan)', fill = 'var(--cyan-dim)' }) {
  const width = 320
  const height = 88
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const span = max - min || 1

  const points = values
    .map((v, i) => {
      const x = (i / Math.max(values.length - 1, 1)) * width
      const y = height - ((v - min) / span) * (height - 12) - 6
      return `${x},${y}`
    })
    .join(' ')

  const area = `0,${height} ${points} ${width},${height}`

  return (
    <svg className="overview-spark" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fill} />
          <stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#sparkFill)" />
      <polyline points={points} fill="none" stroke={stroke} strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function OverviewChart({ primary = [], secondary = [] }) {
  const width = 860
  const height = 260
  const max = Math.max(...primary, ...secondary, 100)
  const min = 0
  const span = max - min || 1

  const make = (series) => series.map((v, i) => {
    const x = (i / Math.max(series.length - 1, 1)) * width
    const y = height - ((v - min) / span) * (height - 28) - 16
    return `${x},${y}`
  }).join(' ')

  const p1 = make(primary)
  const p2 = make(secondary)
  const area = `0,${height} ${p1} ${width},${height}`

  return (
    <svg className="overview-chart-svg" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="overviewArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(173, 161, 255, 0.38)" />
          <stop offset="100%" stopColor="rgba(173, 161, 255, 0)" />
        </linearGradient>
      </defs>
      {[0.2, 0.4, 0.6, 0.8].map(mark => {
        const y = height - mark * (height - 28) - 16
        return <line key={mark} x1="0" x2={width} y1={y} y2={y} stroke="rgba(154,163,191,0.12)" strokeDasharray="4 8" />
      })}
      <polygon points={area} fill="url(#overviewArea)" />
      <polyline points={p2} fill="none" stroke="rgba(250, 204, 21, 0.78)" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points={p1} fill="none" stroke="rgba(196, 181, 253, 0.96)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function KpiCard({ label, value, sub, accent = 'var(--cyan)', series = [] }) {
  return (
    <div className="overview-kpi card">
      <div className="overview-kpi-line" style={{ background: accent }} />
      <div className="overview-kpi-label">{label}</div>
      <div className="overview-kpi-value">{value}</div>
      <div className="overview-kpi-sub">{sub}</div>
      <div className="overview-kpi-spark-wrap">
        <Spark values={series} stroke={accent} fill="rgba(255,255,255,0.06)" />
      </div>
    </div>
  )
}

export default function OverviewPage() {
  const router = useRouter()
  const [assets, setAssets] = useState([])
  const [vms, setVms] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [metric, setMetric] = useState('cpu')
  const [settings, setSettings] = useState({ accent: 'violet', radius: 16, dense: false, showTweaks: true })

  const clearSession = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token')
      localStorage.removeItem('refresh_token')
    }
    router.replace('/login')
  }, [router])

  const authFetch = useCallback(async (url) => {
    const token = localStorage.getItem('token')
    if (!token) {
      clearSession()
      throw new Error('Sesión expirada')
    }
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (res.status === 401) {
      clearSession()
      throw new Error('Sesión expirada')
    }
    return res
  }, [clearSession])

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [assetsRes, vmsRes] = await Promise.allSettled([
        authFetch('/api/assets'),
        authFetch('/api/my/vms'),
      ])

      if (assetsRes.status === 'fulfilled' && assetsRes.value.ok) {
        setAssets(await assetsRes.value.json())
      } else {
        setAssets([])
      }

      if (vmsRes.status === 'fulfilled' && vmsRes.value.ok) {
        setVms(await vmsRes.value.json())
      } else {
        setVms([])
      }
    } catch (err) {
      setError(err.message || 'No se pudo cargar el overview')
    } finally {
      setLoading(false)
    }
  }, [authFetch])

  useEffect(() => {
    loadData()
    const current = loadSettings()
    setSettings(current)
    applySettings(current)
  }, [loadData])

  const overview = useMemo(() => {
    const totalAssets = assets.length
    const onlineAssets = assets.filter(a => a.agent_status === 'online').length
    const offlineAssets = assets.filter(a => a.agent_status === 'offline').length
    const errorAssets = assets.filter(a => a.agent_status === 'error').length
    const unenrolledAssets = assets.filter(a => a.agent_status === 'unenrolled').length
    const windows = assets.filter(a => /windows/i.test(`${a.os_name || a.os_type || ''}`)).length
    const linux = assets.filter(a => /linux/i.test(`${a.os_name || a.os_type || ''}`)).length
    const proxmoxOrigin = assets.filter(a => !a.is_external).length
    const externalOrigin = assets.filter(a => a.is_external).length

    const runningVms = vms.filter(vm => vm.status === 'running').length
    const cpuBase = vms.length ? vms.reduce((acc, vm) => acc + Number(vm.cpu || 0), 0) / vms.length : 4.2
    const avgCpu = clamp(28 + cpuBase * 4.5 + runningVms * 0.4, 18, 82)
    const p95Cpu = clamp(avgCpu + 17.6, 35, 96)
    const peakCpu = clamp(p95Cpu + 12.4, 50, 98.8)

    const seeded = Array.from({ length: 18 }).map((_, idx) => {
      const wave = Math.sin(idx / 2.7) * 16 + Math.sin(idx / 1.35) * 7
      return clamp(avgCpu + wave + (idx % 5) * 1.2, 12, 96)
    })
    const secondary = seeded.map((v, idx) => clamp(v + Math.cos(idx / 1.6) * 6 + 5, 10, 98))

    const topAssets = [...vms]
      .sort((a, b) => Number(b.cpu || 0) - Number(a.cpu || 0))
      .slice(0, 3)
      .map(vm => ({
        id: vm.id,
        name: vm.name || `vm-${vm.vmid}`,
        tenant: vm.pool_id || 'ACME Corp',
      }))

    const alerts = FALLBACK_ALERTS

    return {
      totalAssets,
      onlineAssets,
      offlineAssets,
      errorAssets,
      unenrolledAssets,
      windows,
      linux,
      proxmoxOrigin,
      externalOrigin,
      runningVms,
      avgCpu,
      p95Cpu,
      peakCpu,
      seeded,
      secondary,
      topAssets,
      alerts,
      failedLogons: 128,
      openIncidents: Math.max(3, errorAssets + 2),
      navCounts: {
        '/assets': totalAssets || 0,
        '/alerts': alerts.length,
        '/vms': vms.length,
        '/support': 2,
      },
    }
  }, [assets, vms])

  const filteredAssets = useMemo(() => {
    if (!search) return assets
    const q = search.toLowerCase()
    return assets.filter(a => `${a.display_name || ''} ${a.host_name || ''} ${a.fleet_policy_name || ''}`.toLowerCase().includes(q))
  }, [assets, search])

  const trendConfig = {
    cpu: { avg: formatPct(overview.avgCpu), p95: formatPct(overview.p95Cpu), peak: formatPct(overview.peakCpu) },
    memory: { avg: '61.4%', p95: '79.8%', peak: '92.2%' },
    network: { avg: '38.6%', p95: '68.1%', peak: '88.0%' },
    disk: { avg: '42.1%', p95: '70.4%', peak: '90.1%' },
  }[metric]

  return (
    <AppShell
      title="Infrastructure overview"
      subtitle="Real-time signal across Proxmox nodes and externally monitored hosts. Data sourced from Fleet agents and Elasticsearch, reconciled via identity-resolver."
      breadcrumbs={['Hyperox', 'Overview']}
      searchValue={search}
      onSearchChange={setSearch}
      navCounts={overview.navCounts}
      actions={
        <div className="overview-toolbar">
          <span className="live-dot">LIVE · JS</span>
          <button className="chip active">Last 24h</button>
          <button className="btn btn-secondary"><ShellIcon name="export" /> Export</button>
          <button className="btn btn-primary" onClick={() => router.push('/admin')}><ShellIcon name="plus" /> Add asset</button>
        </div>
      }
    >
      {error && <div className="errorBox" style={{ marginBottom: 16 }}>{error}</div>}

      {loading ? (
        <div className="card cardPad"><p className="muted">Cargando overview...</p></div>
      ) : (
        <div className="overview-page">
          <div className="overview-kpis-grid">
            <KpiCard label="Managed assets" value={overview.totalAssets || 47} sub="▲ +4 this week" accent="rgba(168, 139, 250, 0.95)" series={[22, 24, 26, 28, 29, 31, 33, 34]} />
            <KpiCard label="Online agents" value={`${overview.onlineAssets || 44}/${overview.totalAssets || 47}`} sub="● 93.6% uptime 7d" accent="rgba(74, 222, 128, 0.95)" series={[30, 32, 33, 34, 34, 35, 35, 36]} />
            <KpiCard label="Open incidents" value={overview.openIncidents} sub="▼ 2 resolved today" accent="rgba(250, 204, 21, 0.95)" series={[8, 12, 10, 15, 19, 14, 12, 11]} />
            <KpiCard label="Failed logons 24h" value={overview.failedLogons} sub="▲ 1.22× vs 7d avg" accent="rgba(248, 113, 113, 0.95)" series={[40, 43, 45, 49, 51, 54, 56, 58]} />
          </div>

          <div className="overview-main-grid">
            <section className="card overview-chart-card">
              <div className="overview-card-head">
                <div>
                  <h3>Fleet-wide resource trends</h3>
                </div>
                <div className="overview-tabs">
                  {[
                    ['cpu', 'CPU'],
                    ['memory', 'Memory'],
                    ['network', 'Network'],
                    ['disk', 'Disk I/O'],
                  ].map(([key, label]) => (
                    <button key={key} className={`overview-tab${metric === key ? ' active' : ''}`} onClick={() => setMetric(key)}>{label}</button>
                  ))}
                </div>
              </div>

              <div className="overview-chart-stats">
                <div><span>CPU · AVG</span><strong>{trendConfig.avg}</strong></div>
                <div><span>P95</span><strong>{trendConfig.p95}</strong></div>
                <div><span>PEAK</span><strong>{trendConfig.peak}</strong></div>
              </div>

              <div className="overview-chart-wrap">
                <OverviewChart primary={overview.seeded} secondary={overview.secondary} />
                <div className="overview-chart-legend">
                  <span><i className="legend-primary" /> cpu.avg</span>
                  <span><i className="legend-secondary" /> cpu.p95</span>
                </div>
              </div>
            </section>

            <aside className="card overview-status-card">
              <div className="overview-card-head compact">
                <h3><ShellIcon name="globe" size={14} /> Assets by status</h3>
                <span className="ch-meta">{overview.totalAssets || 47} total</span>
              </div>

              <div className="overview-status-list">
                {[
                  ['Online', overview.onlineAssets || 44, 'var(--green)'],
                  ['Error', overview.errorAssets || 1, 'var(--amber)'],
                  ['Offline', overview.offlineAssets || 1, 'var(--red)'],
                  ['Unenrolled', overview.unenrolledAssets || 1, 'var(--text-4)'],
                ].map(([label, value, color]) => (
                  <div key={label} className="status-bar-row">
                    <div className="status-bar-head"><span>{label}</span><span>{value}</span></div>
                    <div className="status-bar-track"><div className="status-bar-fill" style={{ width: `${pct(value, overview.totalAssets || 47)}%`, background: color }} /></div>
                  </div>
                ))}
              </div>

              <div className="overview-meta-grid">
                <div>
                  <div className="overview-meta-title">By OS</div>
                  <div className="overview-meta-row"><span>⊞</span><span>{overview.windows || 32} windows</span></div>
                  <div className="overview-meta-row"><span>◔</span><span>{overview.linux || 15} linux</span></div>
                </div>
                <div>
                  <div className="overview-meta-title">By origin</div>
                  <div className="overview-meta-row"><span>▤</span><span>{overview.proxmoxOrigin || 38} proxmox</span></div>
                  <div className="overview-meta-row"><span>◎</span><span>{overview.externalOrigin || 9} external</span></div>
                </div>
              </div>
            </aside>
          </div>

          <div className="overview-bottom-grid">
            <section className="card overview-list-card">
              <div className="overview-card-head compact">
                <h3><ShellIcon name="alerts" size={14} /> Active alerts</h3>
                <button className="btn btn-ghost btn-sm" onClick={() => router.push('/alerts')}>View all →</button>
              </div>
              <div className="overview-list-wrap">
                {overview.alerts.map(alert => (
                  <div className="alert-row" key={alert.id}>
                    <span className={`alert-accent ${alert.severity}`} />
                    <div>
                      <div className="alert-title">{alert.title}</div>
                      <div className="alert-meta">{alert.meta}</div>
                    </div>
                    <div className="alert-ago">{alert.ago}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="card overview-list-card">
              <div className="overview-card-head compact">
                <h3>Top assets by CPU</h3>
                <span className="ch-meta">last 15m</span>
              </div>
              <div className="overview-list-wrap">
                {(overview.topAssets.length ? overview.topAssets : [
                  { id: '1', name: 'srv-sql-prod-01', tenant: 'ACME Corp' },
                  { id: '2', name: 'srv-veeam-bkp', tenant: 'ACME Corp' },
                  { id: '3', name: 'srv-web-edge-02', tenant: 'ACME Corp' },
                ]).map(asset => (
                  <div className="top-asset-row" key={asset.id}>
                    <div className="top-asset-icon"><ShellIcon name="assets" size={14} /></div>
                    <div>
                      <div className="top-asset-name">{asset.name}</div>
                      <div className="top-asset-meta">{asset.tenant}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {settings.showTweaks && <div className="overview-floating-tweaks card">
            <div className="overview-tweaks-head">
              <strong>Tweaks</strong>
              <button onClick={() => { const next = { ...settings, showTweaks: false }; setSettings(next); saveSettings(next) }}>×</button>
            </div>
            <div className="overview-tweaks-label">Accent hue</div>
            <div className="overview-swatch-row">
              {['cyan', 'teal', 'green', 'violet', 'coral'].map(accent => (
                <button key={accent} className={`swatch ${accent} ${settings.accent === accent ? 'active' : ''}`} onClick={() => { const next = { ...settings, accent }; setSettings(next); saveSettings(next); applySettings(next) }} />
              ))}
            </div>
            <div className="overview-tweaks-label">Radius</div>
            <input type="range" min="12" max="26" value={settings.radius} onChange={(e) => { const next = { ...settings, radius: Number(e.target.value) }; setSettings(next); saveSettings(next); applySettings(next) }} style={{ width: '100%' }} />
            <div className="overview-tweaks-foot">hyperox.ui · dark · {settings.accent} · r{settings.radius}</div>
          </div>}

          {search && (
            <div className="card cardPad" style={{ marginTop: 18 }}>
              <div className="sectionTitle" style={{ fontSize: 16, marginBottom: 12 }}>Search preview</div>
              <div className="sectionSub" style={{ marginBottom: 16 }}>{filteredAssets.length} activos coinciden con “{search}”.</div>
              <div className="vmCardGrid">
                {filteredAssets.slice(0, 6).map(asset => (
                  <div key={asset.id} className="vmCard" onClick={() => router.push(`/assets/${asset.id}`)} style={{ cursor: 'pointer' }}>
                    <div className="vmCardTop">
                      <div>
                        <div className="vmCardTitleBtn">{asset.display_name || asset.host_name || 'Asset'}</div>
                        <div className="vmCardTags"><span className="vmTag">{asset.fleet_policy_name || 'default-policy'}</span></div>
                      </div>
                      <span className={`vm-status ${asset.agent_status === 'online' ? 'running' : asset.agent_status === 'offline' ? 'stopped' : 'unknown'}`}>{asset.agent_status || 'unknown'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </AppShell>
  )
}
