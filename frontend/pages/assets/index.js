import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import AppShell from '../../components/AppShell'
import { apiJson } from '../../lib/auth'

const T = { text:'#f3edff',muted:'#b8abd9',dim:'#7c6fa0',card:'#171129',card2:'#21183a',card3:'#2a1f49',border:'#3b2d63',soft:'#4c3b7f',inpBg:'#120d22',primary:'#8b5cf6',green:'#22c55e',red:'#ef4444',amber:'#f59e0b' }
const card  = { background:T.card,  border:`1px solid ${T.border}`, borderRadius:16, boxShadow:'0 8px 28px rgba(0,0,0,0.3)' }
const TH    = { textAlign:'left', padding:'10px 14px', color:T.muted, fontSize:12, fontWeight:600, borderBottom:`1px solid ${T.border}` }
const TD    = { padding:'11px 14px', color:T.text, borderBottom:`1px solid ${T.border}`, fontSize:13, verticalAlign:'middle' }
const STATUS = {
  online:     { label:'Online',     bg:'rgba(34,197,94,0.12)',  color:'#86efac', border:'rgba(34,197,94,0.35)' },
  offline:    { label:'Offline',    bg:'rgba(239,68,68,0.12)', color:'#fca5a5', border:'rgba(239,68,68,0.35)' },
  error:      { label:'Error',      bg:'rgba(245,158,11,0.12)',color:'#fcd34d', border:'rgba(245,158,11,0.35)' },
  unenrolled: { label:'Unenrolled', bg:'rgba(139,92,246,0.12)',color:'#c4b5fd', border:'rgba(139,92,246,0.35)' },
}
const Badge = ({ status }) => { const s=STATUS[status]||{label:status||'—',bg:'rgba(255,255,255,0.06)',color:T.muted,border:T.soft}; return <span style={{display:'inline-flex',alignItems:'center',padding:'3px 10px',borderRadius:999,fontSize:11,fontWeight:700,fontFamily:'monospace',background:s.bg,color:s.color,border:`1px solid ${s.border}`}}>{s.label}</span> }
const chip = (active) => ({ display:'inline-flex',alignItems:'center',padding:'5px 12px',borderRadius:999,fontSize:12,fontWeight:600,cursor:'pointer',border:'none',background:active?'rgba(139,92,246,0.2)':T.card3,color:active?'#c4b5fd':T.muted,outline:active?'1px solid rgba(139,92,246,0.4)':'none' })

