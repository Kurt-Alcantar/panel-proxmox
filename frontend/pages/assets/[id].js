import { useRouter } from 'next/router'
import { useCallback, useEffect, useRef, useState } from 'react'
import AppShell from '../../components/AppShell'

const TABS = { overview: 'Resumen', security: 'Seguridad', services: 'Servicios', events: 'Eventos' }
const REFRESH_INTERVALS = { overview: 3000, security: 10000, services: 10000, events: 10000 }

function Gauge({ value, label, max = 100 }) {
  const pct = value == null ? 0 : Math.min(value, max) / max
  const r = 44, cx = 56, cy = 56, sw = 8
  const circ = 2 * Math.PI * r
  const dash = pct * circ * 0.75
  const c = pct > 0.85 ? '#ef4444' : pct > 0.65 ? '#f59e0b' : '#22c55e'
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'18px 12px' }}>
      <svg width={112} height={112} viewBox="0 0 112 112">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={sw}
          strokeDasharray={`${circ*0.75} ${circ*0.25}`} strokeLinecap="round"
          transform={`rotate(-225 ${cx} ${cy})`} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={c} strokeWidth={sw}
          strokeDasharray={`${dash} ${circ-dash+circ*0.25}`} strokeLinecap="round"
          transform={`rotate(-225 ${cx} ${cy})`}
          style={{ transition:'stroke-dasharray 0.6s ease' }} />
        <text x={cx} y={cy-4} textAnchor="middle" fill="#f3edff" fontSize={18} fontWeight={700}>
          {value == null ? '\u2014' : `${Math.round(value)}%`}
        </text>
        <text x={cx} y={cy+14} textAnchor="middle" fill="#b8abd9" fontSize={11}>{label}</text>
      </svg>
    </div>
  )
}

function AreaChart({ history, color = '#8b5cf6', label, height = 80 }) {
  const canvasRef = useRef(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !history || history.length < 2) return
    const ctx = canvas.getContext('2d')
    const w = canvas.width, h = canvas.height, pad = 4
    ctx.clearRect(0, 0, w, h)
    const vals = history.map(v => v ?? 0)
    const maxV = Math.max(...vals, 1)
    const sy = v => h - pad - (v / maxV) * (h - pad * 2)
    const sx = i => pad + (i / (vals.length - 1)) * (w - pad * 2)
    const grad = ctx.createLinearGradient(0, 0, 0, h)
    grad.addColorStop(0, color + '55')
    grad.addColorStop(1, color + '00')
    ctx.beginPath()
    ctx.moveTo(sx(0), sy(vals[0]))
    for (let i = 1; i < vals.length; i++) ctx.lineTo(sx(i), sy(vals[i]))
    ctx.lineTo(sx(vals.length-1), h); ctx.lineTo(sx(0), h); ctx.closePath()
    ctx.fillStyle = grad; ctx.fill()
    ctx.beginPath()
    ctx.moveTo(sx(0), sy(vals[0]))
    for (let i = 1; i < vals.length; i++) ctx.lineTo(sx(i), sy(vals[i]))
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke()
    const li = vals.length - 1
    ctx.beginPath(); ctx.arc(sx(li), sy(vals[li]), 4, 0, Math.PI*2)
    ctx.fillStyle = color; ctx.fill()
  }, [history, color])
  if (!history || history.length < 2) return null
  return (
    <div>
      <div style={{ fontSize:11, color:'#b8abd9', marginBottom:4 }}>{label}</div>
      <canvas ref={canvasRef} width={280} height={height} style={{ width:'100%', height }} />
    </div>
  )
}

