import { useRouter } from 'next/router'
import { useCallback, useEffect, useRef, useState } from 'react'
import AppShell from '../../components/AppShell'

const TABS = {
  overview: 'Resumen',
  security: 'Seguridad',
  services: 'Servicios',
  events: 'Eventos',
}

function KpiCard({ label, value, tone = 'default' }) {
  const safeValue = value === null || value === undefined || value === '' ? '-' : value
  return (
    <div className={`card metricCard tone-${tone}`}>
      <div className="metricTitle">{label}</div>
      <div className="metricValue">{safeValue}</div>
    </div>
  )
}

function MiniBarList({ rows, emptyText = 'Sin datos' }) {
  if (!rows || rows.length === 0) return <div className="emptyState">{emptyText}</div>
  const max = Math.max(...rows.map(r => r.count || 0), 1)
  return (
    <div className="miniBarList">
      {rows.map(row => (
        <div className="miniBarRow" key={row.key}>
          <div className="miniBarTop">
            <span className="miniBarLabel">{row.key || '(vacío)'}</span>
            <span className="miniBarCount">{row.count}</span>
          </div>
          <div className="miniBarTrack">
            <div className="miniBarFill" style={{ width: `${(row.count / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function DataTable({ columns, rows, emptyText = 'Sin datos', limit = null }) {
  const [expanded, setExpanded] = useState(false)
  if (!rows || rows.length === 0) return <div className="emptyState">{emptyText}</div>
  const displayed = limit && !expanded ? rows.slice(0, limit) : rows
  const fmt = v => (v === null || v === undefined || v === '' ? '-' : v)
  return (
    <div className="table-wrapp">
      <table className="table">
        <thead><tr>{columns.map(c => <th key={c.key}>{c.label}</th>)}</tr></thead>
        <tbody>
          {displayed.map((row, i) => (
            <tr key={row.id || row.timestamp || i}>
              {columns.map(c => <td key={c.key}>{fmt(row[c.key])}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      {limit && rows.length > limit && (
        <button className="btn btnSecondary" style={{ marginTop: 8, fontSize: 12 }} onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Ver menos' : `Ver todos (${rows.length})`}
        </button>
      )}
    </div>
  )
}

function ExportModal({ assetId, assetName, osType, onClose, apiGet }) {
  const today = new Date().toISOString().split('T')[0]
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const [from, setFrom] = useState(weekAgo)
  const [to, setTo] = useState(today)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleExport = async () => {
    setLoading(true); setError('')
    try {
      const fromISO = new Date(from + 'T00:00:00').toISOString()
      const toISO = new Date(to + 'T23:59:59').toISOString()
      const data = await apiGet(`/api/assets/${assetId}/observability/security/export?from=${encodeURIComponent(fromISO)}&to=${encodeURIComponent(toISO)}`)
      if (!data) return
      generatePDF(data, assetName || assetId, from, to, osType)
      onClose()
    } catch (e) { setError(e.message || 'Error generando reporte') } finally { setLoading(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card cardPad" style={{ width: 400, maxWidth: '90vw' }}>
        <div className="sectionTitle" style={{ marginBottom: 16 }}>Exportar reporte de seguridad</div>
        <div className="formGroup" style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Desde</label>
          <input type="date" className="input" value={from} onChange={e => setFrom(e.target.value)} style={{ width: '100%' }} />
        </div>
        <div className="formGroup" style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Hasta</label>
          <input type="date" className="input" value={to} onChange={e => setTo(e.target.value)} style={{ width: '100%' }} />
        </div>
        {error && <div className="errorBox" style={{ marginBottom: 12 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btnSecondary" onClick={onClose} disabled={loading}>Cancelar</button>
          <button className="btn btnPrimary" onClick={handleExport} disabled={loading}>{loading ? 'Generando...' : 'Descargar PDF'}</button>
        </div>
      </div>
    </div>
  )
}

function generatePDF(data, assetName, from, to, osType) {
  const fmt = v => (v === null || v === undefined || v === '' ? '-' : v)
  const ts = v => v ? new Date(v).toLocaleString('es-MX') : '-'
  const tableHtml = (columns, rows) => {
    if (!rows?.length) return '<p style="color:#888;font-size:12px">Sin datos en el período.</p>'
    return `<table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:8px"><thead><tr>${columns.map(c => `<th style="background:#1e2235;color:#a0aec0;padding:6px 8px;text-align:left;border-bottom:1px solid #2d3748">${c.label}</th>`).join('')}</tr></thead><tbody>${rows.map((row, i) => `<tr style="background:${i % 2 === 0 ? '#0f1117' : '#141824'}">${columns.map(c => `<td style="padding:5px 8px;border-bottom:1px solid #1e2235;color:#e2e8f0">${fmt(c.key === 'timestamp' ? ts(row[c.key]) : row[c.key])}</td>`).join('')}</tr>`).join('')}</tbody></table>`
  }
  const kpiBox = (label, value, color) => `<div style="background:#1e2235;border-radius:8px;padding:12px 16px;min-width:100px;text-align:center"><div style="font-size:11px;color:#a0aec0;margin-bottom:4px">${label}</div><div style="font-size:22px;font-weight:700;color:${color}">${fmt(value)}</div></div>`
  const section = (title, content) => `<div style="margin-bottom:24px"><div style="font-size:13px;font-weight:600;color:#7c8cff;border-bottom:1px solid #2d3748;padding-bottom:6px;margin-bottom:12px">${title}</div>${content}</div>`

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Reporte de Seguridad - ${assetName}</title><style>body{font-family:'Segoe UI',Arial,sans-serif;background:#0a0d14;color:#e2e8f0;margin:0;padding:32px}@media print{body{padding:16px}}</style></head><body>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;border-bottom:2px solid #2d3748;padding-bottom:24px">
    <div><div style="font-size:24px;font-weight:700;color:#7c8cff">Hyperox</div><div style="font-size:12px;color:#a0aec0">Panel de Observabilidad</div></div>
    <div style="text-align:right"><div style="font-size:18px;font-weight:600">Reporte de Seguridad</div><div style="font-size:12px;color:#a0aec0;margin-top:4px">${assetName} &bull; ${from} → ${to}</div><div style="font-size:11px;color:#a0aec0;margin-top:2px">Generado: ${new Date().toLocaleString('es-MX')}</div></div>
  </div>
  ${section('Resumen ejecutivo', `<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px">
    ${kpiBox('Logons exitosos', data.kpis?.successLogons ?? data.kpis?.successLogons24h ?? 0, '#48bb78')}
    ${kpiBox('Logons fallidos', data.kpis?.failedLogons ?? data.kpis?.failedLogons24h ?? 0, '#fc8181')}
    ${kpiBox('Bloqueos', data.kpis?.lockouts ?? data.kpis?.lockouts24h ?? 0, '#f6ad55')}
    ${kpiBox('Privilegios', data.kpis?.privilegeEvents ?? data.kpis?.privilegeEvents24h ?? 0, '#f6ad55')}
    ${kpiBox('Cambios usuario', data.kpis?.userChanges ?? data.kpis?.userChanges24h ?? 0, '#63b3ed')}
    ${kpiBox('Accesos remotos', data.kpis?.remoteAccess ?? data.kpis?.remoteAccess24h ?? 0, '#63b3ed')}
  </div>`)}}
  ${section('Fallos por usuario', tableHtml([{ key: 'key', label: 'Usuario' }, { key: 'count', label: 'Intentos' }], data.failuresByUser))}
  ${section('Fallos por IP', tableHtml([{ key: 'key', label: 'IP' }, { key: 'count', label: 'Intentos' }], data.failuresByIp))}
  ${section('Logons exitosos', tableHtml([{ key: 'timestamp', label: 'Fecha' }, { key: 'user', label: 'Usuario' }, { key: 'sourceIp', label: 'IP' }, { key: 'message', label: 'Mensaje' }], data.recentSuccess))}
  ${section('Logons fallidos', tableHtml([{ key: 'timestamp', label: 'Fecha' }, { key: 'user', label: 'Usuario' }, { key: 'sourceIp', label: 'IP' }, { key: 'message', label: 'Mensaje' }], data.recentFailed))}
  </body></html>`

  const win = window.open('', '_blank')
  if (win) { win.document.write(html); win.document.close(); setTimeout(() => win.print(), 600) }
}

export default function AssetDetailPage() {
  const router = useRouter()
  const { id } = router.query
  const [asset, setAsset] = useState(null)
  const [tab, setTab] = useState('overview')
  const [tabData, setTabData] = useState({})
  const [loadingTab, setLoadingTab] = useState(false)
  const [loadingAsset, setLoadingAsset] = useState(true)
  const [error, setError] = useState('')
  const [showExport, setShowExport] = useState(false)
  const loadedTabs = useRef(new Set())

  const clearSession = useCallback(() => {
    localStorage.removeItem('token'); localStorage.removeItem('refresh_token'); router.replace('/login')
  }, [router])

  const apiGet = useCallback(async (url) => {
    const token = localStorage.getItem('token')
    if (!token) { clearSession(); return null }
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (res.status === 401) { clearSession(); return null }
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || `Error ${res.status}`) }
    return res.json()
  }, [clearSession])

  useEffect(() => {
    if (!id) return
    setLoadingAsset(true)
    apiGet(`/api/assets/${id}`).then(data => { setAsset(data); setLoadingAsset(false) }).catch(e => { setError(e.message); setLoadingAsset(false) })
  }, [id, apiGet])

  const loadTab = useCallback(async (t) => {
    if (!id || loadedTabs.current.has(t)) return
    setLoadingTab(true)
    try {
      const data = await apiGet(`/api/assets/${id}/observability/${t}`)
      setTabData(prev => ({ ...prev, [t]: data }))
      loadedTabs.current.add(t)
    } catch (e) {
      setTabData(prev => ({ ...prev, [t]: { enabled: false, reason: e.message } }))
    } finally {
      setLoadingTab(false)
    }
  }, [id, apiGet])

  useEffect(() => {
    if (asset) { loadedTabs.current.clear(); loadTab(tab) }
  }, [asset, tab, loadTab])

  const handleTabChange = (t) => { setTab(t); loadTab(t) }

  if (loadingAsset) return <AppShell title="Cargando..."><div className="card cardPad"><p className="muted">Cargando activo...</p></div></AppShell>
  if (!asset) return <AppShell title="No encontrado"><div className="card cardPad"><div className="errorBox">Activo no encontrado o sin acceso.</div></div></AppShell>

  const osType = asset.os_type
  const d = tabData[tab] || {}
  const ts = v => v ? new Date(v).toLocaleString('es-MX') : '-'

  return (
    <AppShell
      title={asset.display_name || asset.host_name || 'Activo'}
      subtitle={`${osType || 'OS desconocido'} · ${asset.fleet_policy_name || 'Sin política'} · ${asset.agent_status || '—'}`}
      actions={
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btnSecondary" onClick={() => router.push('/assets')}>← Activos</button>
          {asset.kibana_base_url && (
            <a className="btn btnSecondary" href={asset.kibana_base_url} target="_blank" rel="noreferrer">Kibana ↗</a>
          )}
        </div>
      }
    >
      {/* Info del activo */}
      <div className="infoGrid compactInfoGrid" style={{ marginBottom: 20 }}>
        {[
          { label: 'FLEET AGENT ID', value: asset.fleet_agent_id ? asset.fleet_agent_id.slice(0, 16) + '...' : '—' },
          { label: 'HOST NAME', value: asset.host_name || '—' },
          { label: 'STATUS', value: asset.agent_status || '—' },
          { label: 'OS', value: asset.os_name || asset.os_type || '—' },
          { label: 'VERSIÓN AGENTE', value: asset.agent_version || '—' },
          { label: 'ÚLTIMO CHECK-IN', value: ts(asset.last_checkin_at) },
          { label: 'POLÍTICA', value: asset.fleet_policy_name || '—' },
          { label: 'IPs', value: (asset.ip_addresses || []).slice(0, 2).join(', ') || '—' },
        ].map(i => (
          <div key={i.label} className="infoItem">
            <div className="infoLabel">{i.label}</div>
            <div className="infoValue" style={{ fontSize: 13 }}>{i.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="tabBar">
        {Object.entries(TABS).map(([k, v]) => (
          <button key={k} className={`tabBtn ${tab === k ? 'active' : ''}`} onClick={() => handleTabChange(k)}>{v}</button>
        ))}
        {tab === 'security' && asset.observability_enabled && (
          <button className="btn btnSecondary" style={{ marginLeft: 'auto' }} onClick={() => setShowExport(true)}>
            Exportar PDF
          </button>
        )}
      </div>

      {showExport && (
        <ExportModal
          assetId={id}
          assetName={asset.display_name || asset.host_name}
          osType={osType}
          onClose={() => setShowExport(false)}
          apiGet={apiGet}
        />
      )}

      {loadingTab && <div className="card cardPad" style={{ marginBottom: 16 }}><p className="muted">Cargando datos...</p></div>}

      {!loadingTab && d.enabled === false && (
        <div className="card cardPad">
          <div className="emptyState">{d.reason || 'Observabilidad no disponible para este activo.'}</div>
        </div>
      )}

      {!loadingTab && d.enabled !== false && tab === 'overview' && (
        <>
          <div className="metricGrid" style={{ marginBottom: 20 }}>
            <KpiCard label="CPU promedio 24h" value={d.cpuAvgPct != null ? `${d.cpuAvgPct}%` : null} tone={d.cpuAvgPct > 80 ? 'danger' : d.cpuAvgPct > 60 ? 'warning' : 'success'} />
            <KpiCard label="Memoria usada" value={d.memoryUsedPct != null ? `${d.memoryUsedPct}%` : null} tone={d.memoryUsedPct > 85 ? 'danger' : 'default'} />
            <KpiCard label="Disco máx" value={d.diskUsedPct != null ? `${d.diskUsedPct}%` : null} tone={d.diskUsedPct > 90 ? 'danger' : 'default'} />
            <KpiCard label="Errores 24h" value={d.errorCount24h} tone={d.errorCount24h > 0 ? 'warning' : 'default'} />
          </div>
          <div className="card cardPad">
            <div className="sectionTitle" style={{ marginBottom: 12 }}>Último visto</div>
            <p className="muted">{ts(d.lastSeen)}</p>
            {d.recentErrors?.length > 0 && (
              <>
                <div className="sectionTitle" style={{ margin: '16px 0 12px' }}>Errores recientes</div>
                <DataTable
                  columns={[
                    { key: 'timestamp', label: 'Fecha' },
                    { key: 'level', label: 'Nivel' },
                    { key: 'dataset', label: 'Dataset' },
                    { key: 'message', label: 'Mensaje' },
                  ]}
                  rows={(d.recentErrors || []).map(r => ({ ...r, timestamp: ts(r.timestamp) }))}
                  limit={5}
                />
              </>
            )}
          </div>
        </>
      )}

      {!loadingTab && d.enabled !== false && tab === 'security' && d.kpis && (
        <>
          <div className="metricGrid" style={{ marginBottom: 20 }}>
            <KpiCard label="Logons exitosos" value={d.kpis.successLogons24h} tone="success" />
            <KpiCard label="Logons fallidos" value={d.kpis.failedLogons24h} tone={d.kpis.failedLogons24h > 0 ? 'danger' : 'default'} />
            <KpiCard label="Bloqueos" value={d.kpis.lockouts24h} tone={d.kpis.lockouts24h > 0 ? 'danger' : 'default'} />
            <KpiCard label="Eventos privilegio" value={d.kpis.privilegeEvents24h} tone={d.kpis.privilegeEvents24h > 0 ? 'warning' : 'default'} />
          </div>
          <div className="nativeGridTwo" style={{ marginBottom: 20 }}>
            <div className="card cardPad">
              <div className="sectionTitle" style={{ marginBottom: 12 }}>Fallos por usuario</div>
              <MiniBarList rows={d.failuresByUser} />
            </div>
            <div className="card cardPad">
              <div className="sectionTitle" style={{ marginBottom: 12 }}>Fallos por IP</div>
              <MiniBarList rows={d.failuresByIp} />
            </div>
          </div>
          <div className="card cardPad" style={{ marginBottom: 16 }}>
            <div className="sectionTitle" style={{ marginBottom: 12 }}>Logons fallidos recientes</div>
            <DataTable
              columns={[
                { key: 'timestamp', label: 'Fecha' },
                { key: 'user', label: 'Usuario' },
                { key: 'sourceIp', label: 'IP' },
                { key: 'message', label: 'Mensaje' },
              ]}
              rows={(d.recentFailed || []).map(r => ({ ...r, timestamp: ts(r.timestamp) }))}
              limit={5}
            />
          </div>
          <div className="card cardPad">
            <div className="sectionTitle" style={{ marginBottom: 12 }}>Logons exitosos recientes</div>
            <DataTable
              columns={[
                { key: 'timestamp', label: 'Fecha' },
                { key: 'user', label: 'Usuario' },
                { key: 'sourceIp', label: 'IP' },
                { key: 'logonType', label: 'Tipo' },
              ]}
              rows={(d.recentSuccess || []).map(r => ({ ...r, timestamp: ts(r.timestamp) }))}
              limit={5}
            />
          </div>
        </>
      )}

      {!loadingTab && d.enabled !== false && tab === 'services' && d.rows && (
        <div className="card cardPad">
          {d.rows.length === 0 ? (
            <div className="emptyState">Sin servicios detectados en las últimas 24h.</div>
          ) : (
            <DataTable
              columns={[
                { key: 'serviceName', label: 'Servicio' },
                { key: 'familyLabel', label: 'Familia' },
                { key: 'state', label: 'Estado' },
                { key: 'timestamp', label: 'Última telemetría' },
              ]}
              rows={(d.rows || []).map(r => ({ ...r, timestamp: ts(r.timestamp) }))}
            />
          )}
        </div>
      )}

      {!loadingTab && d.enabled !== false && tab === 'events' && (
        <div className="card cardPad">
          <DataTable
            columns={[
              { key: 'timestamp', label: 'Fecha' },
              { key: 'channel', label: 'Canal/Dataset' },
              { key: 'level', label: 'Nivel' },
              { key: 'action', label: 'Acción' },
              { key: 'processName', label: 'Proceso' },
              { key: 'message', label: 'Mensaje' },
            ]}
            rows={((d.rows || d) || []).map(r => ({ ...r, timestamp: ts(r.timestamp) }))}
            limit={20}
          />
        </div>
      )}
    </AppShell>
  )
}