export default function AssetsPage() {
  const router = useRouter()
  const [assets,setAssets]=useState([]); const [loading,setLoading]=useState(true)
  const [error,setError]=useState(''); const [search,setSearch]=useState('')
  const [sf,setSf]=useState('all'); const [of,setOf]=useState('all')
  const load = useCallback(async () => { setLoading(true);setError(''); try{setAssets(await apiJson('/api/assets')||[])}catch(e){setError(e.message)}finally{setLoading(false)} },[])
  useEffect(()=>{load()},[load])
  const stats = useMemo(()=>({ total:assets.length, online:assets.filter(a=>a.agent_status==='online').length, offline:assets.filter(a=>a.agent_status==='offline').length, error:assets.filter(a=>a.agent_status==='error').length }),[assets])
  const rows = useMemo(()=>{ let r=assets; if(sf!=='all')r=r.filter(a=>a.agent_status===sf); if(of!=='all')r=r.filter(a=>(a.os_type||'').toLowerCase()===of); if(search){const q=search.toLowerCase();r=r.filter(a=>`${a.display_name||''} ${a.host_name||''} ${a.fleet_policy_name||''} ${(a.ip_addresses||[]).join(' ')}`.toLowerCase().includes(q))} return r },[assets,sf,of,search])
  const ts = v => v ? new Date(v).toLocaleDateString('es-MX') : '—'
  const KPI = ({label,value,accent}) => (
    <div style={{...card,padding:'18px 20px',position:'relative',overflow:'hidden'}}>
      <div style={{position:'absolute',top:0,left:0,right:0,height:2,background:accent}}/>
      <div style={{fontSize:10,fontFamily:'monospace',textTransform:'uppercase',letterSpacing:'0.12em',color:T.muted,marginBottom:10}}>{label}</div>
      <div style={{fontSize:32,fontWeight:700,letterSpacing:'-0.03em'}}>{value}</div>
    </div>
  )
  return (
    <AppShell title="Activos monitoreados" subtitle="Hosts con agente Fleet activo bajo observabilidad" searchValue={search} onSearchChange={setSearch} searchPlaceholder="Buscar por nombre, IP, policy...">
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:14,marginBottom:22}}>
        <KPI label="Total activos" value={stats.total}   accent={T.primary} />
        <KPI label="Online"        value={stats.online}  accent={T.green} />
        <KPI label="Offline"       value={stats.offline} accent={T.red} />
        <KPI label="Error"         value={stats.error}   accent={T.amber} />
      </div>
      {error && <div style={{background:'rgba(239,68,68,0.12)',border:'1px solid rgba(239,68,68,0.35)',borderRadius:10,padding:'10px 14px',fontSize:12,color:'#fca5a5',marginBottom:16}}>{error}</div>}
      <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center',marginBottom:16}}>
        <div style={{display:'flex',gap:4,background:T.card2,borderRadius:10,padding:4}}>
          {[['all','Todos'],['online','Online'],['offline','Offline'],['error','Error'],['unenrolled','Unenrolled']].map(([v,l])=><button key={v} style={chip(sf===v)} onClick={()=>setSf(v)}>{l}</button>)}
        </div>
        <div style={{display:'flex',gap:4,background:T.card2,borderRadius:10,padding:4}}>
          {[['all','OS'],['windows','Windows'],['linux','Linux']].map(([v,l])=><button key={v} style={chip(of===v)} onClick={()=>setOf(v)}>{l}</button>)}
        </div>
        <span style={{marginLeft:'auto',fontSize:12,color:T.dim,fontFamily:'monospace'}}>{rows.length} activos</span>
      </div>
      {loading ? <div style={{...card,padding:40,textAlign:'center',color:T.muted,fontSize:13}}>Cargando activos...</div>
      : rows.length===0 ? <div style={{...card,padding:40,textAlign:'center',color:T.muted,fontSize:13}}>Sin activos{search||sf!=='all'?' con ese criterio':''}.</div>
      : <div style={{...card,overflow:'hidden'}}><div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead><tr style={{background:T.card2}}>
              {['Nombre','Estado','OS','Versión agente','Último check-in','IPs','Policy'].map(h=><th key={h} style={TH}>{h}</th>)}
            </tr></thead>
            <tbody>{rows.map(a=>(
              <tr key={a.id} style={{cursor:'pointer'}} onClick={()=>router.push(`/assets/${a.id}`)}
                onMouseEnter={e=>e.currentTarget.style.background=T.card2}
                onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                <td style={{...TD,fontWeight:700}}>{a.display_name||a.host_name||`Agent ${a.fleet_agent_id?.slice(0,8)||'—'}`}</td>
                <td style={TD}><Badge status={a.agent_status}/></td>
                <td style={{...TD,color:T.muted}}>{a.os_name||a.os_type||'—'}</td>
                <td style={{...TD,fontFamily:'monospace',fontSize:11,color:T.dim}}>{a.agent_version||'—'}</td>
                <td style={{...TD,color:T.muted}}>{ts(a.last_checkin_at)}</td>
                <td style={{...TD,fontFamily:'monospace',fontSize:11,color:T.dim}}>{(a.ip_addresses||[]).slice(0,2).join(', ')||'—'}</td>
                <td style={TD}>{a.fleet_policy_name?<span style={{fontFamily:'monospace',fontSize:10,padding:'3px 8px',borderRadius:6,background:T.card3,color:T.muted,border:`1px solid ${T.border}`}}>{a.fleet_policy_name}</span>:<span style={{color:T.dim}}>—</span>}</td>
              </tr>
            ))}</tbody>
          </table>
        </div></div>}
    </AppShell>
  )
}