function HBarChart({ rows, title, colorFn, emptyText = 'Sin datos' }) {
  if (!rows || !rows.length) return <div style={{ color:'#b8abd9', fontSize:13, padding:'12px 0' }}>{emptyText}</div>
  const max = Math.max(...rows.map(r => r.count || 0), 1)
  const colors = ['#8b5cf6','#6366f1','#3b82f6','#06b6d4','#10b981','#f59e0b','#ef4444','#ec4899','#a78bfa','#67e8f9']
  return (
    <div>
      {title && <div style={{ fontSize:13, fontWeight:700, marginBottom:12, color:'#f3edff' }}>{title}</div>}
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {rows.map((row, i) => {
          const c = colorFn ? colorFn(row,i) : colors[i % colors.length]
          return (
            <div key={row.key || i}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                <span style={{ fontSize:12, color:'#f3edff', maxWidth:'70%', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{row.key || '(vacío)'}</span>
                <span style={{ fontSize:12, color:c, fontWeight:700 }}>{row.count}</span>
              </div>
              <div style={{ background:'rgba(255,255,255,0.07)', borderRadius:4, height:6, overflow:'hidden' }}>
                <div style={{ width:`${(row.count/max)*100}%`, height:'100%', background:c, borderRadius:4, transition:'width 0.5s ease' }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DonutChart({ segments, size = 130 }) {
  const cx = size/2, cy = size/2, r = size*0.35, sw = size*0.14
  const total = segments.reduce((s,seg) => s+(seg.value||0), 0)
  if (!total) return (
    <div style={{ width:size, height:size, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <span style={{ fontSize:12, color:'#b8abd9' }}>Sin datos</span>
    </div>
  )
  const circ = 2*Math.PI*r
  let offset = 0
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={sw} />
      {segments.map((seg, i) => {
        if (!seg.value) return null
        const dash = (seg.value/total)*circ
        const el = <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={seg.color} strokeWidth={sw}
          strokeDasharray={`${dash} ${circ-dash}`} strokeDashoffset={-offset}
          transform={`rotate(-90 ${cx} ${cy})`} style={{ transition:'stroke-dasharray 0.6s ease' }} />
        offset += dash
        return el
      })}
      <text x={cx} y={cy-4} textAnchor="middle" fill="#f3edff" fontSize={size*0.13} fontWeight={700}>{total}</text>
      <text x={cx} y={cy+12} textAnchor="middle" fill="#b8abd9" fontSize={size*0.09}>total</text>
    </svg>
  )
}

function ServiceCard({ service }) {
  const sc = { running:'#22c55e', stopped:'#ef4444', unknown:'#6b7280', not_applicable:'#6b7280' }
  const sl = { running:'Corriendo', stopped:'Detenido', unknown:'Desconocido', not_applicable:'N/A' }
  const fi = { veeam:'V', sqlserver:'SQL', sqlagent:'SA', mysql:'My', postgres:'PG', nginx:'Nx', docker:'Do', cloudflare:'CF', plesk:'PL', wid:'WI' }
  const c = sc[service.state] || '#6b7280'
  return (
    <div style={{ background:'rgba(23,17,41,0.8)', border:`1px solid ${c}33`, borderRadius:12, padding:'12px 16px', display:'flex', alignItems:'center', gap:12 }}>
      <div style={{ width:36, height:36, borderRadius:8, background:`${c}22`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800, color:c, flexShrink:0 }}>
        {fi[service.family] || '?'}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, fontWeight:700, color:'#f3edff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{service.serviceName}</div>
        <div style={{ fontSize:11, color:'#b8abd9', marginTop:2 }}>{service.familyLabel}</div>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
        <span style={{ width:8, height:8, borderRadius:'50%', background:c, display:'inline-block' }} />
        <span style={{ fontSize:11, color:c, fontWeight:700 }}>{sl[service.state] || service.state}</span>
      </div>
    </div>
  )
}

function EventRow({ row }) {
  const lc = { error:'#ef4444', critical:'#dc2626', fatal:'#b91c1c', warning:'#f59e0b', info:'#38bdf8', debug:'#6b7280' }
  const c = lc[row.level?.toLowerCase()] || '#b8abd9'
  const ts = v => v ? new Date(v).toLocaleString('es-MX') : '\u2014'
  return (
    <tr style={{ borderBottom:'1px solid rgba(59,45,99,0.3)' }}>
      <td style={{ padding:'8px 10px', fontSize:11, color:'#b8abd9', whiteSpace:'nowrap' }}>{ts(row.timestamp)}</td>
      <td style={{ padding:'8px 10px' }}>
        <span style={{ background:c+'22', color:c, border:`1px solid ${c}44`, borderRadius:4, padding:'2px 6px', fontSize:11, fontWeight:700 }}>{row.level || '\u2014'}</span>
      </td>
      <td style={{ padding:'8px 10px', fontSize:11, color:'#b8abd9' }}>{row.channel || row.dataset || '\u2014'}</td>
      <td style={{ padding:'8px 10px', fontSize:12, color:'#f3edff', maxWidth:400 }}>
        <span title={row.message} style={{ display:'block', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:380 }}>{row.message || '\u2014'}</span>
      </td>
    </tr>
  )
}

function ExportModal({ assetId, assetName, onClose, apiGet }) {
  const today = new Date().toISOString().split('T')[0]
  const weekAgo = new Date(Date.now() - 7*24*60*60*1000).toISOString().split('T')[0]
  const [from, setFrom] = useState(weekAgo)
  const [to, setTo] = useState(today)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const handleExport = async () => {
    setLoading(true); setError('')
    try {
      const data = await apiGet(`/api/assets/${assetId}/observability/security/export?from=${encodeURIComponent(new Date(from+'T00:00:00').toISOString())}&to=${encodeURIComponent(new Date(to+'T23:59:59').toISOString())}`)
      if (!data) return
      const fmt = v => v ?? '-'
      const ts = v => v ? new Date(v).toLocaleString('es-MX') : '-'
      const tbl = (cols, rows) => !rows?.length ? '<p style="color:#888;font-size:12px">Sin datos.</p>' :
        `<table style="width:100%;border-collapse:collapse;font-size:11px"><thead><tr>${cols.map(c=>`<th style="background:#1e2235;color:#a0aec0;padding:6px 8px;text-align:left">${c.l}</th>`).join('')}</tr></thead><tbody>${rows.map((r,i)=>`<tr style="background:${i%2?'#141824':'#0f1117'}">${cols.map(c=>`<td style="padding:5px 8px;color:#e2e8f0">${fmt(c.k==='timestamp'?ts(r[c.k]):r[c.k])}</td>`).join('')}</tr>`).join('')}</tbody></table>`
      const kbox = (l,v,c) => `<div style="background:#1e2235;border-radius:8px;padding:12px;text-align:center;min-width:90px"><div style="font-size:11px;color:#a0aec0;margin-bottom:4px">${l}</div><div style="font-size:22px;font-weight:700;color:${c}">${fmt(v)}</div></div>`
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Reporte - ${assetName}</title><style>body{font-family:'Segoe UI',sans-serif;background:#0a0d14;color:#e2e8f0;margin:0;padding:32px}</style></head><body>
      <div style="display:flex;justify-content:space-between;margin-bottom:32px;border-bottom:2px solid #2d3748;padding-bottom:24px">
        <div style="font-size:24px;font-weight:700;color:#7c8cff">Hyperox</div>
        <div style="text-align:right"><div style="font-size:18px;font-weight:600">Reporte de Seguridad</div><div style="font-size:12px;color:#a0aec0">${assetName} &bull; ${from} &rarr; ${to}</div></div>
      </div>
      <div style="margin-bottom:24px"><div style="font-size:13px;font-weight:600;color:#7c8cff;margin-bottom:12px">Resumen</div>
      <div style="display:flex;gap:12px;flex-wrap:wrap">
        ${kbox('Logons OK',data.kpis?.successLogons??0,'#48bb78')}
        ${kbox('Logons fail',data.kpis?.failedLogons??0,'#fc8181')}
        ${kbox('Bloqueos',data.kpis?.lockouts??0,'#f6ad55')}
        ${kbox('Privilegios',data.kpis?.privilegeEvents??0,'#f6ad55')}
      </div></div>
      <div style="margin-bottom:24px"><div style="font-size:13px;font-weight:600;color:#7c8cff;margin-bottom:12px">Fallos por usuario</div>${tbl([{k:'key',l:'Usuario'},{k:'count',l:'Intentos'}],data.failuresByUser)}</div>
      <div style="margin-bottom:24px"><div style="font-size:13px;font-weight:600;color:#7c8cff;margin-bottom:12px">Fallos por IP</div>${tbl([{k:'key',l:'IP'},{k:'count',l:'Intentos'}],data.failuresByIp)}</div>
      </body></html>`
      const w = window.open('','_blank')
      if (w) { w.document.write(html); w.document.close(); setTimeout(()=>w.print(),600) }
      onClose()
    } catch(e) { setError(e.message) } finally { setLoading(false) }
  }
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div className="card cardPad" style={{ width:400, maxWidth:'90vw' }}>
        <div className="sectionTitle" style={{ marginBottom:16 }}>Exportar reporte de seguridad</div>
        <div className="formGroup" style={{ marginBottom:12 }}>
          <label style={{ fontSize:12, color:'#b8abd9', display:'block', marginBottom:4 }}>Desde</label>
          <input type="date" className="input" value={from} onChange={e=>setFrom(e.target.value)} style={{ width:'100%' }} />
        </div>
        <div className="formGroup" style={{ marginBottom:16 }}>
          <label style={{ fontSize:12, color:'#b8abd9', display:'block', marginBottom:4 }}>Hasta</label>
          <input type="date" className="input" value={to} onChange={e=>setTo(e.target.value)} style={{ width:'100%' }} />
        </div>
        {error && <div className="errorBox" style={{ marginBottom:12 }}>{error}</div>}
        <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
          <button className="btn btnSecondary" onClick={onClose} disabled={loading}>Cancelar</button>
          <button className="btn btnPrimary" onClick={handleExport} disabled={loading}>{loading?'Generando...':'Descargar PDF'}</button>
        </div>
      </div>
    </div>
  )
}

export default function AssetDetailPage() {
  const router = useRouter()
  const { id } = router.query
  const [asset, setAsset] = useState(null)
  const [tab, setTab] = useState('overview')
  const [tabData, setTabData] = useState({})
  const [loadingTab, setLoadingTab] = useState(false)
  const [loadingAsset, setLoadingAsset] = useState(true)
  const [showExport, setShowExport] = useState(false)
  const [lastRefresh, setLastRefresh] = useState(null)
  const [cpuHistory, setCpuHistory] = useState([])
  const [memHistory, setMemHistory] = useState([])
  const loadedTabs = useRef(new Set())
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
    if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.message||`Error ${res.status}`) }
    return res.json()
  }, [clearSession])

  useEffect(() => {
    if (!id) return
    setLoadingAsset(true)
    apiGet(`/api/assets/${id}`).then(data=>{ setAsset(data); setLoadingAsset(false) }).catch(()=>setLoadingAsset(false))
  }, [id, apiGet])

  const pushHistory = useCallback((data) => {
    if (!data) return
    const push = (setter, val) => setter(prev => {
      const next = [...prev, val ?? null]
      return next.length > 40 ? next.slice(-40) : next
    })
    if (data.cpuAvgPct != null) push(setCpuHistory, data.cpuAvgPct)
    if (data.memoryUsedPct != null) push(setMemHistory, data.memoryUsedPct)
  }, [])

  const fetchTabSilent = useCallback(async (t, assetId) => {
    if (!assetId || isFetching.current) return
    isFetching.current = true
    try {
      const data = await apiGet(`/api/assets/${assetId}/observability/${t}`)
      if (data) { setTabData(prev=>({...prev,[t]:data})); setLastRefresh(new Date()); if(t==='overview') pushHistory(data) }
    } catch(_) {} finally { isFetching.current = false }
  }, [apiGet, pushHistory])

  const loadTab = useCallback(async (t, assetId) => {
    if (!assetId) return
    if (!loadedTabs.current.has(t)) setLoadingTab(true)
    try {
      const data = await apiGet(`/api/assets/${assetId}/observability/${t}`)
      setTabData(prev=>({...prev,[t]:data})); setLastRefresh(new Date()); loadedTabs.current.add(t)
      if (t==='overview') pushHistory(data)
    } catch(e) { setTabData(prev=>({...prev,[t]:{enabled:false,reason:e.message}})) } finally { setLoadingTab(false) }
  }, [apiGet, pushHistory])

  useEffect(() => {
    if (!asset || !id) return
    loadedTabs.current.clear(); loadTab(tab, id)
    if (refreshTimer.current) clearInterval(refreshTimer.current)
    refreshTimer.current = setInterval(()=>fetchTabSilent(tab,id), REFRESH_INTERVALS[tab]||5000)
    return () => { if (refreshTimer.current) clearInterval(refreshTimer.current) }
  }, [asset?.id, tab, id])

  const ts = v => v ? new Date(v).toLocaleString('es-MX') : '\u2014'
  const sc = { online:'#22c55e', offline:'#ef4444', error:'#f59e0b' }

  if (loadingAsset) return <AppShell title="Cargando..."><div className="card cardPad"><p className="muted">Cargando activo...</p></div></AppShell>
  if (!asset) return <AppShell title="No encontrado"><div className="card cardPad"><div className="errorBox">Activo no encontrado o sin acceso.</div></div></AppShell>

  const d = tabData[tab] || {}
  const statusColor = sc[asset.agent_status] || '#6b7280'
  const card = (children, extra) => (
    <div style={{ background:'rgba(23,17,41,0.92)', border:'1px solid #3b2d63', borderRadius:16, padding:'16px 20px', ...extra }}>
      {children}
    </div>
  )
  const secTitle = (t) => <div style={{ fontSize:13, fontWeight:700, color:'#b8abd9', marginBottom:12 }}>{t}</div>

  return (
    <AppShell
      title={asset.display_name || asset.host_name || 'Activo'}
      subtitle={`${asset.os_name || asset.os_type || 'OS desconocido'} \u00b7 ${asset.agent_version || ''}`}
      actions={
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btnSecondary" onClick={()=>router.push('/assets')}>\Activos</button>
          {asset.os_type === 'windows' && (
            <button className="btn btnSecondary" style={{ background:'rgba(139,92,246,0.15)', borderColor:'rgba(139,92,246,0.4)', color:'#c4b5fd' }}
              onClick={() => router.push(`/assets/${id}/veeam`)}>
              Veeam Jobs
            </button>
          )}
          {asset.kibana_base_url && <a className="btn btnSecondary" href={asset.kibana_base_url} target="_blank" rel="noreferrer">Kibana \u2197</a>}
        </div>
      }
    >
      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.25}}
        @keyframes statusblink{0%,100%{opacity:1}50%{opacity:.5}}
        .svc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:10px}
        .ev-table td{vertical-align:middle}
        .th-cell{text-align:left;padding:8px 10px;font-size:11px;color:#b8abd9;font-weight:600;border-bottom:1px solid #3b2d63}
      `}</style>

      {/* Header */}
      {card(
        <div style={{ display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ width:12, height:12, borderRadius:'50%', background:statusColor, display:'inline-block', animation:'statusblink 2s infinite' }} />
            <span style={{ fontSize:18, fontWeight:800, color:'#f3edff' }}>{asset.display_name || asset.host_name}</span>
            <span style={{ background:statusColor+'22', color:statusColor, border:`1px solid ${statusColor}44`, borderRadius:999, padding:'2px 10px', fontSize:12, fontWeight:700 }}>{asset.agent_status}</span>
          </div>
          <div style={{ display:'flex', gap:20, flexWrap:'wrap', marginLeft:'auto' }}>
            {[{l:'OS',v:asset.os_name||asset.os_type||'\u2014'},{l:'Agente',v:asset.agent_version||'\u2014'},{l:'Check-in',v:ts(asset.last_checkin_at)}].map(i=>(
              <div key={i.l} style={{ textAlign:'right' }}>
                <div style={{ fontSize:10, color:'#b8abd9', textTransform:'uppercase', letterSpacing:'0.06em' }}>{i.l}</div>
                <div style={{ fontSize:13, fontWeight:600, color:'#f3edff' }}>{i.v}</div>
              </div>
            ))}
          </div>
        </div>,
        { marginBottom:20 }
      )}

      {/* Tabs */}
      <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:20 }}>
        {Object.entries(TABS).map(([k,v])=>(
          <button key={k} className={`tabBtn ${tab===k?'active':''}`} onClick={()=>setTab(k)}>{v}</button>
        ))}
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:12 }}>
          {lastRefresh && (
            <span style={{ fontSize:12, color:'#b8abd9', display:'flex', alignItems:'center', gap:5 }}>
              <span style={{ width:7, height:7, borderRadius:'50%', background:'#22c55e', display:'inline-block', animation:'pulse 2s infinite' }} />
              {tab==='overview'?'Live 3s':'Live 10s'} \u00b7 {lastRefresh.toLocaleTimeString('es-MX')}
            </span>
          )}
          {tab==='security' && <button className="btn btnSecondary" style={{ fontSize:12, padding:'6px 12px' }} onClick={()=>setShowExport(true)}>Exportar PDF</button>}
        </div>
      </div>

      {showExport && <ExportModal assetId={id} assetName={asset.display_name||asset.host_name} onClose={()=>setShowExport(false)} apiGet={apiGet} />}
      {loadingTab && card(<p className="muted">Cargando datos...</p>, { marginBottom:16 })}
      {!loadingTab && d.enabled===false && card(<div className="emptyState">{d.reason||'Observabilidad no disponible.'}</div>)}

      {/* OVERVIEW */}
      {!loadingTab && d.enabled!==false && tab==='overview' && (<>
        {card(<>
          {secTitle('Recursos del sistema')}
          <div style={{ display:'flex', justifyContent:'space-around', flexWrap:'wrap', gap:8 }}>
            <Gauge value={d.cpuAvgPct} label="CPU" />
            <Gauge value={d.memoryUsedPct} label="Memoria" />
            <Gauge value={d.diskUsedPct} label="Disco" />
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'18px 12px', justifyContent:'center' }}>
              <div style={{ fontSize:40, fontWeight:800, color:d.errorCount24h>0?'#f59e0b':'#22c55e', lineHeight:1 }}>{d.errorCount24h??'\u2014'}</div>
              <div style={{ fontSize:12, color:'#b8abd9', marginTop:6 }}>Errores 24h</div>
            </div>
          </div>
        </>, { marginBottom:16 })}

        {cpuHistory.length > 3 && card(<>
          {secTitle('Tendencia en tiempo real')}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
            <AreaChart history={cpuHistory} color="#8b5cf6" label={`CPU \u2014 actual: ${d.cpuAvgPct??'\u2014'}%`} />
            <AreaChart history={memHistory} color="#06b6d4" label={`Memoria \u2014 actual: ${d.memoryUsedPct??'\u2014'}%`} />
          </div>
        </>, { marginBottom:16 })}

        {card(<>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
            {secTitle('Errores recientes')}
            <span style={{ fontSize:12, color:'#b8abd9', marginBottom:12 }}>Visto: {ts(d.lastSeen)}</span>
          </div>
          {!d.recentErrors?.length ? (
            <div style={{ color:'#22c55e', fontSize:13, padding:'8px 0' }}>Sin errores recientes</div>
          ) : (
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }} className="ev-table">
                <thead><tr>{['Fecha','Nivel','Dataset','Mensaje'].map(h=><th key={h} className="th-cell">{h}</th>)}</tr></thead>
                <tbody>{d.recentErrors.slice(0,8).map((r,i)=><EventRow key={i} row={{...r,channel:r.dataset}} />)}</tbody>
              </table>
            </div>
          )}
        </>)}
      </>)}

      {/* SECURITY */}
      {!loadingTab && d.enabled!==false && tab==='security' && d.kpis && (<>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:12, marginBottom:16 }}>
          {[
            {l:'Logons exitosos',v:d.kpis.successLogons24h,c:'#22c55e'},
            {l:'Logons fallidos',v:d.kpis.failedLogons24h,c:d.kpis.failedLogons24h>0?'#ef4444':'#6b7280'},
            {l:'Bloqueos',v:d.kpis.lockouts24h,c:d.kpis.lockouts24h>0?'#ef4444':'#6b7280'},
            {l:'Privilegios',v:d.kpis.privilegeEvents24h,c:d.kpis.privilegeEvents24h>50?'#f59e0b':'#8b5cf6'},
            {l:'Cambios usuario',v:d.kpis.userChanges24h,c:d.kpis.userChanges24h>0?'#f59e0b':'#6b7280'},
            {l:'Acceso remoto',v:d.kpis.remoteAccess24h,c:'#38bdf8'},
          ].map(k=>(
            <div key={k.l} style={{ background:'rgba(23,17,41,0.92)', border:`1px solid ${k.c}33`, borderRadius:12, padding:'14px 16px' }}>
              <div style={{ fontSize:11, color:'#b8abd9', marginBottom:6 }}>{k.l}</div>
              <div style={{ fontSize:30, fontWeight:800, color:k.c, lineHeight:1 }}>{k.v??'\u2014'}</div>
            </div>
          ))}
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
          {card(<>
            {secTitle('Distribución de eventos')}
            <div style={{ display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
              <DonutChart size={120} segments={[
                {value:d.kpis.successLogons24h,color:'#22c55e'},
                {value:d.kpis.failedLogons24h,color:'#ef4444'},
                {value:d.kpis.privilegeEvents24h,color:'#8b5cf6'},
                {value:d.kpis.remoteAccess24h,color:'#38bdf8'},
                {value:d.kpis.lockouts24h,color:'#f59e0b'},
              ]} />
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {[{l:'Exitosos',c:'#22c55e',v:d.kpis.successLogons24h},{l:'Fallidos',c:'#ef4444',v:d.kpis.failedLogons24h},{l:'Privilegios',c:'#8b5cf6',v:d.kpis.privilegeEvents24h},{l:'Remoto',c:'#38bdf8',v:d.kpis.remoteAccess24h},{l:'Bloqueos',c:'#f59e0b',v:d.kpis.lockouts24h}].map(s=>(
                  <div key={s.l} style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ width:8, height:8, borderRadius:'50%', background:s.c, flexShrink:0 }} />
                    <span style={{ fontSize:12, color:'#b8abd9' }}>{s.l}</span>
                    <span style={{ fontSize:12, fontWeight:700, color:s.c, marginLeft:'auto', paddingLeft:8 }}>{s.v}</span>
                  </div>
                ))}
              </div>
            </div>
          </>)}
          {card(<HBarChart title="Fallos por IP" rows={d.failuresByIp?.slice(0,6)} colorFn={(_,i)=>['#ef4444','#f59e0b','#f97316','#dc2626','#b91c1c','#991b1b'][i]||'#ef4444'} emptyText="Sin fallos por IP" />)}
        </div>

        {card(<HBarChart title="Actividad por usuario" rows={d.failuresByUser?.slice(0,8)} emptyText="Sin datos de usuario" />, { marginBottom:16 })}

        {d.recentFailed?.length>0 && card(<>
          {secTitle('Logons fallidos recientes')}
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead><tr>{['Fecha','Usuario','IP','Mensaje'].map(h=><th key={h} className="th-cell">{h}</th>)}</tr></thead>
              <tbody>
                {d.recentFailed.map((r,i)=>(
                  <tr key={i} style={{ borderBottom:'1px solid rgba(59,45,99,0.3)' }}>
                    <td style={{ padding:'8px 10px', fontSize:11, color:'#b8abd9', whiteSpace:'nowrap' }}>{ts(r.timestamp)}</td>
                    <td style={{ padding:'8px 10px', fontSize:12, color:'#f3edff', fontWeight:600 }}>{r.user||'\u2014'}</td>
                    <td style={{ padding:'8px 10px', fontSize:12, color:'#ef4444' }}>{r.sourceIp||'\u2014'}</td>
                    <td style={{ padding:'8px 10px', fontSize:11, color:'#b8abd9', maxWidth:300 }}>
                      <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', display:'block', maxWidth:280 }} title={r.message}>{r.message||'\u2014'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>, { marginBottom:16 })}
      </>)}

      {/* SERVICES */}
      {!loadingTab && d.enabled!==false && tab==='services' && (<>
        {!d.rows?.length ? card(<div className="emptyState">Sin servicios detectados en las \u00faltimas 24h.</div>) : (<>
          {d.detectedFamilies?.length>0 && card(<>
            {secTitle('Familias detectadas')}
            <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
              {d.detectedFamilies.map(f=>(
                <span key={f} style={{ background:'rgba(139,92,246,0.15)', border:'1px solid rgba(139,92,246,0.35)', borderRadius:999, padding:'4px 12px', fontSize:13, color:'#c4b5fd', fontWeight:700 }}>{f}</span>
              ))}
            </div>
          </>, { marginBottom:16 })}
          <div className="svc-grid" style={{ marginBottom:16 }}>
            {d.rows.map((svc,i)=><ServiceCard key={i} service={svc} />)}
          </div>
          {d.details?.veeam && card(<>
            {secTitle('Veeam \u2014 \u00daltimas 24h')}
            <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginBottom:16 }}>
              {[{l:'Exitosos',v:d.details.veeam.kpis?.success24h,c:'#22c55e'},{l:'Advertencias',v:d.details.veeam.kpis?.warning24h,c:'#f59e0b'},{l:'Fallidos',v:d.details.veeam.kpis?.failed24h,c:'#ef4444'},{l:'En progreso',v:d.details.veeam.kpis?.running24h,c:'#38bdf8'}].map(k=>(
                <div key={k.l} style={{ background:`${k.c}15`, border:`1px solid ${k.c}33`, borderRadius:10, padding:'10px 16px', textAlign:'center', minWidth:90 }}>
                  <div style={{ fontSize:24, fontWeight:800, color:k.c, lineHeight:1 }}>{k.v??0}</div>
                  <div style={{ fontSize:11, color:'#b8abd9', marginTop:4 }}>{k.l}</div>
                </div>
              ))}
            </div>
            {d.details.veeam.recentJobs?.length>0 && (
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead><tr>{['Fecha','Resultado','Servicio','Mensaje'].map(h=><th key={h} className="th-cell">{h}</th>)}</tr></thead>
                  <tbody>
                    {d.details.veeam.recentJobs.slice(0,8).map((job,i)=>{
                      const rc={success:'#22c55e',failed:'#ef4444',warning:'#f59e0b',running:'#38bdf8'}[job.result]||'#6b7280'
                      return (
                        <tr key={i} style={{ borderBottom:'1px solid rgba(59,45,99,0.3)' }}>
                          <td style={{ padding:'8px 10px', fontSize:11, color:'#b8abd9', whiteSpace:'nowrap' }}>{ts(job.timestamp)}</td>
                          <td style={{ padding:'8px 10px' }}><span style={{ background:rc+'22', color:rc, border:`1px solid ${rc}44`, borderRadius:4, padding:'2px 8px', fontSize:11, fontWeight:700 }}>{job.result}</span></td>
                          <td style={{ padding:'8px 10px', fontSize:12, color:'#f3edff' }}>{job.serviceName||'\u2014'}</td>
                          <td style={{ padding:'8px 10px', fontSize:11, color:'#b8abd9' }}><span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', display:'block', maxWidth:260 }} title={job.message}>{job.message||'\u2014'}</span></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>)}
        </>)}
      </>)}

      {/* EVENTS */}
      {!loadingTab && d.enabled!==false && tab==='events' && card(<>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
          {secTitle('Eventos recientes')}
          <span style={{ fontSize:11, color:'#6b7280' }}>24h \u00b7 m\u00e1x 100</span>
        </div>
        {!(d.rows||[]).length ? <div style={{ color:'#b8abd9', fontSize:13 }}>Sin eventos recientes.</div> : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }} className="ev-table">
              <thead><tr>{['Fecha','Nivel','Canal / Dataset','Mensaje'].map(h=><th key={h} className="th-cell">{h}</th>)}</tr></thead>
              <tbody>{(d.rows||[]).map((r,i)=><EventRow key={i} row={r} />)}</tbody>
            </table>
          </div>
        )}
      </>)}
    </AppShell>
  )
}