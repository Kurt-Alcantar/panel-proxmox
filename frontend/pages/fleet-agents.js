import { useCallback, useEffect, useMemo, useState } from 'react'
import AppShell from '../components/AppShell'
import { apiJson } from '../lib/auth'

const T = { text:'#f3edff',muted:'#b8abd9',dim:'#7c6fa0',card:'#171129',card2:'#21183a',card3:'#2a1f49',border:'#3b2d63',soft:'#4c3b7f',primary:'#8b5cf6',green:'#22c55e',red:'#ef4444',amber:'#f59e0b' }
const card = { background:T.card, border:`1px solid ${T.border}`, borderRadius:16, boxShadow:'0 8px 28px rgba(0,0,0,0.3)' }
const TH   = { textAlign:'left', padding:'10px 14px', color:T.muted, fontSize:12, fontWeight:600, borderBottom:`1px solid ${T.border}` }
const TD   = { padding:'11px 14px', color:T.text, borderBottom:`1px solid ${T.border}`, fontSize:13, verticalAlign:'middle' }

export default function FleetAgentsPage() {
  const [agents,setAgents]=useState([]); const [policies,setPolicies]=useState([])
  const [loading,setLoading]=useState(true); const [error,setError]=useState('')
  const [search,setSearch]=useState(''); const [lastSync,setLastSync]=useState(null)
  const load = useCallback(async()=>{ setError(''); try{ const[a,p]=await Promise.all([apiJson('/api/fleet/agents'),apiJson('/api/fleet/policies').catch(()=>[])]); setAgents(a);setPolicies(p);setLastSync(new Date()) }catch(e){setError(e.message)}finally{setLoading(false)} },[])
  useEffect(()=>{load()},[load])
  const filtered = useMemo(()=>agents.filter(a=>{ const t=`${a.local_metadata?.host?.hostname||''} ${a.policy_id||''} ${a.status||''}`.toLowerCase(); return search?t.includes(search.toLowerCase()):true }),[agents,search])
  const policyMap = useMemo(()=>Object.fromEntries(policies.map(p=>[p.id,p.name])),[policies])
  const ts = v=>{ if(!v)return '—'; const d=new Date(v); if(isNaN(d))return '—'; const m=Math.round((Date.now()-d)/60000); if(m<1)return 'hace un momento'; if(m<60)return `hace ${m}m`; if(m<1440)return `hace ${Math.round(m/60)}h`; return d.toLocaleDateString('es-MX') }
  const online=agents.filter(a=>a.status==='online').length
  const KPI=({label,value,accent})=>(<div style={{...card,padding:'18px 20px',position:'relative',overflow:'hidden'}}><div style={{position:'absolute',top:0,left:0,right:0,height:2,background:accent}}/><div style={{fontSize:10,fontFamily:'monospace',textTransform:'uppercase',letterSpacing:'0.12em',color:T.muted,marginBottom:10}}>{label}</div><div style={{fontSize:32,fontWeight:700,letterSpacing:'-0.03em'}}>{value}</div></div>)
  return (
    <AppShell title="Fleet agents" subtitle="Inventario de agentes Fleet · sync automático cada 5 min" searchValue={search} onSearchChange={setSearch} searchPlaceholder="Buscar por host, policy, estado...">
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}`}</style>
      {error && <div style={{background:'rgba(239,68,68,0.12)',border:'1px solid rgba(239,68,68,0.35)',borderRadius:10,padding:'10px 14px',fontSize:12,color:'#fca5a5',marginBottom:16}}>{error}</div>}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:14,marginBottom:22}}>
        <KPI label="Total agentes"    value={agents.length}            accent={T.primary}/>
        <KPI label="Online"           value={online}                   accent={T.green}/>
        <KPI label="Offline / Error"  value={agents.length-online}     accent={T.red}/>
        <KPI label="Políticas activas" value={policies.length}         accent="#38bdf8"/>
      </div>
      <div style={{...card,overflow:'hidden'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'14px 18px',borderBottom:`1px solid ${T.border}`}}>
          <span style={{fontSize:14,fontWeight:700}}>Agentes registrados</span>
          <div style={{display:'flex',alignItems:'center',gap:14}}>
            <span style={{fontSize:12,color:T.dim,fontFamily:'monospace'}}>{filtered.length} agentes</span>
            {lastSync && <span style={{fontSize:11,color:T.dim,fontFamily:'monospace'}}>Último sync: {ts(lastSync)}</span>}
          </div>
        </div>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead><tr style={{background:T.card2}}>{['Host','Estado','Política','Versión','Último check-in'].map(h=><th key={h} style={TH}>{h}</th>)}</tr></thead>
            <tbody>
              {loading && <tr><td colSpan={5} style={{padding:40,textAlign:'center',color:T.muted,fontSize:13}}>Cargando agentes...</td></tr>}
              {!loading && filtered.map(agent=>{
                const host=agent.local_metadata?.host?.hostname||agent.id
                const ver=agent.local_metadata?.elastic?.agent?.version||agent.agent?.version||'—'
                const pol=policyMap[agent.policy_id]||agent.policy_id||'—'
                const ok=agent.status==='online'
                const dc=ok?T.green:agent.status==='error'?T.amber:T.red
                return (
                  <tr key={agent.id||agent.agent?.id}
                    onMouseEnter={e=>e.currentTarget.style.background=T.card2}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <td style={{...TD,fontWeight:700}}>
                      {host}
                      <div style={{fontSize:10,color:T.dim,fontFamily:'monospace',marginTop:2}}>{(agent.id||'').slice(0,20)}...</div>
                    </td>
                    <td style={TD}>
                      <span style={{display:'inline-flex',alignItems:'center',gap:6}}>
                        <span style={{width:7,height:7,borderRadius:'50%',background:dc,animation:ok?'pulse 2s infinite':'none',flexShrink:0}}/>
                        <span style={{fontSize:12,color:dc,fontFamily:'monospace',fontWeight:700}}>{agent.status||'—'}</span>
                      </span>
                    </td>
                    <td style={TD}><span style={{fontFamily:'monospace',fontSize:10,padding:'3px 8px',borderRadius:6,background:T.card3,color:T.muted,border:`1px solid ${T.border}`}}>{pol}</span></td>
                    <td style={{...TD,fontFamily:'monospace',fontSize:11,color:T.dim}}>{ver}</td>
                    <td style={{...TD,color:T.muted}}>{ts(agent.last_checkin||null)}</td>
                  </tr>
                )
              })}
              {!loading && filtered.length===0 && <tr><td colSpan={5} style={{padding:40,textAlign:'center',color:T.muted,fontSize:13}}>Sin resultados.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  )
}
