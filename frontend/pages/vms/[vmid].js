import { useRouter } from 'next/router'
import { useCallback, useEffect, useRef, useState } from 'react'
import AppShell from '../../components/AppShell'

const TABS = { overview: 'Resumen', security: 'Seguridad', services: 'Servicios', events: 'Eventos' }
const REFRESH_INTERVALS = { overview: 3000, security: 10000, services: 10000, events: 10000 }

// ─── Utilidades ───────────────────────────────────────────────────
const fmt = v => v == null || v === '' ? '—' : v
const ts  = v => v ? new Date(v).toLocaleString('es-MX') : '—'
const fmtBytes = v => { const n = Number(v||0); if(!n) return '—'; const g = n/1024/1024/1024; return g >= 1 ? `${g.toFixed(1)} GB` : `${(n/1024/1024).toFixed(0)} MB` }
const fmtPct = v => v == null ? '—' : `${Number(v).toFixed(1)}%`

// ─── Gauge SVG ────────────────────────────────────────────────────
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
          strokeDasharray={`${circ*0.75} ${circ*0.25}`} strokeLinecap="round" transform={`rotate(-225 ${cx} ${cy})`} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={c} strokeWidth={sw}
          strokeDasharray={`${dash} ${circ-dash+circ*0.25}`} strokeLinecap="round"
          transform={`rotate(-225 ${cx} ${cy})`} style={{ transition:'stroke-dasharray 0.6s ease' }} />
        <text x={cx} y={cy-4} textAnchor="middle" fill="#f3edff" fontSize={18} fontWeight={700}>
          {value == null ? '—' : `${Math.round(value)}%`}
        </text>
        <text x={cx} y={cy+14} textAnchor="middle" fill="#b8abd9" fontSize={11}>{label}</text>
      </svg>
    </div>
  )
}

// ─── Area Chart Canvas ────────────────────────────────────────────
function AreaChart({ history, color = '#8b5cf6', label, height = 80 }) {
  const ref = useRef(null)
  useEffect(() => {
    const c = ref.current; if (!c || !history || history.length < 2) return
    const ctx = c.getContext('2d'), w = c.width, h = c.height, p = 4
    ctx.clearRect(0,0,w,h)
    const vals = history.map(v => v??0), maxV = Math.max(...vals,1)
    const sy = v => h-p-(v/maxV)*(h-p*2), sx = i => p+(i/(vals.length-1))*(w-p*2)
    const g = ctx.createLinearGradient(0,0,0,h); g.addColorStop(0,color+'55'); g.addColorStop(1,color+'00')
    ctx.beginPath(); ctx.moveTo(sx(0),sy(vals[0]))
    for(let i=1;i<vals.length;i++) ctx.lineTo(sx(i),sy(vals[i]))
    ctx.lineTo(sx(vals.length-1),h); ctx.lineTo(sx(0),h); ctx.closePath()
    ctx.fillStyle=g; ctx.fill()
    ctx.beginPath(); ctx.moveTo(sx(0),sy(vals[0]))
    for(let i=1;i<vals.length;i++) ctx.lineTo(sx(i),sy(vals[i]))
    ctx.strokeStyle=color; ctx.lineWidth=2; ctx.lineJoin='round'; ctx.stroke()
    const li=vals.length-1; ctx.beginPath(); ctx.arc(sx(li),sy(vals[li]),4,0,Math.PI*2)
    ctx.fillStyle=color; ctx.fill()
  }, [history, color])
  if (!history || history.length < 2) return null
  return (
    <div>
      <div style={{ fontSize:11, color:'#b8abd9', marginBottom:4 }}>{label}</div>
      <canvas ref={ref} width={280} height={height} style={{ width:'100%', height }} />
    </div>
  )
}

