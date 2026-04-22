import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import AttackWorldMap from '../components/AttackWorldMap'
import AttackTopList from '../components/AttackTopList'
import { useRouter } from 'next/router'
import AppShell, { ShellIcon } from '../components/AppShell'
import { apiJson } from '../lib/auth'
import { exportToCSV } from '../lib/panel'
import { usePolling } from '../hooks/usePolling'

function pct(num, total) { return !total ? 0 : Math.round((num / total) * 100) }

function Spark({ values = [], stroke = 'var(--cyan)', fill = 'var(--cyan-dim)' }) {
  const w = 320, h = 88
  const max = Math.max(...values, 1), min = Math.min(...values, 0), span = max - min || 1
  const points = values.map((v, i) => {
    const x = (i / Math.max(values.length - 1, 1)) * w
    const y = h - ((v - min) / span) * (h - 12) - 6
    return `${x},${y}`
  }).join(' ')
  return (
    <svg className="overview-spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <polygon points={`0,${h} ${points} ${w},${h}`} fill={fill} />
      <polyline points={points} fill="none" stroke={stroke} strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function OverviewChart({ primary = [], secondary = [] }) {
  const w = 860, h = 260
  const allVals = [...primary, ...secondary]
  const max = allVals.length ? Math.max(...allVals, 1) : 100
  const span = max || 1
  const make = (series) => series.map((v, i) => {
    const x = (i / Math.max(series.length - 1, 1)) * w
    const y = h - (v / span) * (h - 28) - 16
    return `${x},${y}`
  }).join(' ')
  const p1 = make(primary)
  const p2 = make(secondary)
  return (
    <svg className="overview-chart-svg" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      {[0.2, 0.4, 0.6, 0.8].map(mark => {
        const y = h - mark * (h - 28) - 16
        return <line key={mark} x1="0" x2={w} y1={y} y2={y} stroke="rgba(154,163,191,0.12)" strokeDasharray="4 8" />
      })}
      {primary.length > 1 && (
        <polygon points={`0,${h} ${p1} ${w},${h}`} fill="rgba(173,161,255,0.15)" />
      )}
      {secondary.length > 1 && (
        <polyline points={p2} fill="none" stroke="rgba(250,204,21,0.78)" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
      )}
      {primary.length > 1 && (
        <polyline points={p1} fill="none" stroke="rgba(196,181,253,0.96)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      )}
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
  const [metrics, setMetrics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [attackMap, setAttackMap] = useState(null)
  const [search, setSearch] = useState('')
  const [metric, setMetric] = useState('cpu')

  useEffect(() => {
    let active = true
    Promise.allSettled([apiJson('/api/assets'), apiJson('/api/my/vms')]).then(([ar, vr]) => {
      if (!active) return
      if (ar.status === 'fulfilled') setAssets(ar.value || [])
      if (vr.status === 'fulfilled') setVms(vr.value || [])
      setLoading(false)
    })
    return () => { active = false }
  }, [])

  const fetchMetrics = useCallback(async (signal) => {
    try {
      return await apiJson('/api/overview/metrics?range=24h', { signal })
    } catch (e) {
      console.error('overview metrics poll failed', e)
      return null
    }
  }, [])
  usePolling(fetchMetrics, (data) => { if (data) setMetrics(data) }, 30000, true)

  const fetchAttackMap = useCallback(async (signal) => {
    try {
      return await apiJson('/api/overview/attack-map?range=24h', { signal })
    } catch (e) {
      console.error('overview attack-map poll failed', e)
      return null
    }
  }, [])

  usePolling(fetchAttackMap, (data) => {
    if (data) setAttackMap(data)
  }, 30000, true)

  const overview = useMemo(() => {
    const totalAssets     = assets.length
    const onlineAssets    = assets.filter(a => a.agent_status === 'online').length
    const offlineAssets   = assets.filter(a => a.agent_status === 'offline').length
    const errorAssets     = assets.filter(a => a.agent_status === 'error').length
    const unenrolledAssets= assets.filter(a => a.agent_status === 'unenrolled').length
    const windows         = assets.filter(a => /windows/i.test(`${a.os_name || a.os_type || ''}`)).length
    const linux           = assets.filter(a => /linux/i.test(`${a.os_name || a.os_type || ''}`)).length
    const proxmoxOrigin   = assets.filter(a => !a.is_external).length
    const externalOrigin  = assets.filter(a => a.is_external).length
    const runningVms      = vms.filter(vm => vm.status === 'running').length
    const openIncidents   = errorAssets + offlineAssets
    const cpuSeries       = metrics?.cpu?.series || []
    const memSeries       = metrics?.memory?.series || []
    return { totalAssets, onlineAssets, offlineAssets, errorAssets, unenrolledAssets,
      windows, linux, proxmoxOrigin, externalOrigin, runningVms, openIncidents,
      cpuSeries, memSeries, navCounts: { '/assets': totalAssets, '/vms': vms.length } }
  }, [assets, vms, metrics])

  const trendSeries = {
    cpu: metrics?.cpu?.series || [],
    memory: metrics?.memory?.series || [],
    network: metrics?.network?.series || [],
    disk: metrics?.disk?.series || [],
  }
  const currentSeries = trendSeries[metric] || []
  const avgVal = currentSeries.length
    ? (currentSeries.reduce((a, b) => a + b, 0) / currentSeries.length).toFixed(1) + '%'
    : '—'

  const filteredAssets = useMemo(() => {
    if (!search) return assets
    const q = search.toLowerCase()
    return assets.filter(a => `${a.display_name || ''} ${a.host_name || ''} ${a.fleet_policy_name || ''}`.toLowerCase().includes(q))
  }, [assets, search])

  const handleExport = () => {
    exportToCSV(assets.map(a => ({
      nombre: a.display_name || a.host_name,
      estado: a.agent_status,
      os: a.os_name || a.os_type,
      version: a.agent_version,
      ip: (a.ip_addresses || []).join('; '),
      ultimo_checkin: a.last_checkin_at,
    })), `overview-assets-${new Date().toISOString().slice(0, 10)}.csv`)
  }

  const attackDiagnostics = attackMap?.diagnostics || null

  return (
    <AppShell
      title="Infrastructure overview"
      subtitle="Estado en tiempo real de activos monitoreados y VMs Proxmox."
      breadcrumbs={['Hyperox', 'Overview']}
      searchValue={search}
      onSearchChange={setSearch}
      navCounts={overview.navCounts}
      actions={
        <div className="overview-toolbar">
          <span className="live-dot">LIVE · 30s</span>
          <button className="chip active">Last 24h</button>
          <button className="btn btn-secondary" onClick={handleExport}><ShellIcon name="export" /> Export</button>
          <button className="btn btn-primary" onClick={() => router.push('/admin')}><ShellIcon name="plus" /> Add asset</button>
        </div>
      }
    >
      {loading ? (
        <div className="card cardPad"><p className="muted">Cargando overview...</p></div>
      ) : (
        <div className="overview-page">
          <div className="overview-kpis-grid">
            <KpiCard label="Managed assets"    value={overview.totalAssets}   sub={`${overview.onlineAssets} online`}    accent="rgba(168,139,250,0.95)" series={overview.cpuSeries.slice(-8)} />
            <KpiCard label="Online agents"     value={`${overview.onlineAssets}/${overview.totalAssets}`} sub={`${pct(overview.onlineAssets, overview.totalAssets)}% uptime`} accent="rgba(74,222,128,0.95)" series={overview.memSeries.slice(-8)} />
            <KpiCard label="Incidentes abiertos" value={overview.openIncidents} sub={`${overview.errorAssets} error · ${overview.offlineAssets} offline`} accent="rgba(250,204,21,0.95)" series={[]} />
            <KpiCard label="VMs activas"       value={`${overview.runningVms}/${vms.length}`} sub="Proxmox running" accent="rgba(248,113,113,0.95)" series={[]} />
          </div>

          <div className="overview-main-grid">
            <section className="card overview-chart-card">
              <div className="overview-card-head">
                <div><h3>Tendencias de recursos</h3></div>
                <div className="overview-tabs">
                  {[['cpu','CPU'],['memory','Memory'],['network','Network'],['disk','Disk I/O']].map(([key, label]) => (
                    <button key={key} className={`overview-tab${metric === key ? ' active' : ''}`} onClick={() => setMetric(key)}>{label}</button>
                  ))}
                </div>
              </div>
              <div className="overview-chart-stats">
                <div><span>AVG</span><strong>{avgVal}</strong></div>
              </div>
              <div className="overview-chart-wrap">
                {currentSeries.length === 0 ? (
                  <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-4)', fontSize: 13, fontFamily: 'var(--font-mono)' }}>
                    Sin datos de métricas — conectando a Elasticsearch...
                  </div>
                ) : (
                  <OverviewChart primary={currentSeries} secondary={[]} />
                )}
              </div>
            </section>

            <aside className="card overview-status-card">
              <div className="overview-card-head compact">
                <h3><ShellIcon name="globe" size={14} /> Assets por estado</h3>
                <span className="ch-meta">{overview.totalAssets} total</span>
              </div>
              <div className="overview-status-list">
                {[
                  ['Online',     overview.onlineAssets,    'var(--green)'],
                  ['Error',      overview.errorAssets,     'var(--amber)'],
                  ['Offline',    overview.offlineAssets,   'var(--red)'],
                  ['Unenrolled', overview.unenrolledAssets,'var(--text-4)'],
                ].map(([label, value, color]) => (
                  <div key={label} className="status-bar-row">
                    <div className="status-bar-head"><span>{label}</span><span>{value}</span></div>
                    <div className="status-bar-track"><div className="status-bar-fill" style={{ width: `${pct(value, overview.totalAssets || 1)}%`, background: color }} /></div>
                  </div>
                ))}
              </div>
              <div className="overview-meta-grid">
                <div>
                  <div className="overview-meta-title">Por OS</div>
                  <div className="overview-meta-row"><span>⊞</span><span>{overview.windows} windows</span></div>
                  <div className="overview-meta-row"><span>◔</span><span>{overview.linux} linux</span></div>
                </div>
                <div>
                  <div className="overview-meta-title">Por origen</div>
                  <div className="overview-meta-row"><span>▤</span><span>{overview.proxmoxOrigin} proxmox</span></div>
                  <div className="overview-meta-row"><span>◎</span><span>{overview.externalOrigin} externo</span></div>
                </div>
              </div>
            </aside>
          </div>

          <div className="overview-attack-grid">
            <section className="card overview-attack-map-card">
              <div className="overview-card-head">
                <div>
                  <h3>Global attack map</h3>
                  <span className="ch-meta">Failed auth / suspicious origins · last 24h</span>
                </div>
              </div>

              {!attackMap?.points?.length ? (
                <div
                  style={{
                    minHeight: 420,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'column',
                    gap: 10,
                    color: 'var(--text-4)',
                    fontSize: 13,
                    fontFamily: 'var(--font-mono)',
                    textAlign: 'center',
                    padding: '0 18px',
                  }}
                >
                  <div>Sin datos geolocalizados de ataques.</div>
                  {attackDiagnostics?.matchedEvents > 0 && (
                    <div style={{ maxWidth: 760, lineHeight: 1.6 }}>
                      Se detectaron {attackDiagnostics.matchedEvents} eventos sospechosos, pero solo {attackDiagnostics.eventsWithGeo} contienen <code>source.geo.location</code>.
                      Revisa el enrichment GeoIP o el pipeline que copia <code>winlog.event_data.IpAddress</code> hacia <code>source.ip</code>.
                    </div>
                  )}
                </div>
              ) : (
                <AttackWorldMap data={attackMap} />
              )}
            </section>

            <aside className="card overview-attack-side-card">
              <AttackTopList data={attackMap} />
            </aside>
          </div>

          {search && (
            <div className="card cardPad" style={{ marginTop: 18 }}>
              <div className="sectionTitle" style={{ fontSize: 16, marginBottom: 12 }}>Resultados para "{search}"</div>
              <div className="vmCardGrid">
                {filteredAssets.slice(0, 6).map(asset => (
                  <div key={asset.id} className="vmCard" onClick={() => router.push(`/assets/${asset.id}`)} style={{ cursor: 'pointer' }}>
                    <div className="vmCardTop">
                      <div>
                        <div className="vmCardTitleBtn">{asset.display_name || asset.host_name || 'Asset'}</div>
                        <div className="vmCardTags"><span className="vmTag">{asset.fleet_policy_name || 'default-policy'}</span></div>
                      </div>
                      <span className={`vm-status ${asset.agent_status === 'online' ? 'running' : 'stopped'}`}>{asset.agent_status || 'unknown'}</span>
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
