import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import AppShell from '../components/AppShell'
import { apiJson, clearSession } from '../lib/auth'

const T = { text:'#f3edff',muted:'#b8abd9',dim:'#7c6fa0',card:'#171129',card2:'#21183a',card3:'#2a1f49',border:'#3b2d63',soft:'#4c3b7f',primary:'#8b5cf6',green:'#22c55e',red:'#ef4444' }
const card  = { background:T.card,  border:`1px solid ${T.border}`, borderRadius:16, boxShadow:'0 8px 28px rgba(0,0,0,0.3)' }
const TH    = { textAlign:'left', padding:'9px 14px', color:T.muted, fontSize:12, fontWeight:600, borderBottom:`1px solid ${T.border}` }
const TD    = { padding:'9px 14px', color:T.text, borderBottom:`1px solid ${T.border}`, fontSize:13 }

export default function GruposPage() {
  const router = useRouter()
  const [pools,setPools]=useState([]); const [vms,setVms]=useState([])
  const [loading,setLoading]=useState(true); const [error,setError]=useState('')
  const [query,setQuery]=useState(''); const [expanded,setExpanded]=useState({})
  const load = useCallback(async()=>{ setLoading(true);setError(''); try{ const[p,v]=await Promise.all([apiJson('/api/pools').catch(()=>apiJson('/api/infra/pools').catch(()=>[])),apiJson('/api/my/vms').catch(()=>[])]); setPools(p);setVms(v) }catch(e){if(e.message==='AUTH_EXPIRED'){clearSession();router.replace('/login');return};setError(e.message)}finally{setLoading(false)} },[router])
  useEffect(()=>{load()},[load])
  const rows = useMemo(()=>{
    const g=new Map(); pools.forEach(p=>g.set(p.external_id||p.name,{...p,vms:[]}))
    vms.forEach(vm=>{ const k=vm.pool_id||'Sin grupo'; if(!g.has(k))g.set(k,{id:k,name:k,external_id:k,vms:[]}); g.get(k).vms.push(vm) })
    return [...g.values()].filter(i=>query?`${i.name} ${i.external_id}`.toLowerCase().includes(query.toLowerCase()):true).sort((a,b)=>b.vms.length-a.vms.length)
  },[pools,vms,query])
  const toggle=k=>setExpanded(p=>({...p,[k]:!p[k]}))
  const KPI=({label,value,accent})=>(<div style={{...card,padding:'18px 20px',position:'relative',overflow:'hidden'}}><div style={{position:'absolute',top:0,left:0,right:0,height:2,background:accent}}/><div style={{fontSize:10,fontFamily:'monospace',textTransform:'uppercase',letterSpacing:'0.12em',color:T.muted,marginBottom:10}}>{label}</div><div style={{fontSize:32,fontWeight:700,letterSpacing:'-0.03em'}}>{value}</div></div>)
  return (
    <AppShell title="Grupos" subtitle="Agrupación de VMs Proxmox por grupo de infraestructura" searchValue={query} onSearchChange={setQuery} searchPlaceholder="Buscar grupo...">
      {error && <div style={{background:'rgba(239,68,68,0.12)',border:'1px solid rgba(239,68,68,0.35)',borderRadius:10,padding:'10px 14px',fontSize:12,color:'#fca5a5',marginBottom:16}}>{error}</div>}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:14,marginBottom:22}}>
        <KPI label="Total grupos" value={rows.length}                              accent={T.primary}/>
        <KPI label="Total VMs"    value={vms.length}                               accent="#38bdf8"/>
        <KPI label="Running"      value={vms.filter(v=>v.status==='running').length} accent={T.green}/>
        <KPI label="Stopped"      value={vms.filter(v=>v.status!=='running').length} accent={T.red}/>
      </div>
      {loading ? <div style={{...card,padding:40,textAlign:'center',color:T.muted}}>Cargando grupos...</div> : (
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          {rows.map(pool=>{
            const k=pool.external_id||pool.name; const open=expanded[k]
            const running=pool.vms.filter(v=>v.status==='running').length
            return (
              <div key={k} style={card}>
                <div style={{display:'flex',alignItems:'center',gap:14,padding:'16px 20px',cursor:'pointer'}} onClick={()=>toggle(k)}>
                  <span style={{color:T.dim,fontSize:12,transform:open?'rotate(90deg)':'none',transition:'transform .2s',display:'inline-block',flexShrink:0}}>▶</span>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,fontSize:15,color:T.text}}>{pool.name}</div>
                    <div style={{fontSize:11,color:T.dim,fontFamily:'monospace',marginTop:2}}>{pool.external_id}</div>
                  </div>
                  <div style={{display:'flex',gap:20,alignItems:'center'}}>
                    <div style={{textAlign:'center'}}>
                      <div style={{fontSize:10,fontFamily:'monospace',color:T.muted,marginBottom:3}}>VMS</div>
                      <div style={{fontSize:20,fontWeight:700}}>{pool.vms.length}</div>
                    </div>
                    <div style={{textAlign:'center'}}>
                      <div style={{fontSize:10,fontFamily:'monospace',color:T.muted,marginBottom:3}}>RUNNING</div>
                      <div style={{fontSize:20,fontWeight:700,color:T.green}}>{running}</div>
                    </div>
                    <span style={{padding:'4px 12px',borderRadius:999,fontSize:11,fontWeight:700,fontFamily:'monospace',background:running>0?'rgba(34,197,94,0.12)':'rgba(255,255,255,0.05)',color:running>0?'#86efac':T.dim,border:`1px solid ${running>0?'rgba(34,197,94,0.35)':T.border}`}}>{running>0?'activo':'inactivo'}</span>
                  </div>
                </div>
                {open && (
                  <div style={{borderTop:`1px solid ${T.border}`}}>
                    {pool.vms.length===0 ? <div style={{padding:20,textAlign:'center',color:T.dim,fontSize:13}}>Sin VMs asignadas</div> : (
                      <table style={{width:'100%',borderCollapse:'collapse'}}>
                        <thead><tr style={{background:T.card2}}>{['VM','VMID','Nodo','Estado'].map(h=><th key={h} style={TH}>{h}</th>)}</tr></thead>
                        <tbody>{pool.vms.map(vm=>(
                          <tr key={vm.vmid} style={{cursor:'pointer'}}
                            onMouseEnter={e=>e.currentTarget.style.background=T.card2}
                            onMouseLeave={e=>e.currentTarget.style.background='transparent'}
                            onClick={()=>router.push(`/vms/${vm.vmid}`)}>
                            <td style={{...TD,fontWeight:700}}>{vm.name||`VM ${vm.vmid}`}</td>
                            <td style={{...TD,fontFamily:'monospace',fontSize:11,color:T.dim}}>{vm.vmid}</td>
                            <td style={{...TD,color:T.muted}}>{vm.node||'—'}</td>
                            <td style={TD}><span style={{fontSize:11,fontWeight:700,fontFamily:'monospace',color:vm.status==='running'?T.green:T.red}}>{vm.status||'—'}</span></td>
                          </tr>
                        ))}</tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            )
          })}
          {rows.length===0 && <div style={{...card,padding:40,textAlign:'center',color:T.muted}}>Sin grupos disponibles.</div>}
        </div>
      )}
    </AppShell>
  )
}
