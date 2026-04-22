import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import AppShell from '../../../components/AppShell'

const RESULT_COLORS = {
  success: '#22c55e',
  warning: '#f59e0b',
  failed: '#ef4444',
  started: '#38bdf8',
  progress: '#8b5cf6',
  unknown: '#6b7280',
}

const RESULT_LABELS = {
  success: 'Exitoso',
  warning: 'Advertencia',
  failed: 'Fallido',
  started: 'Iniciado',
  progress: 'En progreso',
  unknown: 'Desconocido',
}

const JOB_TYPE_LABELS = {
  normal: 'Backup Job',
  copy: 'Backup Copy Job',
}

function ResultBadge({ result }) {
  const c = RESULT_COLORS[result] || '#6b7280'
  return <span style={{ background: c + '22', color: c, border: `1px solid ${c}44`, borderRadius: 999, padding: '3px 8px', fontSize: 11, fontWeight: 700 }}>{RESULT_LABELS[result] || result}</span>
}

function TypeBadge({ type }) {
  const isCopy = type === 'copy'
  const color = isCopy ? '#38bdf8' : '#8b5cf6'
  return <span style={{ background: color + '22', color, border: `1px solid ${color}44`, borderRadius: 999, padding: '3px 8px', fontSize: 11, fontWeight: 700 }}>{JOB_TYPE_LABELS[type] || 'Job'}</span>
}

function KpiBox({ label, value, color }) {
  return (
    <div style={{ background: color + '15', border: `1px solid ${color}33`, borderRadius: 12, padding: '14px 18px', textAlign: 'center', minWidth: 100 }}>
      <div style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1 }}>{value ?? 0}</div>
      <div style={{ fontSize: 11, color: '#b8abd9', marginTop: 6 }}>{label}</div>
    </div>
  )
}

function SummaryBand({ title, stats, accent }) {
  const border = `1px solid ${accent}33`
  const bg = `${accent}10`
  return (
    <div style={{ background: bg, border, borderRadius: 14, padding: '14px 16px', flex: 1, minWidth: 280 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: '#f3edff' }}>{title}</div>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: accent, display: 'inline-block' }} />
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <KpiBox label='Total jobs' value={stats?.totalJobs ?? 0} color={accent} />
        <KpiBox label='Exitosos' value={stats?.successJobs ?? 0} color='#22c55e' />
        <KpiBox label='Advertencias' value={stats?.warningJobs ?? 0} color='#f59e0b' />
        <KpiBox label='Fallidos' value={stats?.failedJobs ?? 0} color='#ef4444' />
      </div>
    </div>
  )
}

