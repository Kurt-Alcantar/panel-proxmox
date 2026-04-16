import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import AppShell from '../../../components/AppShell'

const RESULT_COLORS = {
  success: '#22c55e',
  warning: '#f59e0b',
  failed:  '#ef4444',
  started: '#38bdf8',
  progress:'#8b5cf6',
  unknown: '#6b7280',
}
const RESULT_LABELS = {
  success: 'Exitoso',
  warning: 'Advertencia',
  failed:  'Fallido',
  started: 'Iniciado',
  progress:'En progreso',
  unknown: 'Desconocido',
}

function ResultBadge({ result }) {
  const c = RESULT_COLORS[result] || '#6b7280'
  const l = RESULT_LABELS[result] || result
  return (
    <span style={{ background: c + '22', color: c, border: `1px solid ${c}44`, borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
      {l}
    </span>
  )
}

function KpiBox({ label, value, color }) {
  return (
    <div style={{ background: color + '15', border: `1px solid ${color}33`, borderRadius: 12, padding: '14px 18px', textAlign: 'center', minWidth: 100 }}>
      <div style={{ fontSize: 32, fontWeight: 800, color, lineHeight: 1 }}>{value ?? 0}</div>
      <div style={{ fontSize: 11, color: '#b8abd9', marginTop: 6 }}>{label}</div>
    </div>
  )
}

function TrendChart({ trend }) {
  const canvasRef = useRef(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !trend?.length) return
    const ctx = canvas.getContext('2d')
    const w = canvas.width, h = canvas.height, pad = 6
    ctx.clearRect(0, 0, w, h)
    const maxVal = Math.max(...trend.map(t => t.success + t.warning + t.failed), 1)
    const bw = (w - pad * 2) / trend.length - 2

    trend.forEach((t, i) => {
      const x = pad + i * ((w - pad * 2) / trend.length)
      const total = t.success + t.warning + t.failed
      if (!total) return
      let yOff = h - pad
      const draw = (val, color) => {
        if (!val) return
        const bh = (val / maxVal) * (h - pad * 2)
        ctx.fillStyle = color
        ctx.fillRect(x, yOff - bh, bw, bh)
        yOff -= bh
      }
      draw(t.failed, '#ef4444')
      draw(t.warning, '#f59e0b')
      draw(t.success, '#22c55e')
    })
  }, [trend])

  if (!trend?.length) return null
  return (
    <div>
      <div style={{ fontSize: 11, color: '#b8abd9', marginBottom: 6 }}>Jobs por hora (últimas 24h)</div>
      <canvas ref={canvasRef} width={480} height={80} style={{ width: '100%', height: 80 }} />
      <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
        {[['#22c55e', 'Exitosos'], ['#f59e0b', 'Advertencias'], ['#ef4444', 'Fallidos']].map(([c, l]) => (
          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, background: c, display: 'inline-block', borderRadius: 2 }} />
            <span style={{ fontSize: 11, color: '#b8abd9' }}>{l}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function JobRow({ job, onSelect, selected }) {
  const c = RESULT_COLORS[job.lastResult] || '#6b7280'
  const ts = v => v ? new Date(v).toLocaleString('es-MX') : '—'
  const successRate = job.totalRuns ? Math.round((job.success / job.totalRuns) * 100) : 0
  return (
    <tr
      onClick={() => onSelect(job)}
      style={{ borderBottom: '1px solid rgba(59,45,99,0.3)', cursor: 'pointer', background: selected ? 'rgba(139,92,246,0.1)' : 'transparent' }}
    >
      <td style={{ padding: '10px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: c, flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#f3edff' }}>{job.name}</span>
        </div>
      </td>
      <td style={{ padding: '10px 12px' }}><ResultBadge result={job.lastResult} /></td>
      <td style={{ padding: '10px 12px', fontSize: 12, color: '#b8abd9', whiteSpace: 'nowrap' }}>{ts(job.lastRun)}</td>
      <td style={{ padding: '10px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, background: 'rgba(255,255,255,0.07)', borderRadius: 4, height: 6, overflow: 'hidden', minWidth: 60 }}>
            <div style={{ width: `${successRate}%`, height: '100%', background: successRate > 80 ? '#22c55e' : successRate > 50 ? '#f59e0b' : '#ef4444', borderRadius: 4, transition: 'width 0.5s' }} />
          </div>
          <span style={{ fontSize: 11, color: '#b8abd9', minWidth: 32 }}>{successRate}%</span>
        </div>
      </td>
      <td style={{ padding: '10px 12px', fontSize: 12, color: '#b8abd9', textAlign: 'center' }}>{job.totalRuns}</td>
    </tr>
  )
}

function JobHistoryPanel({ job, history, onClose }) {
  const ts = v => v ? new Date(v).toLocaleString('es-MX') : '—'
  return (
    <div style={{ background: 'rgba(23,17,41,0.98)', border: '1px solid #3b2d63', borderRadius: 16, padding: '16px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#f3edff' }}>{job.name}</div>
          <div style={{ fontSize: 11, color: '#b8abd9', marginTop: 2 }}>Historial de ejecuciones</div>
        </div>
        <button className="btn btnSecondary" style={{ fontSize: 12, padding: '4px 10px' }} onClick={onClose}>✕ Cerrar</button>
      </div>
      {!history?.length ? (
        <div style={{ color: '#b8abd9', fontSize: 13 }}>Sin historial disponible.</div>
      ) : (
        <div style={{ overflowX: 'auto', maxHeight: 320, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #3b2d63' }}>
                {['Fecha', 'Resultado', 'Mensaje'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 10px', fontSize: 11, color: '#b8abd9' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.map((r, i) => (
                <tr key={i} style={{ borderBottom: '1px solid rgba(59,45,99,0.3)' }}>
                  <td style={{ padding: '8px 10px', fontSize: 11, color: '#b8abd9', whiteSpace: 'nowrap' }}>{ts(r.timestamp)}</td>
                  <td style={{ padding: '8px 10px' }}><ResultBadge result={r.result} /></td>
                  <td style={{ padding: '8px 10px', fontSize: 11, color: '#f3edff', maxWidth: 400 }}>
                    <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 380 }} title={r.message}>{r.message || '—'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function VeeamJobsPage() {
  const router = useRouter()
  const { id } = router.query
  const [asset, setAsset] = useState(null)
  const [overview, setOverview] = useState(null)
  const [jobs, setJobs] = useState([])
  const [selectedJob, setSelectedJob] = useState(null)
  const [jobHistory, setJobHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [hours, setHours] = useState(24)
  const [lastRefresh, setLastRefresh] = useState(null)
  const refreshTimer = useRef(null)
  const isFetching = useRef(false)

  const clearSession = useCallback(() => {
    localStorage.removeItem('token'); localStorage.removeItem('refresh_token'); router.replace('/login')
  }, [router])

  const apiGet = useCallback(async (url) => {
    const token = localStorage.getItem('token')
    if (!token) { clearSession(); return null }
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (res.status === 401) { clearSession(); return null }
    if (!res.ok) throw new Error(`Error ${res.status}`)
    return res.json()
  }, [clearSession])

  const loadAll = useCallback(async (assetId, h) => {
    if (!assetId) return
    try {
      const [ov, jl] = await Promise.all([
        apiGet(`/api/assets/${assetId}/veeam/overview?hours=${h}`),
        apiGet(`/api/assets/${assetId}/veeam/jobs?days=7`),
      ])
      if (ov) setOverview(ov)
      if (jl) setJobs(jl)
      setLastRefresh(new Date())
    } catch (_) {}
  }, [apiGet])

  const loadSilent = useCallback(async (assetId, h) => {
    if (!assetId || isFetching.current) return
    isFetching.current = true
    try {
      const ov = await apiGet(`/api/assets/${assetId}/veeam/overview?hours=${h}`)
      if (ov) setOverview(ov)
      setLastRefresh(new Date())
    } catch (_) {} finally { isFetching.current = false }
  }, [apiGet])

  useEffect(() => {
    if (!id) return
    setLoading(true)
    apiGet(`/api/assets/${id}`).then(async (a) => {
      setAsset(a)
      await loadAll(id, hours)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (!id) return
    if (refreshTimer.current) clearInterval(refreshTimer.current)
    refreshTimer.current = setInterval(() => loadSilent(id, hours), 10000)
    return () => clearInterval(refreshTimer.current)
  }, [id, hours, loadSilent])

  const handleHoursChange = async (h) => {
    setHours(h)
    await loadAll(id, h)
  }

  const handleSelectJob = async (job) => {
    if (selectedJob?.name === job.name) { setSelectedJob(null); return }
    setSelectedJob(job)
    setLoadingHistory(true)
    try {
      const history = await apiGet(`/api/assets/${id}/veeam/jobs/${encodeURIComponent(job.name)}/history?days=7`)
      setJobHistory(history || [])
    } catch (_) { setJobHistory([]) } finally { setLoadingHistory(false) }
  }

  const ts = v => v ? new Date(v).toLocaleString('es-MX') : '—'
  const card = (children, style = {}) => (
    <div style={{ background: 'rgba(23,17,41,0.92)', border: '1px solid #3b2d63', borderRadius: 16, padding: '16px 20px', ...style }}>
      {children}
    </div>
  )

  if (loading) return <AppShell title="Veeam Jobs"><div className="card cardPad"><p className="muted">Cargando...</p></div></AppShell>
  if (!asset) return <AppShell title="No encontrado"><div className="card cardPad"><div className="errorBox">Activo no encontrado.</div></div></AppShell>

  const kpis = overview?.kpis || {}
  const healthScore = kpis.total ? Math.round((kpis.success / kpis.total) * 100) : null
  const healthColor = healthScore == null ? '#6b7280' : healthScore >= 90 ? '#22c55e' : healthScore >= 70 ? '#f59e0b' : '#ef4444'

  return (
    <AppShell
      title={`Veeam Jobs — ${asset.display_name || asset.host_name}`}
      subtitle={`${asset.os_name || ''} · ${asset.agent_version || ''}`}
      actions={
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btnSecondary" onClick={() => router.push(`/assets/${id}`)}>← Activo</button>
          <button className="btn btnSecondary" onClick={() => router.push('/assets')}>Activos</button>
        </div>
      }
    >
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.25}}`}</style>

      {/* Header con health score */}
      {card(
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', border: `3px solid ${healthColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: healthColor }}>{healthScore != null ? `${healthScore}%` : '—'}</span>
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#f3edff' }}>Estado de backups</div>
              <div style={{ fontSize: 11, color: '#b8abd9' }}>Tasa de éxito en las últimas {hours}h</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <KpiBox label="Exitosos" value={kpis.success} color="#22c55e" />
            <KpiBox label="Advertencias" value={kpis.warning} color="#f59e0b" />
            <KpiBox label="Fallidos" value={kpis.failed} color="#ef4444" />
            <KpiBox label="Total" value={kpis.total} color="#8b5cf6" />
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Selector de rango */}
            <div style={{ display: 'flex', gap: 6 }}>
              {[24, 48, 168].map(h => (
                <button key={h} onClick={() => handleHoursChange(h)}
                  style={{ background: hours === h ? 'rgba(139,92,246,0.25)' : 'rgba(255,255,255,0.05)', border: `1px solid ${hours === h ? 'rgba(139,92,246,0.5)' : 'rgba(59,45,99,0.5)'}`, borderRadius: 8, padding: '4px 10px', fontSize: 12, color: hours === h ? '#c4b5fd' : '#b8abd9', cursor: 'pointer' }}>
                  {h === 24 ? '24h' : h === 48 ? '48h' : '7d'}
                </button>
              ))}
            </div>
            {lastRefresh && (
              <span style={{ fontSize: 11, color: '#b8abd9', display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block', animation: 'pulse 2s infinite' }} />
                Live 10s · {lastRefresh.toLocaleTimeString('es-MX')}
              </span>
            )}
          </div>
        </div>,
        { marginBottom: 16 }
      )}

      {/* Alertas */}
      {kpis.failed > 0 && card(
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 20 }}>⚠</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#ef4444' }}>{kpis.failed} job{kpis.failed > 1 ? 's' : ''} fallido{kpis.failed > 1 ? 's' : ''} en las últimas {hours}h</div>
            {overview?.lastFailed && (
              <div style={{ fontSize: 11, color: '#b8abd9', marginTop: 2 }}>
                Último fallo: {ts(overview.lastFailed.timestamp)} — {overview.lastFailed.jobName || overview.lastFailed.message}
              </div>
            )}
          </div>
        </div>,
        { marginBottom: 16, border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.08)' }
      )}

      {/* Tendencia */}
      {overview?.trend?.length > 0 && card(
        <>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#b8abd9', marginBottom: 12 }}>Tendencia de jobs</div>
          <TrendChart trend={overview.trend} />
        </>,
        { marginBottom: 16 }
      )}

      {/* Tabla de jobs */}
      {card(
        <>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#b8abd9', marginBottom: 14 }}>
            Jobs detectados <span style={{ fontSize: 11, fontWeight: 400, color: '#6b7280' }}>últimos 7 días · click para ver historial</span>
          </div>
          {!jobs?.length ? (
            <div style={{ color: '#b8abd9', fontSize: 13, padding: '12px 0' }}>Sin jobs detectados en los últimos 7 días.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #3b2d63' }}>
                    {['Nombre del job', 'Último resultado', 'Última ejecución', 'Tasa éxito', 'Ejecuciones'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, color: '#b8abd9' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job, i) => (
                    <JobRow key={i} job={job} onSelect={handleSelectJob} selected={selectedJob?.name === job.name} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>,
        { marginBottom: 16 }
      )}

      {/* Historial del job seleccionado */}
      {selectedJob && (
        <div style={{ marginBottom: 16 }}>
          {loadingHistory ? (
            card(<p className="muted">Cargando historial...</p>)
          ) : (
            <JobHistoryPanel job={selectedJob} history={jobHistory} onClose={() => setSelectedJob(null)} />
          )}
        </div>
      )}

      {/* Eventos recientes raw */}
      {overview?.recentEvents?.length > 0 && card(
        <>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#b8abd9', marginBottom: 14 }}>Eventos recientes del canal Veeam Backup</div>
          <div style={{ overflowX: 'auto', maxHeight: 300, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #3b2d63' }}>
                  {['Fecha', 'Resultado', 'Código', 'Mensaje'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 10px', fontSize: 11, color: '#b8abd9' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {overview.recentEvents.map((e, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(59,45,99,0.3)' }}>
                    <td style={{ padding: '8px 10px', fontSize: 11, color: '#b8abd9', whiteSpace: 'nowrap' }}>{ts(e.timestamp)}</td>
                    <td style={{ padding: '8px 10px' }}><ResultBadge result={e.result} /></td>
                    <td style={{ padding: '8px 10px', fontSize: 11, color: '#6b7280' }}>{e.eventCode}</td>
                    <td style={{ padding: '8px 10px', fontSize: 11, color: '#f3edff', maxWidth: 500 }}>
                      <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 480 }} title={e.message}>{e.message || '—'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </AppShell>
  )
}
