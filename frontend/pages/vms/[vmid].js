import { useRouter } from 'next/router'
import { useEffect, useMemo, useRef, useState } from 'react'
import AppShell from '../../components/AppShell'

const WINDOWS_TABS = {
  overview: 'Resumen',
  sql: 'SQL',
  security: 'Seguridad',
  services: 'Servicios',
  events: 'Eventos',
  audit: 'Auditoría'
}

function KpiCard({ label, value, tone = 'default' }) {
  return (
    <div className={`card metricCard tone-${tone}`}>
      <div className="metricTitle">{label}</div>
      <div className="metricValue">{value ?? '-'}</div>
    </div>
  )
}

function MiniBarList({ rows, emptyText = 'Sin datos' }) {
  if (!rows || rows.length === 0) return <div className="emptyState">{emptyText}</div>
  const max = Math.max(...rows.map((row) => row.count || 0), 1)
  return (
    <div className="miniBarList">
      {rows.map((row) => (
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
  return (
    <div className="table-wrapp">
      <table className="table">
        <thead>
          <tr>{columns.map((c) => <th key={c.key}>{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {displayed.map((row, i) => (
            <tr key={row.id || row.timestamp || i}>
              {columns.map((c) => <td key={c.key}>{row[c.key] || '-'}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      {limit && rows.length > limit && (
        <button
          className="btn btnSecondary"
          style={{ marginTop: 8, fontSize: 12 }}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? 'Ver menos' : `Ver todos (${rows.length})`}
        </button>
      )}
    </div>
  )
}

function ExportModal({ vmid, vmName, onClose, apiGet }) {
  const today = new Date().toISOString().split('T')[0]
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const [from, setFrom] = useState(weekAgo)
  const [to, setTo] = useState(today)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleExport = async () => {
    setLoading(true)
    setError('')
    try {
      const fromISO = new Date(from + 'T00:00:00').toISOString()
      const toISO = new Date(to + 'T23:59:59').toISOString()
      const data = await apiGet(`/api/vms/${vmid}/observability/security/export?from=${encodeURIComponent(fromISO)}&to=${encodeURIComponent(toISO)}`)
      if (!data) return
      generatePDF(data, vmName, from, to)
      onClose()
    } catch (e) {
      setError(e.message || 'Error generando reporte')
    } finally {
      setLoading(false)
    }
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
          <button className="btn btnPrimary" onClick={handleExport} disabled={loading}>
            {loading ? 'Generando...' : 'Descargar PDF'}
          </button>
        </div>
      </div>
    </div>
  )
}

function generatePDF(data, vmName, from, to) {
  const fmt = (v) => v || '-'
  const ts = (v) => v ? new Date(v).toLocaleString('es-MX') : '-'

  const tableHtml = (columns, rows) => {
    if (!rows || !rows.length) return '<p style="color:#888;font-size:12px">Sin datos en el período.</p>'
    return `<table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:8px">
      <thead><tr>${columns.map(c => `<th style="background:#1e2235;color:#a0aec0;padding:6px 8px;text-align:left;border-bottom:1px solid #2d3748">${c.label}</th>`).join('')}</tr></thead>
      <tbody>${rows.map((row, i) => `<tr style="background:${i % 2 === 0 ? '#0f1117' : '#141824'}">${columns.map(c => `<td style="padding:5px 8px;border-bottom:1px solid #1e2235;color:#e2e8f0">${fmt(c.key === 'timestamp' ? ts(row[c.key]) : row[c.key])}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>`
  }

  const kpiBox = (label, value, color) =>
    `<div style="background:#1e2235;border-radius:8px;padding:12px 16px;min-width:100px;text-align:center">
      <div style="font-size:11px;color:#a0aec0;margin-bottom:4px">${label}</div>
      <div style="font-size:22px;font-weight:700;color:${color}">${value}</div>
    </div>`

  const section = (title, content) =>
    `<div style="margin-bottom:24px">
      <div style="font-size:13px;font-weight:600;color:#7c8cff;border-bottom:1px solid #2d3748;padding-bottom:6px;margin-bottom:12px">${title}</div>
      ${content}
    </div>`

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
  <title>Reporte de Seguridad - ${vmName}</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #0a0d14; color: #e2e8f0; margin: 0; padding: 32px; }
    @media print { body { padding: 16px; } }
  </style>
  </head><body>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;border-bottom:2px solid #2d3748;padding-bottom:24px">
    <div>
      <div style="font-size:24px;font-weight:700;color:#7c8cff">Hyperox</div>
      <div style="font-size:12px;color:#a0aec0;margin-top:2px">VM Panel / SIEM Ready</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:18px;font-weight:600">Reporte de Seguridad</div>
      <div style="font-size:12px;color:#a0aec0;margin-top:4px">${vmName} &bull; ${from} → ${to}</div>
      <div style="font-size:11px;color:#a0aec0;margin-top:2px">Generado: ${new Date().toLocaleString('es-MX')}</div>
    </div>
  </div>

  ${section('Resumen ejecutivo', `
    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px">
      ${kpiBox('Logons exitosos', data.kpis?.successLogons ?? 0, '#48bb78')}
      ${kpiBox('Logons fallidos', data.kpis?.failedLogons ?? 0, '#fc8181')}
      ${kpiBox('Bloqueos', data.kpis?.lockouts ?? 0, '#f6ad55')}
      ${kpiBox('Privilegios', data.kpis?.privilegeEvents ?? 0, '#f6ad55')}
      ${kpiBox('Cambios usuario', data.kpis?.userChanges ?? 0, '#63b3ed')}
      ${kpiBox('Accesos remotos', data.kpis?.remoteAccess ?? 0, '#63b3ed')}
    </div>
  `)}

  ${section('Fallos por usuario', tableHtml(
    [{ key: 'key', label: 'Usuario' }, { key: 'count', label: 'Intentos' }],
    data.failuresByUser
  ))}

  ${section('Fallos por IP', tableHtml(
    [{ key: 'key', label: 'IP' }, { key: 'count', label: 'Intentos' }],
    data.failuresByIp
  ))}

  ${section('Logons exitosos', tableHtml(
    [{ key: 'timestamp', label: 'Fecha' }, { key: 'user', label: 'Usuario' }, { key: 'sourceIp', label: 'IP' }, { key: 'logonType', label: 'Tipo' }, { key: 'message', label: 'Mensaje' }],
    data.recentSuccess
  ))}

  ${section('Logons fallidos', tableHtml(
    [{ key: 'timestamp', label: 'Fecha' }, { key: 'user', label: 'Usuario' }, { key: 'sourceIp', label: 'IP' }, { key: 'status', label: 'Status' }, { key: 'subStatus', label: 'SubStatus' }, { key: 'message', label: 'Mensaje' }],
    data.recentFailed
  ))}

  ${section('Eventos de privilegio', tableHtml(
    [{ key: 'timestamp', label: 'Fecha' }, { key: 'eventCode', label: 'Evento' }, { key: 'user', label: 'Usuario' }, { key: 'privilegeList', label: 'Privilegios' }],
    data.privilegeEvents
  ))}

  ${section('Cambios administrativos', tableHtml(
    [{ key: 'timestamp', label: 'Fecha' }, { key: 'eventCode', label: 'Evento' }, { key: 'targetUser', label: 'Usuario objetivo' }, { key: 'actorUser', label: 'Actor' }, { key: 'memberName', label: 'Miembro' }],
    data.userChanges
  ))}

  ${section('Accesos remotos (RDP / WinRM)', tableHtml(
    [{ key: 'timestamp', label: 'Fecha' }, { key: 'user', label: 'Usuario' }, { key: 'sourceIp', label: 'IP' }, { key: 'processName', label: 'Proceso' }, { key: 'logonType', label: 'Tipo' }],
    data.remoteAccess
  ))}

  <div style="margin-top:48px;border-top:1px solid #2d3748;padding-top:16px;font-size:11px;color:#4a5568;text-align:center">
    Reporte generado automáticamente por Hyperox Panel &bull; ${new Date().toLocaleString('es-MX')}
  </div>
  </body></html>`

  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const win = window.open(url, '_blank')
  if (win) {
    win.onload = () => {
      win.print()
      setTimeout(() => URL.revokeObjectURL(url), 5000)
    }
  }
}

export default function VmDetailPage() {
  const router = useRouter()
  const { vmid } = router.query
  const redirecting = useRef(false)

  const [sqlOverview, setSqlOverview] = useState(null)
  const [vm, setVm] = useState(null)
  const [tab, setTab] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [overview, setOverview] = useState(null)
  const [security, setSecurity] = useState(null)
  const [services, setServices] = useState(null)
  const [events, setEvents] = useState(null)
  const [auditRows, setAuditRows] = useState([])
  const [tabLoading, setTabLoading] = useState(false)
  const [tabError, setTabError] = useState('')
  const [showExport, setShowExport] = useState(false)

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null

  const apiGet = async (path) => {
    let activeToken = localStorage.getItem('token')
    if (!activeToken) {
      if (!redirecting.current) { redirecting.current = true; router.replace('/login') }
      return null
    }

    let res = await fetch(path, { headers: { Authorization: `Bearer ${activeToken}` } })

    if (res.status === 401) {
      const refreshToken = localStorage.getItem('refresh_token')
      if (refreshToken) {
        try {
          const refreshRes = await fetch('/api/auth/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: refreshToken })
          })
          if (refreshRes.ok) {
            const data = await refreshRes.json()
            localStorage.setItem('token', data.access_token)
            localStorage.setItem('refresh_token', data.refresh_token || '')
            res = await fetch(path, { headers: { Authorization: `Bearer ${data.access_token}` } })
          }
        } catch (_) {}
      }
    }

    if (res.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('refresh_token')
      if (!redirecting.current) { redirecting.current = true; router.replace('/login') }
      return null
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.message || 'Error consultando API')
    }

    return res.json()
  }

  const fetchVm = async () => {
    if (!vmid || !token) return
    try {
      setLoading(true); setError('')
      const data = await apiGet(`/api/vms/${vmid}`)
      if (data) setVm(data)
    } catch (err) {
      setError(err.message || 'No se pudo cargar la VM')
    } finally {
      setLoading(false)
    }
  }

  const fetchTabData = async () => {
    if (!vmid || !token) return
    if (tab === 'overview' && overview) return
    if (tab === 'sql' && sqlOverview) return
    if (tab === 'security' && security) return
    if (tab === 'services' && services) return
    if (tab === 'events' && events) return
    if (tab === 'audit' && auditRows.length) return
    try {
      setTabLoading(true); setTabError('')
      if (tab === 'overview') { const d = await apiGet(`/api/vms/${vmid}/observability/overview`); if (d) setOverview(d) }
      if (tab === 'sql') {
        const d = await apiGet(`/api/vms/${vmid}/observability/sql`)
        if (d) setSqlOverview(d)
      }
      if (tab === 'security') { const d = await apiGet(`/api/vms/${vmid}/observability/security`); if (d) setSecurity(d) }
      if (tab === 'services') { const d = await apiGet(`/api/vms/${vmid}/observability/services`); if (d) setServices(d) }
      if (tab === 'events') { const d = await apiGet(`/api/vms/${vmid}/observability/events`); if (d) setEvents(d) }
      if (tab === 'audit') { const d = await apiGet(`/api/vms/${vmid}/audit`); if (d) setAuditRows(d) }
    } catch (err) {
      setTabError(err.message || 'No se pudo cargar la vista')
    } finally {
      setTabLoading(false)
    }
  }

  useEffect(() => { fetchVm() }, [vmid])
  useEffect(() => { fetchTabData() }, [tab, vmid])

  const formatBytes = (value) => {
    const n = Number(value || 0)
    if (!n) return '-'
    return `${(n / 1024 / 1024 / 1024).toFixed(1)} GB`
  }

  const formatPct = (value) => {
    if (value === null || value === undefined) return '-'
    return `${Number(value).toFixed(1)}%`
  }

  const observability = vm?.observability || { enabled: false, services: [] }

  const secCols = {
    success: [{ key: 'timestamp', label: 'Fecha' }, { key: 'user', label: 'Usuario' }, { key: 'sourceIp', label: 'IP' }, { key: 'logonType', label: 'Tipo logon' }, { key: 'message', label: 'Mensaje' }],
    failed: [{ key: 'timestamp', label: 'Fecha' }, { key: 'user', label: 'Usuario' }, { key: 'sourceIp', label: 'IP' }, { key: 'status', label: 'Status' }, { key: 'subStatus', label: 'SubStatus' }, { key: 'message', label: 'Mensaje' }],
    privilege: [{ key: 'timestamp', label: 'Fecha' }, { key: 'eventCode', label: 'Evento' }, { key: 'user', label: 'Usuario' }, { key: 'privilegeList', label: 'Privilegios' }, { key: 'message', label: 'Mensaje' }],
    userChanges: [{ key: 'timestamp', label: 'Fecha' }, { key: 'eventCode', label: 'Evento' }, { key: 'targetUser', label: 'Usuario objetivo' }, { key: 'actorUser', label: 'Actor' }, { key: 'memberName', label: 'Miembro' }, { key: 'message', label: 'Mensaje' }],
    remote: [{ key: 'timestamp', label: 'Fecha' }, { key: 'user', label: 'Usuario' }, { key: 'sourceIp', label: 'IP' }, { key: 'processName', label: 'Proceso' }, { key: 'logonType', label: 'Tipo' }, { key: 'message', label: 'Mensaje' }]
  }

  const renderOverview = () => (
    <>
      <div className="metricGrid">
        <KpiCard label="Estado VM" value={vm?.status || '-'} />
        <KpiCard label="vCPU" value={vm?.cpu ?? '-'} />
        <KpiCard label="Memoria" value={formatBytes(vm?.memory)} />
        <KpiCard label="Disco" value={formatBytes(vm?.disk)} />
      </div>

      <div className="nativeGridTwo">
        <div className="card cardPad">
          <div className="sectionTitle">Resumen operativo 24h</div>
          {tabLoading && !overview && <div className="muted">Cargando...</div>}
          {overview?.enabled === false && <div className="emptyState">{overview.reason}</div>}
          {overview?.enabled !== false && overview && (
            <>
              <div className="metricGrid compact">
                <KpiCard label="CPU promedio" value={formatPct(overview.cpuAvgPct)} tone="info" />
                <KpiCard label="Memoria usada" value={formatPct(overview.memoryUsedPct)} tone="info" />
                <KpiCard label="Disco usado" value={formatPct(overview.diskUsedPct)} tone="info" />
                <KpiCard label="Errores 24h" value={overview.errorCount24h} tone="danger" />
              </div>
              <div className="infoGrid compactInfoGrid">
                <div className="infoItem"><div className="infoLabel">Último check-in</div><div className="infoValue">{overview.lastSeen || '-'}</div></div>
                <div className="infoItem"><div className="infoLabel">host.name Elastic</div><div className="infoValue">{overview.hostName || '-'}</div></div>
                <div className="infoItem"><div className="infoLabel">SO</div><div className="infoValue">{overview.osType || '-'}</div></div>
                <div className="infoItem"><div className="infoLabel">Kibana</div><div className="infoValue">{overview.kibanaUrl || '-'}</div></div>
              </div>
            </>
          )}
        </div>

        <div className="card cardPad">
          <div className="sectionTitle">Servicios monitoreados</div>
          <div className="serviceChips">
            {(observability.services || []).map((s) => <span key={s} className="serviceChip">{s}</span>)}
            {!observability.services?.length && <span className="muted">Sin servicios definidos</span>}
          </div>
          <div className="summaryActions">
            {observability.baseUrl && (
              <a className="btn btnSecondary" href={observability.baseUrl} target="_blank" rel="noreferrer">Abrir Kibana</a>
            )}
          </div>
        </div>
      </div>

      <div className="card cardPad">
        <div className="sectionTitle">Errores recientes</div>
        <DataTable
          columns={[{ key: 'timestamp', label: 'Fecha' }, { key: 'level', label: 'Nivel' }, { key: 'serviceName', label: 'Servicio' }, { key: 'processName', label: 'Proceso' }, { key: 'dataset', label: 'Dataset' }, { key: 'message', label: 'Mensaje' }]}
          rows={overview?.recentErrors || []}
          emptyText="Sin errores en las últimas 24 horas."
          limit={5}
        />
      </div>
    </>
  )

  const renderSql = () => {
    if (sqlOverview?.enabled === false) {
      return (
        <div className="card cardPad">
          <div className="emptyState">{sqlOverview.reason}</div>
        </div>
      )
    }

    const engineState = sqlOverview?.serviceState?.engine?.state || '-'
    const agentState = sqlOverview?.serviceState?.agent?.state || '-'

    return (
      <>
        <div className="metricGrid compact">
          <KpiCard
            label="SQL Engine"
            value={engineState}
            tone={
              engineState === 'running'
                ? 'success'
                : engineState === 'stopped'
                  ? 'danger'
                  : 'warning'
            }
          />
          <KpiCard
            label="SQL Agent"
            value={agentState}
            tone={
              agentState === 'running'
                ? 'success'
                : agentState === 'stopped'
                  ? 'danger'
                  : 'warning'
            }
          />
          <KpiCard
            label="Errores 24h"
            value={sqlOverview?.errors24h?.total ?? '-'}
            tone="danger"
          />
          <KpiCard
            label="Errores críticos"
            value={sqlOverview?.errors24h?.critical ?? '-'}
            tone="danger"
          />
          <KpiCard
            label="Failed logins"
            value={sqlOverview?.security24h?.failedLogins ?? '-'}
            tone="warning"
          />
          <KpiCard
            label="Eventos privilegio"
            value={sqlOverview?.security24h?.privilegeEvents ?? '-'}
            tone="info"
          />
        </div>

        <div className="nativeGridTwo">
          <div className="card cardPad">
            <div className="sectionTitle">Servicios SQL</div>
            <DataTable
              columns={[
                { key: 'timestamp', label: 'Fecha' },
                { key: 'serviceName', label: 'Servicio' },
                { key: 'state', label: 'Estado' },
                { key: 'message', label: 'Mensaje' }
              ]}
              rows={[
                sqlOverview?.serviceState?.engine,
                sqlOverview?.serviceState?.agent
              ].filter(Boolean)}
              emptyText="Sin telemetría reciente de servicios SQL."
            />
          </div>

          <div className="card cardPad">
            <div className="sectionTitle">Performance SQL</div>
            <div className="metricGrid compact">
              <KpiCard
                label="User connections"
                value={sqlOverview?.performance?.userConnections ?? '-'}
                tone="info"
              />
              <KpiCard
                label="Batch req/sec"
                value={sqlOverview?.performance?.batchRequestsPerSec ?? '-'}
                tone="info"
              />
              <KpiCard
                label="Lock waits/sec"
                value={sqlOverview?.performance?.lockWaitsPerSec ?? '-'}
                tone="warning"
              />
              <KpiCard
                label="Memory grants pending"
                value={sqlOverview?.performance?.memoryGrantsPending ?? '-'}
                tone="warning"
              />
              <KpiCard
                label="PLE"
                value={sqlOverview?.performance?.pageLifeExpectancy ?? '-'}
                tone="info"
              />
              <KpiCard
                label="Logins/sec"
                value={sqlOverview?.performance?.loginsPerSec ?? '-'}
                tone="info"
              />
            </div>
          </div>
        </div>

        <div className="card cardPad">
          <div className="sectionTitle">Errores SQL recientes</div>
          <DataTable
            columns={[
              { key: 'timestamp', label: 'Fecha' },
              { key: 'level', label: 'Nivel' },
              { key: 'origin', label: 'Origen' },
              { key: 'dataset', label: 'Dataset' },
              { key: 'message', label: 'Mensaje' }
            ]}
            rows={sqlOverview?.errors24h?.latest || []}
            emptyText="Sin errores SQL recientes."
            limit={5}
          />
        </div>

        <div className="card cardPad">
          <div className="sectionTitle">Eventos de seguridad SQL</div>
          <DataTable
            columns={[
              { key: 'timestamp', label: 'Fecha' },
              { key: 'action', label: 'Acción' },
              { key: 'outcome', label: 'Resultado' },
              { key: 'user', label: 'Usuario' },
              { key: 'sourceIp', label: 'IP' },
              { key: 'message', label: 'Mensaje' }
            ]}
            rows={sqlOverview?.security24h?.latest || []}
            emptyText="Sin eventos de seguridad SQL recientes."
            limit={5}
          />
        </div>
      </>
    )
  }

  const renderSecurity = () => {
    if (security?.enabled === false) {
      return <div className="card cardPad"><div className="emptyState">{security.reason}</div></div>
    }

    return (
      <>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <button className="btn btnPrimary" onClick={() => setShowExport(true)}>
            ⬇ Exportar historial PDF
          </button>
        </div>

        <div className="metricGrid compact">
          <KpiCard label="Logons exitosos" value={security?.kpis?.successLogons24h ?? '-'} tone="success" />
          <KpiCard label="Logons fallidos" value={security?.kpis?.failedLogons24h ?? '-'} tone="danger" />
          <KpiCard label="Bloqueos" value={security?.kpis?.lockouts24h ?? '-'} tone="warning" />
          <KpiCard label="Privilegios" value={security?.kpis?.privilegeEvents24h ?? '-'} tone="warning" />
          <KpiCard label="Cambios usuario" value={security?.kpis?.userChanges24h ?? '-'} tone="info" />
          <KpiCard label="Grupos privilegiados" value={security?.kpis?.groupChanges24h ?? '-'} tone="info" />
          <KpiCard label="Accesos remotos" value={security?.kpis?.remoteAccess24h ?? '-'} tone="info" />
        </div>

        <div className="nativeGridTwo">
          <div className="card cardPad">
            <div className="sectionTitle">Fallos por usuario</div>
            <MiniBarList rows={security?.failuresByUser || []} emptyText="Sin fallos agrupados por usuario" />
          </div>
          <div className="card cardPad">
            <div className="sectionTitle">Fallos por IP</div>
            <MiniBarList rows={security?.failuresByIp || []} emptyText="Sin fallos agrupados por IP" />
          </div>
        </div>

        <div className="card cardPad">
          <div className="sectionTitle">Logons exitosos recientes</div>
          <DataTable columns={secCols.success} rows={security?.recentSuccess || []} limit={5} />
        </div>

        <div className="card cardPad">
          <div className="sectionTitle">Logons fallidos recientes</div>
          <DataTable columns={secCols.failed} rows={security?.recentFailed || []} limit={5} />
        </div>

        <div className="nativeGridTwo">
          <div className="card cardPad">
            <div className="sectionTitle">Eventos de privilegio</div>
            <DataTable columns={secCols.privilege} rows={security?.privilegeEvents || []} limit={5} />
          </div>
          <div className="card cardPad">
            <div className="sectionTitle">Cambios administrativos</div>
            <DataTable columns={secCols.userChanges} rows={security?.userChanges || []} limit={5} />
          </div>
        </div>

        <div className="card cardPad">
          <div className="sectionTitle">
            {vm?.os_type === 'linux' ? 'SSH / sudo / acceso remoto' : 'RDP / WinRM / PSRemoting'}
          </div>
          <DataTable columns={secCols.remote} rows={security?.remoteAccess || []} limit={5} />
        </div>
      </>
    )
  }

  const renderServices = () => {
    if (services?.enabled === false) {
      return <div className="card cardPad"><div className="emptyState">{services.reason}</div></div>
    }
    return (
      <>
        <div className="card cardPad">
          <div className="sectionTitle">Estado de servicios</div>
          <DataTable columns={[{ key: 'timestamp', label: 'Fecha' }, { key: 'serviceName', label: 'Servicio' }, { key: 'state', label: 'Estado' }, { key: 'message', label: 'Mensaje' }]} rows={services?.rows || []} emptyText="No se detectaron estados recientes." limit={5} />
        </div>
        <div className="card cardPad">
          <div className="sectionTitle">Servicios configurados sin telemetría reciente</div>
          <div className="serviceChips">
            {(services?.missingConfiguredServices || []).map((s) => <span key={s} className="serviceChip mutedChip">{s}</span>)}
            {(!services?.missingConfiguredServices || services.missingConfiguredServices.length === 0) && (
              <span className="muted">Todos los servicios configurados tuvieron al menos un evento reciente.</span>
            )}
          </div>
        </div>
      </>
    )
  }

  const renderEvents = () => (
    <div className="card cardPad">
      <div className="sectionTitle">Eventos recientes del host</div>
      <DataTable columns={[{ key: 'timestamp', label: 'Fecha' }, { key: 'channel', label: 'Canal' }, { key: 'eventCode', label: 'Evento' }, { key: 'action', label: 'Acción' }, { key: 'level', label: 'Nivel' }, { key: 'processName', label: 'Proceso' }, { key: 'serviceName', label: 'Servicio' }, { key: 'sourceIp', label: 'IP' }, { key: 'message', label: 'Mensaje' }]} rows={events?.rows || []} limit={5} />
    </div>
  )

  const renderAudit = () => (
    <div className="card cardPad">
      <div className="sectionTitle">Auditoría del portal</div>
      <DataTable columns={[{ key: 'created_at', label: 'Fecha' }, { key: 'user_id', label: 'User ID' }, { key: 'action', label: 'Acción' }, { key: 'result', label: 'Resultado' }]} rows={auditRows || []} emptyText="Sin acciones registradas para esta VM." limit={5} />
    </div>
  )

  const activeTabView = useMemo(() => {
    if (tab === 'overview') return renderOverview()
    if (tab === 'sql') return renderSql()
    if (tab === 'security') return renderSecurity()
    if (tab === 'services') return renderServices()
    if (tab === 'events') return renderEvents()
    if (tab === 'audit') return renderAudit()
    return null
  }, [tab, vm, overview, sqlOverview, security, services, events, auditRows, tabLoading])
  return (
    <AppShell title={vm ? vm.name : 'Detalle VM'}>
      {loading && <div className="portal-info">Cargando...</div>}
      {error && <div className="errorBox">{error}</div>}

      {showExport && (
        <ExportModal
          vmid={vmid}
          vmName={vm?.name || vmid}
          onClose={() => setShowExport(false)}
          apiGet={apiGet}
        />
      )}

      {!loading && vm && (
        <>
          <div className="detailHeader">
            <div>
              <div className="detailMeta">
                <span className={`badge ${vm.status === 'running' ? 'running' : vm.status === 'stopped' ? 'stopped' : 'unknown'}`}>{vm.status || 'unknown'}</span>
                <span className="badge unknown">Pool: {vm.pool_id || '-'}</span>
                <span className="badge unknown">VMID: {vm.vmid}</span>
                <span className="badge unknown">SO: {vm.os_type || '-'}</span>
              </div>
            </div>
            <div className="actions">
              <button className="btn btnSecondary" onClick={() => router.push('/vms')}>Volver</button>
              <button className="btn btnPrimary" onClick={async () => {
                const res = await fetch(`/api/vms/${vmid}/console`, { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
                const data = await res.json()
                if (data?.url) window.open(data.url, '_blank', 'noopener,noreferrer')
              }}>Abrir consola</button>
            </div>
          </div>

          <div className="infoGrid compactInfoGrid">
            <div className="infoItem"><div className="infoLabel">Nombre</div><div className="infoValue">{vm.name}</div></div>
            <div className="infoItem"><div className="infoLabel">Nodo</div><div className="infoValue">{vm.node || '-'}</div></div>
            <div className="infoItem"><div className="infoLabel">host.name Elastic</div><div className="infoValue">{observability.hostName || '-'}</div></div>
            <div className="infoItem"><div className="infoLabel">Observabilidad</div><div className="infoValue">{observability.enabled ? 'Habilitada' : 'No habilitada'}</div></div>
          </div>

          <div className="tabBar">
            {Object.entries(WINDOWS_TABS).map(([key, label]) => (
              <button key={key} className={`tabBtn ${tab === key ? 'active' : ''}`} onClick={() => setTab(key)}>{label}</button>
            ))}
          </div>

          {tabLoading && <div className="portal-info">Cargando vista...</div>}
          {tabError && <div className="errorBox">{tabError}</div>}

          {activeTabView}
        </>
      )}
    </AppShell>
  )
}