function TrendChart({ trend }) {
  const canvasRef = useRef(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !trend?.length) return
    const ctx = canvas.getContext('2d')
    const w = canvas.width
    const h = canvas.height
    const pad = 6
    ctx.clearRect(0, 0, w, h)
    const maxVal = Math.max(...trend.map((t) => t.success + t.warning + t.failed), 1)
    const step = (w - pad * 2) / trend.length
    const bw = Math.max(step - 2, 3)
    trend.forEach((t, i) => {
      const x = pad + i * step
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
      <div style={{ fontSize: 11, color: '#b8abd9', marginBottom: 6 }}>Jobs por intervalo</div>
      <canvas ref={canvasRef} width={560} height={90} style={{ width: '100%', height: 90 }} />
      <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
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
  const successRate = job.totalRuns ? Math.round((job.success / job.totalRuns) * 100) : 0
  const hasIssue = !!job.lastRootCause && ['failed', 'warning'].includes(job.lastResult)
  const ts = (v) => (v ? new Date(v).toLocaleString('es-MX') : '—')
  return (
    <>
      <tr onClick={() => onSelect(job)} style={{ cursor: 'pointer', background: selected ? 'rgba(139,92,246,0.08)' : 'transparent', borderBottom: hasIssue ? 'none' : '1px solid rgba(59,45,99,0.3)' }}>
        <td style={{ padding: '10px 12px', fontSize: 12, color: '#f3edff', fontWeight: 700 }}>{job.name}</td>
        <td style={{ padding: '10px 12px' }}><TypeBadge type={job.type} /></td>
        <td style={{ padding: '10px 12px' }}><ResultBadge result={job.lastResult} /></td>
        <td style={{ padding: '10px 12px', fontSize: 11, color: '#b8abd9', whiteSpace: 'nowrap' }}>{ts(job.lastRun)}</td>
        <td style={{ padding: '10px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, minWidth: 80, background: 'rgba(255,255,255,0.06)', borderRadius: 999, height: 6, overflow: 'hidden' }}>
              <div style={{ width: `${successRate}%`, height: '100%', background: successRate >= 80 ? '#22c55e' : successRate >= 50 ? '#f59e0b' : '#ef4444' }} />
            </div>
            <span style={{ fontSize: 11, color: '#b8abd9', minWidth: 32 }}>{successRate}%</span>
          </div>
        </td>
        <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: '#b8abd9' }}>{job.totalRuns}</td>
      </tr>
      {hasIssue && (
        <tr style={{ borderBottom: '1px solid rgba(59,45,99,0.3)', background: 'rgba(239,68,68,0.05)' }}>
          <td colSpan={6} style={{ padding: '0 12px 10px 18px' }}>
            <span style={{ fontSize: 11, color: '#f3edff' }}>{job.lastRootCause}</span>
          </td>
        </tr>
      )}
    </>
  )
}

function JobsTable({ title, rows, onSelect, selectedJob }) {
  return (
    <div style={{ background: 'rgba(23,17,41,0.92)', border: '1px solid #3b2d63', borderRadius: 16, padding: '16px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: '#f3edff' }}>{title}</div>
        <span style={{ fontSize: 11, color: '#b8abd9' }}>{rows.length} jobs</span>
      </div>
      {!rows.length ? (
        <div style={{ color: '#b8abd9', fontSize: 13 }}>Sin jobs en esta categoría.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #3b2d63' }}>
                {['Nombre', 'Tipo', 'Último resultado', 'Última ejecución', 'Tasa éxito', 'Ejecuciones'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, color: '#b8abd9' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((job) => (
                <JobRow key={job.name} job={job} onSelect={onSelect} selected={selectedJob?.name === job.name} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function JobHistoryPanel({ job, history, onClose }) {
  const ts = (v) => (v ? new Date(v).toLocaleString('es-MX') : '—')
  return (
    <div style={{ background: 'rgba(23,17,41,0.98)', border: '1px solid #3b2d63', borderRadius: 16, padding: '16px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#f3edff', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>{job.name}</span>
            <TypeBadge type={job.type} />
          </div>
          <div style={{ fontSize: 11, color: '#b8abd9', marginTop: 4 }}>Historial de ejecuciones del job</div>
        </div>
        <button className='btn btnSecondary' style={{ fontSize: 12, padding: '4px 10px' }} onClick={onClose}>✕ Cerrar</button>
      </div>
      {!history?.length ? (
        <div style={{ color: '#b8abd9', fontSize: 13 }}>Sin historial disponible.</div>
      ) : (
        <div style={{ overflowX: 'auto', maxHeight: 340, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #3b2d63' }}>
                {['Fecha', 'Tipo', 'Resultado', 'Código', 'Mensaje'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 10px', fontSize: 11, color: '#b8abd9' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.map((r, i) => (
                <React.Fragment key={i}>
                  <tr style={{ borderBottom: r.rootCause && ['failed', 'warning'].includes(r.result) ? 'none' : '1px solid rgba(59,45,99,0.3)' }}>
                    <td style={{ padding: '8px 10px', fontSize: 11, color: '#b8abd9', whiteSpace: 'nowrap' }}>{ts(r.timestamp)}</td>
                    <td style={{ padding: '8px 10px' }}><TypeBadge type={r.jobType} /></td>
                    <td style={{ padding: '8px 10px' }}><ResultBadge result={r.result} /></td>
                    <td style={{ padding: '8px 10px', fontSize: 11, color: '#b8abd9' }}>{r.eventCode || '—'}</td>
                    <td style={{ padding: '8px 10px', fontSize: 11, color: '#f3edff' }}>{r.summary || r.message || '—'}</td>
                  </tr>
                  {r.rootCause && ['failed', 'warning'].includes(r.result) && (
                    <tr style={{ borderBottom: '1px solid rgba(59,45,99,0.3)', background: 'rgba(239,68,68,0.05)' }}>
                      <td />
                      <td colSpan={4} style={{ padding: '0 10px 8px' }}>
                        <span style={{ fontSize: 11, color: RESULT_COLORS[r.result] }}>{r.rootCause}</span>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function RecentEventsTable({ rows }) {
  const ts = (v) => (v ? new Date(v).toLocaleString('es-MX') : '—')
  return (
    <div style={{ background: 'rgba(23,17,41,0.92)', border: '1px solid #3b2d63', borderRadius: 16, padding: '16px 20px' }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: '#f3edff', marginBottom: 14 }}>Eventos recientes del canal Veeam Backup</div>
      {!rows?.length ? (
        <div style={{ color: '#b8abd9', fontSize: 13 }}>Sin eventos recientes.</div>
      ) : (
        <div style={{ overflowX: 'auto', maxHeight: 340, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #3b2d63' }}>
                {['Fecha', 'Tipo', 'Resultado', 'Código', 'Job', 'Mensaje'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 10px', fontSize: 11, color: '#b8abd9' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((e, i) => (
                <tr key={i} style={{ borderBottom: '1px solid rgba(59,45,99,0.3)' }}>
                  <td style={{ padding: '8px 10px', fontSize: 11, color: '#b8abd9', whiteSpace: 'nowrap' }}>{ts(e.timestamp)}</td>
                  <td style={{ padding: '8px 10px' }}><TypeBadge type={e.jobType} /></td>
                  <td style={{ padding: '8px 10px' }}><ResultBadge result={e.result} /></td>
                  <td style={{ padding: '8px 10px', fontSize: 11, color: '#b8abd9' }}>{e.eventCode}</td>
                  <td style={{ padding: '8px 10px', fontSize: 12, color: '#f3edff' }}>{e.jobName || '—'}</td>
                  <td style={{ padding: '8px 10px', fontSize: 11, color: '#b8abd9' }}>{e.summary || e.message || '—'}</td>
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
  const [jobsData, setJobsData] = useState({ all: [], normal: [], copy: [] })
  const [selectedJob, setSelectedJob] = useState(null)
  const [jobHistory, setJobHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [hours, setHours] = useState(24)
  const [lastRefresh, setLastRefresh] = useState(null)
  const refreshTimer = useRef(null)
  const isFetching = useRef(false)

  const clearSession = useCallback(() => {
    localStorage.removeItem('token')
    localStorage.removeItem('refresh_token')
    router.replace('/login')
  }, [router])

  const apiGet = useCallback(async (url) => {
    const token = localStorage.getItem('token')
    if (!token) {
      clearSession()
      return null
    }
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (res.status === 401) {
      clearSession()
      return null
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || `Error ${res.status}`)
    }
    return res.json()
  }, [clearSession])

  const loadAll = useCallback(async (assetId, h) => {
    if (!assetId) return
    const [ov, jl] = await Promise.all([
      apiGet(`/api/assets/${assetId}/veeam/overview?hours=${h}`),
      apiGet(`/api/assets/${assetId}/veeam/jobs?days=7`),
    ])
    if (ov) setOverview(ov)
    if (jl) setJobsData(jl)
    setLastRefresh(new Date())
  }, [apiGet])

  const loadSilent = useCallback(async (assetId, h) => {
    if (!assetId || isFetching.current) return
    isFetching.current = true
    try {
      const ov = await apiGet(`/api/assets/${assetId}/veeam/overview?hours=${h}`)
      if (ov) setOverview(ov)
      setLastRefresh(new Date())
    } finally {
      isFetching.current = false
    }
  }, [apiGet])

  useEffect(() => {
    if (!id) return
    setLoading(true)
    apiGet(`/api/assets/${id}`)
      .then(async (a) => {
        setAsset(a)
        await loadAll(id, hours)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [id, hours, apiGet, loadAll])

  useEffect(() => {
    if (!id) return
    if (refreshTimer.current) clearInterval(refreshTimer.current)
    refreshTimer.current = setInterval(() => loadSilent(id, hours), 10000)
    return () => refreshTimer.current && clearInterval(refreshTimer.current)
  }, [id, hours, loadSilent])

  const handleSelectJob = async (job) => {
    if (selectedJob?.name === job.name) {
      setSelectedJob(null)
      return
    }
    setSelectedJob(job)
    setLoadingHistory(true)
    try {
      const history = await apiGet(`/api/assets/${id}/veeam/jobs/${encodeURIComponent(job.name)}/history?days=7`)
      setJobHistory(history || [])
    } catch {
      setJobHistory([])
    } finally {
      setLoadingHistory(false)
    }
  }

  const handleHoursChange = async (value) => {
    setHours(value)
    await loadAll(id, value)
  }

  const kpis = overview?.kpis || {}
  const healthScore = kpis.total ? Math.round((kpis.success / kpis.total) * 100) : null
  const healthColor = healthScore == null ? '#6b7280' : healthScore >= 90 ? '#22c55e' : healthScore >= 70 ? '#f59e0b' : '#ef4444'
  const normalRows = jobsData?.normal || []
  const copyRows = jobsData?.copy || []
  const allRows = jobsData?.all || []
  const ts = (v) => (v ? new Date(v).toLocaleString('es-MX') : '—')

  const alertText = useMemo(() => {
    const failedCopy = overview?.copyStats?.failedJobs || 0
    const failedNormal = overview?.normalStats?.failedJobs || 0
    if (failedCopy > 0) return `${failedCopy} backup copy job(s) fallidos hacia provider en la última ventana.`
    if (failedNormal > 0) return `${failedNormal} backup job(s) fallidos en la última ventana.`
    return ''
  }, [overview])

  if (loading) return <AppShell title='Veeam Jobs'><div className='card cardPad'><p className='muted'>Cargando...</p></div></AppShell>
  if (!asset) return <AppShell title='No encontrado'><div className='card cardPad'><div className='errorBox'>Activo no encontrado.</div></div></AppShell>

  return (
    <AppShell
      title={`Veeam Jobs — ${asset.display_name || asset.host_name}`}
      subtitle={`${asset.os_name || ''} · ${asset.agent_version || ''}`}
      actions={
        <div style={{ display: 'flex', gap: 8 }}>
          <button className='btn btnSecondary' onClick={() => router.push(`/assets/${id}`)}>← Activo</button>
          <button className='btn btnSecondary' onClick={() => router.push('/assets')}>Activos</button>
        </div>
      }
    >
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.25}}`}</style>

      <div style={{ background: 'rgba(23,17,41,0.92)', border: '1px solid #3b2d63', borderRadius: 16, padding: '16px 20px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', border: `3px solid ${healthColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: healthColor }}>{healthScore != null ? `${healthScore}%` : '—'}</span>
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#f3edff' }}>Estado general de jobs Veeam</div>
              <div style={{ fontSize: 11, color: '#b8abd9' }}>Separación entre jobs normales y backup copy jobs enviados al provider</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <KpiBox label='Exitosos' value={kpis.success} color='#22c55e' />
            <KpiBox label='Advertencias' value={kpis.warning} color='#f59e0b' />
            <KpiBox label='Fallidos' value={kpis.failed} color='#ef4444' />
            <KpiBox label='Total eventos' value={kpis.total} color='#8b5cf6' />
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {[24, 48, 168].map((h) => (
                <button key={h} onClick={() => handleHoursChange(h)} style={{ background: hours === h ? 'rgba(139,92,246,0.25)' : 'rgba(255,255,255,0.05)', border: `1px solid ${hours === h ? 'rgba(139,92,246,0.5)' : 'rgba(59,45,99,0.5)'}`, borderRadius: 8, padding: '4px 10px', fontSize: 12, color: hours === h ? '#c4b5fd' : '#b8abd9', cursor: 'pointer' }}>
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
        </div>
      </div>

      {!!alertText && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: 14, padding: '14px 16px', color: '#fecaca', fontSize: 13, marginBottom: 16 }}>
          {alertText}
        </div>
      )}

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
        <SummaryBand title='Backup Jobs normales' stats={overview?.normalStats} accent='#8b5cf6' />
        <SummaryBand title='Backup Copy Jobs / Provider' stats={overview?.copyStats} accent='#38bdf8' />
      </div>

      {overview?.trend?.length > 0 && (
        <div style={{ background: 'rgba(23,17,41,0.92)', border: '1px solid #3b2d63', borderRadius: 16, padding: '16px 20px', marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#f3edff', marginBottom: 12 }}>Tendencia de ejecuciones</div>
          <TrendChart trend={overview.trend} />
        </div>
      )}

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', marginBottom: 16 }}>
        <JobsTable title='Backup Jobs normales' rows={normalRows} onSelect={handleSelectJob} selectedJob={selectedJob} />
        <JobsTable title='Backup Copy Jobs / Provider' rows={copyRows} onSelect={handleSelectJob} selectedJob={selectedJob} />
      </div>

      <div style={{ marginBottom: 16 }}>
        <JobsTable title='Todos los jobs detectados' rows={allRows} onSelect={handleSelectJob} selectedJob={selectedJob} />
      </div>

      {selectedJob && (
        <div style={{ marginBottom: 16 }}>
          {loadingHistory ? (
            <div className='card cardPad'><p className='muted'>Cargando historial...</p></div>
          ) : (
            <JobHistoryPanel job={selectedJob} history={jobHistory} onClose={() => setSelectedJob(null)} />
          )}
        </div>
      )}

      <RecentEventsTable rows={overview?.recentEvents || []} />

      {(overview?.lastSuccess || overview?.lastFailed || overview?.lastWarning) && (
        <div style={{ background: 'rgba(23,17,41,0.92)', border: '1px solid #3b2d63', borderRadius: 16, padding: '16px 20px', marginTop: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#f3edff', marginBottom: 12 }}>Últimos estados relevantes</div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {overview?.lastSuccess && <div style={{ flex: 1, minWidth: 240, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 12, padding: 12 }}><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><strong style={{ color: '#86efac', fontSize: 13 }}>Último éxito</strong><TypeBadge type={overview.lastSuccess.jobType} /></div><div style={{ fontSize: 11, color: '#b8abd9' }}>{ts(overview.lastSuccess.timestamp)}</div><div style={{ fontSize: 12, color: '#f3edff', marginTop: 6 }}>{overview.lastSuccess.jobName || overview.lastSuccess.summary || overview.lastSuccess.message}</div></div>}
            {overview?.lastWarning && <div style={{ flex: 1, minWidth: 240, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 12, padding: 12 }}><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><strong style={{ color: '#fcd34d', fontSize: 13 }}>Última advertencia</strong><TypeBadge type={overview.lastWarning.jobType} /></div><div style={{ fontSize: 11, color: '#b8abd9' }}>{ts(overview.lastWarning.timestamp)}</div><div style={{ fontSize: 12, color: '#f3edff', marginTop: 6 }}>{overview.lastWarning.jobName || overview.lastWarning.summary || overview.lastWarning.message}</div></div>}
            {overview?.lastFailed && <div style={{ flex: 1, minWidth: 240, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, padding: 12 }}><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><strong style={{ color: '#fca5a5', fontSize: 13 }}>Último fallo</strong><TypeBadge type={overview.lastFailed.jobType} /></div><div style={{ fontSize: 11, color: '#b8abd9' }}>{ts(overview.lastFailed.timestamp)}</div><div style={{ fontSize: 12, color: '#f3edff', marginTop: 6 }}>{overview.lastFailed.jobName || overview.lastFailed.summary || overview.lastFailed.message}</div></div>}
          </div>
        </div>
      )}
    </AppShell>
  )
}