// ─── HBarChart ────────────────────────────────────────────────────
function HBarChart({ rows, title, colorFn, emptyText='Sin datos' }) {
  if (!rows?.length) return <div style={{ color:'#b8abd9', fontSize:13, padding:'12px 0' }}>{emptyText}</div>
  const max = Math.max(...rows.map(r=>r.count||0),1)
  const colors = ['#8b5cf6','#6366f1','#3b82f6','#06b6d4','#10b981','#f59e0b','#ef4444','#ec4899']
  return (
    <div>
      {title && <div style={{ fontSize:13, fontWeight:700, marginBottom:12, color:'#f3edff' }}>{title}</div>}
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {rows.map((row,i) => {
          const c = colorFn ? colorFn(row,i) : colors[i%colors.length]
          return (
            <div key={row.key||i}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                <span style={{ fontSize:12, color:'#f3edff', maxWidth:'70%', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{row.key||'(vacío)'}</span>
                <span style={{ fontSize:12, color:c, fontWeight:700 }}>{row.count}</span>
              </div>
              <div style={{ background:'rgba(255,255,255,0.07)', borderRadius:4, height:6, overflow:'hidden' }}>
                <div style={{ width:`${(row.count/max)*100}%`, height:'100%', background:c, borderRadius:4, transition:'width 0.5s' }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Donut Chart ──────────────────────────────────────────────────
function DonutChart({ segments, size=130 }) {
  const cx=size/2, cy=size/2, r=size*0.35, sw=size*0.14
  const total = segments.reduce((s,seg)=>s+(seg.value||0),0)
  if (!total) return <div style={{ width:size, height:size, display:'flex', alignItems:'center', justifyContent:'center' }}><span style={{ fontSize:12, color:'#b8abd9' }}>Sin datos</span></div>
  const circ = 2*Math.PI*r; let offset=0
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={sw} />
      {segments.map((seg,i) => {
        if (!seg.value) return null
        const dash=(seg.value/total)*circ
        const el=<circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={seg.color} strokeWidth={sw}
          strokeDasharray={`${dash} ${circ-dash}`} strokeDashoffset={-offset}
          transform={`rotate(-90 ${cx} ${cy})`} style={{ transition:'stroke-dasharray 0.6s' }} />
        offset+=dash; return el
      })}
      <text x={cx} y={cy-4} textAnchor="middle" fill="#f3edff" fontSize={size*0.13} fontWeight={700}>{total}</text>
      <text x={cx} y={cy+12} textAnchor="middle" fill="#b8abd9" fontSize={size*0.09}>total</text>
    </svg>
  )
}

// ─── ServiceCard ──────────────────────────────────────────────────
function ServiceCard({ service }) {
  const sc = { running:'#22c55e', stopped:'#ef4444', unknown:'#6b7280', not_applicable:'#6b7280' }
  const sl = { running:'Corriendo', stopped:'Detenido', unknown:'Desconocido', not_applicable:'N/A' }
  const fi = { veeam:'V', sqlserver:'SQL', sqlagent:'SA', mysql:'My', postgres:'PG', nginx:'Nx', docker:'Do' }
  const c = sc[service.state]||'#6b7280'
  return (
    <div style={{ background:'rgba(23,17,41,0.8)', border:`1px solid ${c}33`, borderRadius:12, padding:'12px 16px', display:'flex', alignItems:'center', gap:12 }}>
      <div style={{ width:36, height:36, borderRadius:8, background:`${c}22`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800, color:c, flexShrink:0 }}>
        {fi[service.family]||'?'}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, fontWeight:700, color:'#f3edff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{service.serviceName}</div>
        <div style={{ fontSize:11, color:'#b8abd9', marginTop:2 }}>{service.familyLabel}</div>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
        <span style={{ width:8, height:8, borderRadius:'50%', background:c }} />
        <span style={{ fontSize:11, color:c, fontWeight:700 }}>{sl[service.state]||service.state}</span>
      </div>
    </div>
  )
}

// ─── EventRow ─────────────────────────────────────────────────────
function EventRow({ row }) {
  const lc = { error:'#ef4444', critical:'#dc2626', fatal:'#b91c1c', warning:'#f59e0b', info:'#38bdf8', debug:'#6b7280' }
  const c = lc[row.level?.toLowerCase()]||'#b8abd9'
  return (
    <tr style={{ borderBottom:'1px solid rgba(59,45,99,0.3)' }}>
      <td style={{ padding:'8px 10px', fontSize:11, color:'#b8abd9', whiteSpace:'nowrap' }}>{ts(row.timestamp)}</td>
      <td style={{ padding:'8px 10px' }}>
        <span style={{ background:c+'22', color:c, border:`1px solid ${c}44`, borderRadius:4, padding:'2px 6px', fontSize:11, fontWeight:700 }}>{row.level||'—'}</span>
      </td>
      <td style={{ padding:'8px 10px', fontSize:11, color:'#b8abd9' }}>{row.channel||row.dataset||'—'}</td>
      <td style={{ padding:'8px 10px', fontSize:12, color:'#f3edff', maxWidth:400 }}>
        <span title={row.message} style={{ display:'block', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:380 }}>{row.message||'—'}</span>
      </td>
    </tr>
  )
}

// ─── Panel sin agente (solo datos Proxmox) ────────────────────────
function ProxmoxOnlyPanel({ vm }) {
  const statusColor = vm.status==='running'?'#22c55e':vm.status==='stopped'?'#ef4444':'#6b7280'
  const specs = [
    { l:'vCPU', v:`${vm.cpu} núcleos` },
    { l:'Memoria asignada', v:fmtBytes(vm.memory) },
    { l:'Disco asignado', v:fmtBytes(vm.disk) },
    { l:'Pool', v:vm.pool_id||'—' },
    { l:'Nodo Proxmox', v:vm.node||'—' },
    { l:'OS Type', v:vm.os_type||'Desconocido' },
    { l:'VMID', v:vm.vmid },
    { l:'Creada', v:ts(vm.created_at) },
  ]
  return (
    <div style={{ background:'rgba(23,17,41,0.92)', border:'1px solid #3b2d63', borderRadius:16, padding:'20px 24px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
        <span style={{ width:10, height:10, borderRadius:'50%', background:statusColor, display:'inline-block' }} />
        <span style={{ fontSize:15, fontWeight:700, color:statusColor }}>{vm.status?.toUpperCase()}</span>
        <span style={{ fontSize:12, color:'#b8abd9', marginLeft:8 }}>Solo datos de hipervisor disponibles</span>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:16, marginBottom:20 }}>
        {specs.map(s => (
          <div key={s.l} style={{ background:'rgba(255,255,255,0.04)', borderRadius:10, padding:'12px 14px' }}>
            <div style={{ fontSize:10, color:'#b8abd9', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>{s.l}</div>
            <div style={{ fontSize:14, fontWeight:600, color:'#f3edff' }}>{s.v}</div>
          </div>
        ))}
      </div>
      <div style={{ background:'rgba(139,92,246,0.08)', border:'1px solid rgba(139,92,246,0.25)', borderRadius:10, padding:'14px 16px', display:'flex', alignItems:'flex-start', gap:12 }}>
        <span style={{ fontSize:20 }}>🔌</span>
        <div>
          <div style={{ fontSize:13, fontWeight:700, color:'#c4b5fd', marginBottom:4 }}>Sin agente Fleet enrollado</div>
          <div style={{ fontSize:12, color:'#b8abd9', lineHeight:1.6 }}>
            Esta VM no tiene un Elastic Agent instalado. Para habilitar monitoreo de telemetría, seguridad y servicios, instala el agente y configura <code style={{ background:'rgba(255,255,255,0.08)', padding:'1px 5px', borderRadius:3 }}>elastic_host_name</code> en la VM.
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────
export default function VmDetailPage() {
  const router = useRouter()
  const { vmid } = router.query
  const [vm, setVm] = useState(null)
  const [linkedAsset, setLinkedAsset] = useState(null)  // asset Fleet vinculado
  const [tab, setTab] = useState('overview')
  const [tabData, setTabData] = useState({})
  const [loadingVm, setLoadingVm] = useState(true)
  const [loadingTab, setLoadingTab] = useState(false)
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

  // Cargar VM y buscar asset Fleet vinculado por elastic_host_name
  useEffect(() => {
    if (!vmid) return
    setLoadingVm(true)
    apiGet(`/api/vms/${vmid}`).then(async (v) => {
      setVm(v)
      if (v?.elastic_host_name) {
        try {
          const assets = await apiGet('/api/assets')
          const match = assets?.find(a =>
            a.host_name?.toLowerCase() === v.elastic_host_name?.toLowerCase() ||
            a.display_name?.toLowerCase() === v.elastic_host_name?.toLowerCase()
          )
          if (match) setLinkedAsset(match)
        } catch(_) {}
      }
      setLoadingVm(false)
    }).catch(()=>setLoadingVm(false))
  }, [vmid])

  const pushHistory = useCallback((data) => {
    const push = (setter, val) => setter(prev => {
      const next = [...prev, val??null]
      return next.length > 40 ? next.slice(-40) : next
    })
    if (data?.cpuAvgPct != null) push(setCpuHistory, data.cpuAvgPct)
    if (data?.memoryUsedPct != null) push(setMemHistory, data.memoryUsedPct)
  }, [])

  // Para VMs con agente: usar endpoints de assets
  // Para VMs sin agente: usar endpoints de vms (que ya existen)
  const getObsUrl = useCallback((t) => {
    if (linkedAsset) return `/api/assets/${linkedAsset.id}/observability/${t}`
    return `/api/vms/${vmid}/observability/${t}`
  }, [linkedAsset, vmid])

  const fetchTabSilent = useCallback(async (t) => {
    if (isFetching.current) return
    isFetching.current = true
    try {
      const data = await apiGet(getObsUrl(t))
      if (data) {
        setTabData(prev=>({...prev,[t]:data}))
        setLastRefresh(new Date())
        if (t==='overview') pushHistory(data)
      }
    } catch(_) {} finally { isFetching.current=false }
  }, [apiGet, getObsUrl, pushHistory])

  const loadTab = useCallback(async (t) => {
    if (!vmid) return
    if (!loadedTabs.current.has(t)) setLoadingTab(true)
    try {
      const data = await apiGet(getObsUrl(t))
      setTabData(prev=>({...prev,[t]:data}))
      setLastRefresh(new Date())
      loadedTabs.current.add(t)
      if (t==='overview') pushHistory(data)
    } catch(e) {
      setTabData(prev=>({...prev,[t]:{enabled:false,reason:e.message}}))
    } finally { setLoadingTab(false) }
  }, [vmid, apiGet, getObsUrl, pushHistory])

  useEffect(() => {
    if (!vm) return
    const hasObs = vm.elastic_host_name || linkedAsset
    if (!hasObs) return  // sin agente, no cargar tabs
    loadedTabs.current.clear()
    loadTab(tab)
    if (refreshTimer.current) clearInterval(refreshTimer.current)
    refreshTimer.current = setInterval(()=>fetchTabSilent(tab), REFRESH_INTERVALS[tab]||5000)
    return () => { if(refreshTimer.current) clearInterval(refreshTimer.current) }
  }, [vm?.vmid, linkedAsset?.id, tab])

  const card = (children, style={}) => (
    <div style={{ background:'rgba(23,17,41,0.92)', border:'1px solid #3b2d63', borderRadius:16, padding:'16px 20px', ...style }}>
      {children}
    </div>
  )
  const secTitle = t => <div style={{ fontSize:13, fontWeight:700, color:'#b8abd9', marginBottom:12 }}>{t}</div>

  if (loadingVm) return <AppShell title="Cargando..."><div className="card cardPad"><p className="muted">Cargando VM...</p></div></AppShell>
  if (!vm) return <AppShell title="No encontrada"><div className="card cardPad"><div className="errorBox">VM no encontrada.</div></div></AppShell>

  const d = tabData[tab] || {}
  const statusColor = { running:'#22c55e', stopped:'#ef4444', paused:'#f59e0b' }[vm.status]||'#6b7280'
  const hasAgent = !!(vm.elastic_host_name || linkedAsset)
  const agentStatus = linkedAsset?.agent_status
  const agentColor = { online:'#22c55e', offline:'#ef4444', error:'#f59e0b' }[agentStatus]||'#6b7280'

  return (
    <AppShell
      title={vm.name}
      subtitle={`VMID ${vm.vmid} · ${vm.node} · Pool: ${vm.pool_id||'—'}`}
      actions={
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btnSecondary" onClick={()=>router.push('/vms')}>← VMs</button>
          {hasAgent && vm.os_type==='windows' && (
            <button className="btn btnSecondary"
              style={{ background:'rgba(139,92,246,0.15)', borderColor:'rgba(139,92,246,0.4)', color:'#c4b5fd' }}
              onClick={()=> linkedAsset ? router.push(`/assets/${linkedAsset.id}/veeam`) : null}>
              Veeam Jobs
            </button>
          )}
          {hasAgent && linkedAsset && (
            <button className="btn btnSecondary"
              onClick={()=>router.push(`/assets/${linkedAsset.id}`)}>
              Ver en Activos ↗
            </button>
          )}
          <button className="btn btnPrimary"
            onClick={async()=>{
              const res = await fetch(`/api/vms/${vmid}/console`,{ method:'POST', headers:{ Authorization:`Bearer ${localStorage.getItem('token')}` } })
              const data = await res.json()
              if(data?.url) window.open(data.url,'_blank','noopener,noreferrer')
            }}>
            Consola
          </button>
        </div>
      }
    >
      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.25}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:.5}}
        .svc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:10px}
        .th-cell{text-align:left;padding:8px 10px;font-size:11px;color:#b8abd9;font-weight:600;border-bottom:1px solid #3b2d63}
      `}</style>

      {/* Header VM */}
      {card(
        <div style={{ display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
          {/* Estado Proxmox */}
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ width:12, height:12, borderRadius:'50%', background:statusColor, display:'inline-block', animation:'blink 2s infinite' }} />
            <span style={{ fontSize:16, fontWeight:800, color:'#f3edff' }}>{vm.name}</span>
            <span style={{ background:statusColor+'22', color:statusColor, border:`1px solid ${statusColor}44`, borderRadius:999, padding:'2px 10px', fontSize:12, fontWeight:700 }}>
              {vm.status}
            </span>
          </div>
          {/* Specs Proxmox */}
          <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
            {[
              { l:'vCPU', v:`${vm.cpu}` },
              { l:'RAM', v:fmtBytes(vm.memory) },
              { l:'Disco', v:fmtBytes(vm.disk) },
              { l:'OS', v:vm.os_type||'?' },
            ].map(i=>(
              <div key={i.l}>
                <div style={{ fontSize:10, color:'#b8abd9', textTransform:'uppercase', letterSpacing:'0.06em' }}>{i.l}</div>
                <div style={{ fontSize:13, fontWeight:600, color:'#f3edff' }}>{i.v}</div>
              </div>
            ))}
          </div>
          {/* Estado agente Fleet */}
          <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:10 }}>
            {hasAgent ? (
              <div style={{ display:'flex', alignItems:'center', gap:8, background:agentColor+'15', border:`1px solid ${agentColor}33`, borderRadius:10, padding:'6px 12px' }}>
                <span style={{ width:8, height:8, borderRadius:'50%', background:agentColor, animation:'pulse 2s infinite' }} />
                <div>
                  <div style={{ fontSize:11, color:'#b8abd9' }}>Elastic Agent</div>
                  <div style={{ fontSize:12, fontWeight:700, color:agentColor }}>{agentStatus||'vinculado'}</div>
                </div>
              </div>
            ) : (
              <div style={{ display:'flex', alignItems:'center', gap:8, background:'rgba(107,114,128,0.1)', border:'1px solid rgba(107,114,128,0.3)', borderRadius:10, padding:'6px 12px' }}>
                <span style={{ width:8, height:8, borderRadius:'50%', background:'#6b7280' }} />
                <div>
                  <div style={{ fontSize:11, color:'#b8abd9' }}>Sin agente</div>
                  <div style={{ fontSize:12, color:'#6b7280' }}>Solo Proxmox</div>
                </div>
              </div>
            )}
          </div>
        </div>,
        { marginBottom:16 }
      )}

      {/* Sin agente: mostrar solo datos de Proxmox */}
      {!hasAgent && <ProxmoxOnlyPanel vm={vm} />}

      {/* Con agente: UI completa con tabs */}
      {hasAgent && (<>
        {/* Tabs */}
        <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:20 }}>
          {Object.entries(TABS).map(([k,v])=>(
            <button key={k} className={`tabBtn ${tab===k?'active':''}`} onClick={()=>setTab(k)}>{v}</button>
          ))}
          <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:12 }}>
            {lastRefresh && (
              <span style={{ fontSize:12, color:'#b8abd9', display:'flex', alignItems:'center', gap:5 }}>
                <span style={{ width:7, height:7, borderRadius:'50%', background:'#22c55e', display:'inline-block', animation:'pulse 2s infinite' }} />
                {tab==='overview'?'Live 3s':'Live 10s'} · {lastRefresh.toLocaleTimeString('es-MX')}
              </span>
            )}
            {tab==='security' && (
              <button className="btn btnSecondary" style={{ fontSize:12, padding:'6px 12px' }} onClick={()=>setShowExport(true)}>Exportar PDF</button>
            )}
          </div>
        </div>

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
                <div style={{ fontSize:40, fontWeight:800, color:d.errorCount24h>0?'#f59e0b':'#22c55e', lineHeight:1 }}>{d.errorCount24h??'—'}</div>
                <div style={{ fontSize:12, color:'#b8abd9', marginTop:6 }}>Errores 24h</div>
              </div>
            </div>
            {/* Specs de Proxmox dentro del overview */}
            <div style={{ borderTop:'1px solid rgba(59,45,99,0.4)', marginTop:16, paddingTop:16, display:'flex', gap:20, flexWrap:'wrap' }}>
              {[
                { l:'vCPU asignadas', v:`${vm.cpu} núcleos` },
                { l:'RAM asignada', v:fmtBytes(vm.memory) },
                { l:'Disco asignado', v:fmtBytes(vm.disk) },
                { l:'Último check-in', v:ts(linkedAsset?.last_checkin_at) },
                { l:'Versión agente', v:linkedAsset?.agent_version||'—' },
                { l:'OS', v:linkedAsset?.os_name||vm.os_type||'—' },
              ].map(i=>(
                <div key={i.l}>
                  <div style={{ fontSize:10, color:'#b8abd9', textTransform:'uppercase' }}>{i.l}</div>
                  <div style={{ fontSize:13, fontWeight:600, color:'#f3edff', marginTop:2 }}>{i.v}</div>
                </div>
              ))}
            </div>
          </>, { marginBottom:16 })}

          {cpuHistory.length > 3 && card(<>
            {secTitle('Tendencia en tiempo real')}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
              <AreaChart history={cpuHistory} color="#8b5cf6" label={`CPU — actual: ${fmtPct(d.cpuAvgPct)}`} />
              <AreaChart history={memHistory} color="#06b6d4" label={`Memoria — actual: ${fmtPct(d.memoryUsedPct)}`} />
            </div>
          </>, { marginBottom:16 })}

          {card(<>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
              {secTitle('Errores recientes')}
              <span style={{ fontSize:12, color:'#b8abd9', marginBottom:12 }}>Visto: {ts(d.lastSeen)}</span>
            </div>
            {!d.recentErrors?.length ? (
              <div style={{ color:'#22c55e', fontSize:13 }}>Sin errores recientes</div>
            ) : (
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
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
                <div style={{ fontSize:30, fontWeight:800, color:k.c, lineHeight:1 }}>{k.v??'—'}</div>
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
                      <td style={{ padding:'8px 10px', fontSize:12, color:'#f3edff', fontWeight:600 }}>{r.user||'—'}</td>
                      <td style={{ padding:'8px 10px', fontSize:12, color:'#ef4444' }}>{r.sourceIp||'—'}</td>
                      <td style={{ padding:'8px 10px', fontSize:11, color:'#b8abd9', maxWidth:300 }}>
                        <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', display:'block', maxWidth:280 }} title={r.message}>{r.message||'—'}</span>
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
          {!d.rows?.length ? card(<div className="emptyState">Sin servicios detectados.</div>) : (<>
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
          </>)}
        </>)}

        {/* EVENTS */}
        {!loadingTab && d.enabled!==false && tab==='events' && card(<>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
            {secTitle('Eventos recientes')}
            <span style={{ fontSize:11, color:'#6b7280' }}>24h · m\u00e1x 100</span>
          </div>
          {!(d.rows||[]).length ? <div style={{ color:'#b8abd9', fontSize:13 }}>Sin eventos.</div> : (
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead><tr>{['Fecha','Nivel','Canal / Dataset','Mensaje'].map(h=><th key={h} className="th-cell">{h}</th>)}</tr></thead>
                <tbody>{(d.rows||[]).map((r,i)=><EventRow key={i} row={r} />)}</tbody>
              </table>
            </div>
          )}
        </>)}

        {/* Export modal */}
        {showExport && (
          <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <div className="card cardPad" style={{ width:400, maxWidth:'90vw' }}>
              <div className="sectionTitle" style={{ marginBottom:16 }}>Exportar reporte de seguridad</div>
              <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:16 }}>
                <button className="btn btnSecondary" onClick={()=>setShowExport(false)}>Cancelar</button>
                <button className="btn btnPrimary" onClick={()=>setShowExport(false)}>Cerrar</button>
              </div>
            </div>
          </div>
        )}
      </>)}
    </AppShell>
  )
}