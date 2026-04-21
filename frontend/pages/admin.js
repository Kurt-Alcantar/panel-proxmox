import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import AppShell from '../components/AppShell'

const T = {
  text:'#f3edff', muted:'#b8abd9', dim:'#7c6fa0',
  card:'#171129', card2:'#21183a', card3:'#2a1f49',
  border:'#3b2d63', soft:'#4c3b7f', inpBg:'#120d22',
  primary:'#8b5cf6', green:'#22c55e', red:'#ef4444', amber:'#f59e0b',
  successBg:'rgba(34,197,94,0.12)', successBorder:'rgba(34,197,94,0.35)', successText:'#86efac',
  errorBg:'rgba(239,68,68,0.12)', errorBorder:'rgba(239,68,68,0.35)', errorText:'#fca5a5',
}
const cardStyle     = { background:T.card, borderRadius:16, padding:18, border:`1px solid ${T.border}`, boxShadow:'0 14px 34px rgba(0,0,0,0.35)' }
const inputStyle    = { width:'100%', border:`1px solid ${T.soft}`, borderRadius:10, padding:'10px 12px', fontSize:14, background:T.inpBg, color:T.text, outline:'none' }
const textareaStyle = { ...inputStyle, minHeight:88, resize:'vertical' }
const labelStyle    = { display:'grid', gap:6, fontSize:13, color:T.muted }
const buttonStyle   = { border:'none', borderRadius:10, padding:'10px 14px', background:T.primary, color:'#fff', cursor:'pointer', fontWeight:700 }
const altButtonStyle    = { ...buttonStyle, background:'#6d28d9' }
const ghostButtonStyle  = { ...buttonStyle, background:T.card3, color:T.text, border:`1px solid ${T.soft}` }
const dangerButtonStyle = { ...buttonStyle, background:'#b91c1c' }
const successBoxStyle   = { background:T.successBg, color:T.successText, border:`1px solid ${T.successBorder}`, padding:14, borderRadius:12 }
const errorBoxStyle     = { background:T.errorBg,   color:T.errorText,   border:`1px solid ${T.errorBorder}`,  padding:14, borderRadius:12 }
const TH = { textAlign:'left', padding:'10px 12px', color:T.muted, fontSize:12, fontWeight:600, borderBottom:`1px solid ${T.border}`, background:T.card2 }
const TD = { padding:'10px 12px', color:T.text, borderBottom:`1px solid ${T.border}`, fontSize:13, verticalAlign:'middle' }
const chip = (active) => ({ display:'inline-flex', alignItems:'center', gap:5, padding:'6px 14px', borderRadius:999, fontSize:12, fontWeight:600, cursor:'pointer', border:'none', background:active?'rgba(139,92,246,0.2)':T.card3, color:active?'#c4b5fd':T.muted, outline:active?'1px solid rgba(139,92,246,0.4)':'none' })

function Field({ label, children }) { return <label style={labelStyle}><span>{label}</span>{children}</label> }
function TypeBadge({ type }) {
  const cfg = { platform:{bg:'rgba(139,92,246,0.15)',color:'#c4b5fd',border:'rgba(139,92,246,0.4)'}, partner:{bg:'rgba(59,130,246,0.15)',color:'#93c5fd',border:'rgba(59,130,246,0.4)'}, client:{bg:'rgba(34,197,94,0.12)',color:'#86efac',border:'rgba(34,197,94,0.35)'} }
  const s = cfg[type]||{bg:T.card3,color:T.muted,border:T.border}
  return <span style={{ fontSize:10, fontWeight:700, padding:'3px 8px', borderRadius:6, fontFamily:'monospace', background:s.bg, color:s.color, border:`1px solid ${s.border}` }}>{type}</span>
}

function Wizard({ title, steps, onClose, onFinish }) {
  const [step,setStep]=useState(0); const [data,setData]=useState({}); const [busy,setBusy]=useState(false); const [err,setErr]=useState('')
  const cur=steps[step]; const isLast=step===steps.length-1
  const next=async(sd)=>{ setErr(''); const m={...data,...sd}; setData(m); if(isLast){setBusy(true);try{await onFinish(m);onClose()}catch(e){setErr(e.message||'Error')}finally{setBusy(false)}}else{setStep(s=>s+1)} }
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <div style={{...cardStyle,width:'100%',maxWidth:520,padding:0}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'16px 20px',borderBottom:`1px solid ${T.border}`}}>
          <div><div style={{fontWeight:700,fontSize:15}}>{title}</div><div style={{fontSize:11,color:T.dim,fontFamily:'monospace',marginTop:3}}>Paso {step+1} de {steps.length} · {cur.label}</div></div>
          <button onClick={onClose} style={{background:'none',border:'none',color:T.muted,cursor:'pointer',fontSize:20,lineHeight:1}}>×</button>
        </div>
        <div style={{display:'flex',gap:4,padding:'12px 20px 0'}}>
          {steps.map((_,i)=><div key={i} style={{flex:1,height:2,borderRadius:2,background:i<=step?T.primary:T.border,transition:'background .2s'}}/>)}
        </div>
        <div style={{padding:20}}>
          {err && <div style={{...errorBoxStyle,marginBottom:14,fontSize:12}}>{err}</div>}
          <cur.Component data={data} onNext={next} onBack={step>0?()=>{setErr('');setStep(s=>s-1)}:null} busy={busy}/>
        </div>
      </div>
    </div>
  )
}

const TenantStep1=({data,onNext})=>{ const [f,setF]=useState({code:data.code||'',name:data.name||'',type:data.type||'client'}); const s=k=>e=>setF(p=>({...p,[k]:e.target.value})); return(<div style={{display:'grid',gap:14}}><Field label="Tipo *"><select style={inputStyle} value={f.type} onChange={s('type')}><option value="partner">Partner — ve activos de sus clientes</option><option value="client">Cliente final — ve solo sus activos</option></select></Field><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}><Field label="Código *"><input style={inputStyle} value={f.code} onChange={s('code')} placeholder="CONESTRA"/></Field><Field label="Nombre *"><input style={inputStyle} value={f.name} onChange={s('name')} placeholder="Conestra S.A."/></Field></div><div style={{display:'flex',justifyContent:'flex-end'}}><button style={buttonStyle} onClick={()=>{if(f.code&&f.name)onNext(f)}}>Siguiente →</button></div></div>) }
const TenantStep2=({data,onNext,onBack,tenants})=>{ const [pid,setPid]=useState(data.parent_tenant_id||''); const partners=(tenants||[]).filter(t=>t.type==='partner'||t.type==='platform'); return(<div style={{display:'grid',gap:14}}>{data.type==='client'&&<Field label="Partner padre *"><select style={inputStyle} value={pid} onChange={e=>setPid(e.target.value)}><option value="">Selecciona</option>{partners.map(t=><option key={t.id} value={t.id}>{t.name} ({t.type})</option>)}</select></Field>}<div style={{background:T.card2,border:`1px solid ${T.border}`,borderRadius:10,padding:14}}>{[['Tipo',data.type],['Código',data.code],['Nombre',data.name],...(data.type==='client'&&pid?[['Partner',partners.find(t=>t.id===pid)?.name||'—']]:[])].map(([k,v])=><div key={k} style={{display:'flex',justifyContent:'space-between',fontSize:13,marginTop:6}}><span style={{color:T.muted}}>{k}</span><strong>{v}</strong></div>)}</div><div style={{display:'flex',justifyContent:'space-between'}}><button style={ghostButtonStyle} onClick={onBack}>← Atrás</button><button style={buttonStyle} onClick={()=>{if(data.type!=='client'||pid)onNext({parent_tenant_id:pid||null,status:'ACTIVE'})}}>Crear tenant ✓</button></div></div>) }
const UserStep1=({data,onNext})=>{ const [f,setF]=useState({username:data.username||'',email:data.email||'',firstName:data.firstName||'',lastName:data.lastName||'',password:data.password||''}); const s=k=>e=>setF(p=>({...p,[k]:e.target.value})); const ok=f.username&&f.email&&f.password.length>=8; return(<div style={{display:'grid',gap:12}}><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}><Field label="Nombre"><input style={inputStyle} value={f.firstName} onChange={s('firstName')} placeholder="Kurt"/></Field><Field label="Apellidos"><input style={inputStyle} value={f.lastName} onChange={s('lastName')} placeholder="Alcantar"/></Field></div><Field label="Username *"><input style={inputStyle} value={f.username} onChange={s('username')} placeholder="k.alcantar"/></Field><Field label="Email *"><input style={inputStyle} type="email" value={f.email} onChange={s('email')} placeholder="k@empresa.com"/></Field><Field label="Contraseña inicial * (mín. 8)"><input style={inputStyle} type="password" value={f.password} onChange={s('password')}/></Field><div style={{display:'flex',justifyContent:'flex-end'}}><button style={{...buttonStyle,opacity:ok?1:.5}} onClick={()=>{if(ok)onNext(f)}}>Siguiente →</button></div></div>) }
const UserStep2=({data,onNext,onBack,tenants,roles})=>{ const [tid,setTid]=useState(data.tenant_id||''); const [rids,setRids]=useState(data.role_ids||[]); const tog=id=>setRids(p=>p.includes(id)?p.filter(r=>r!==id):[...p,id]); return(<div style={{display:'grid',gap:14}}><Field label="Tenant *"><select style={inputStyle} value={tid} onChange={e=>setTid(e.target.value)}><option value="">Selecciona un tenant</option>{(tenants||[]).map(t=><option key={t.id} value={t.id}>{t.name} ({t.type||'client'})</option>)}</select></Field><div><div style={{fontSize:12,color:T.muted,marginBottom:8}}>Roles *</div><div style={{display:'flex',gap:6,flexWrap:'wrap'}}>{(roles||[]).map(r=><button key={r.id} style={chip(rids.includes(r.id))} onClick={()=>tog(r.id)}>{r.code}</button>)}</div></div><div style={{display:'flex',justifyContent:'space-between'}}><button style={ghostButtonStyle} onClick={onBack}>← Atrás</button><button style={{...buttonStyle,opacity:(tid&&rids.length)?1:.5}} onClick={()=>{if(tid&&rids.length)onNext({tenant_id:tid,role_ids:rids})}}>Siguiente →</button></div></div>) }
const UserStep3=({data,onNext,onBack,tenants,roles,busy})=>{ const t=(tenants||[]).find(x=>x.id===data.tenant_id); const rs=(roles||[]).filter(r=>(data.role_ids||[]).includes(r.id)); return(<div style={{display:'grid',gap:14}}><div style={{background:T.card2,border:`1px solid ${T.border}`,borderRadius:10,padding:14}}>{[['Nombre',[data.firstName,data.lastName].filter(Boolean).join(' ')||'—'],['Username',data.username],['Email',data.email],['Tenant',t?`${t.name} (${t.type})`:'—'],['Roles',rs.map(r=>r.code).join(', ')||'—']].map(([k,v])=><div key={k} style={{display:'flex',justifyContent:'space-between',fontSize:13,marginTop:8}}><span style={{color:T.muted}}>{k}</span><strong>{v}</strong></div>)}</div><div style={{display:'flex',justifyContent:'space-between'}}><button style={ghostButtonStyle} onClick={onBack} disabled={busy}>← Atrás</button><button style={buttonStyle} onClick={()=>onNext({})} disabled={busy}>{busy?'Creando...':'Crear usuario ✓'}</button></div></div>) }

const emptyBootstrap={tenants:[],tenantGroups:[],pools:[],roles:[],users:[],vms:[]}
const emptyTenantForm={id:'',code:'',name:'',status:'ACTIVE',type:'client',parent_tenant_id:''}
const emptyTenantGroupForm={id:'',tenant_id:'',code:'',name:''}
const emptyUserForm={id:'',username:'',email:'',firstName:'',lastName:'',password:'',tenant_id:'',tenant_group_id:'',role_ids:[],enabled:true}
const emptyVmForm={vmid:'',name:'',node:'',pool_id:'',tenant_id:'',tenant_group_id:'',status:'',os_type:'',elastic_host_name:'',kibana_base_url:'',monitored_services:'',observability_enabled:false}

export default function AdminPage() {
  const router=useRouter()
  const [loading,setLoading]=useState(true); const [busy,setBusy]=useState(false)
  const [data,setData]=useState(emptyBootstrap); const [error,setError]=useState(''); const [success,setSuccess]=useState('')
  const [assets,setAssets]=useState([]); const [poolGroupId,setPoolGroupId]=useState('')
  const [selectedPoolIds,setSelectedPoolIds]=useState([]); const [tenantForm,setTenantForm]=useState(emptyTenantForm)
  const [tenantGroupForm,setTenantGroupForm]=useState(emptyTenantGroupForm); const [userForm,setUserForm]=useState(emptyUserForm)
  const [vmSearch,setVmSearch]=useState(''); const [selectedVmId,setSelectedVmId]=useState(''); const [vmForm,setVmForm]=useState(emptyVmForm)
  const [activeTab,setActiveTab]=useState('tenants'); const [wizard,setWizard]=useState(null)

  const clearMessages=()=>{setError('');setSuccess('')}
  const redirectToLogin=()=>{ if(typeof window!=='undefined'){localStorage.removeItem('token');localStorage.removeItem('refresh_token')} router.replace('/login') }

  const fetchWithRefresh=async(url,options={})=>{ if(typeof window==='undefined')throw new Error('Solo en navegador'); const at=localStorage.getItem('token'); const rt=localStorage.getItem('refresh_token'); if(!at&&!rt){redirectToLogin();throw new Error('Sesión no disponible')} const attempt=async(t)=>fetch(url,{...options,headers:{'Content-Type':'application/json',...(options.headers||{}),...(t?{Authorization:`Bearer ${t}`}:{})}}); let res=await attempt(at); if(res.status!==401)return res; if(!rt){redirectToLogin();throw new Error('Sesión expirada')} const rr=await fetch('/api/auth/refresh',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({refresh_token:rt})}); const rd=await rr.json().catch(()=>({})); if(!rr.ok||!rd.access_token){redirectToLogin();throw new Error('No se pudo refrescar')} localStorage.setItem('token',rd.access_token); localStorage.setItem('refresh_token',rd.refresh_token||rt); return attempt(rd.access_token) }

  const request=async(url,options={})=>{ const res=await fetchWithRefresh(url,options); const text=await res.text(); let payload=null; try{payload=text?JSON.parse(text):null}catch{payload=text} if(!res.ok)throw new Error(payload?.message||payload?.error||payload||`HTTP ${res.status}`); return payload }

  const refreshData=async()=>{ clearMessages();setLoading(true); try{ const[bootstrap,assetList]=await Promise.all([request('/api/admin/bootstrap'),request('/api/admin/assets').catch(()=>[])]); setData(bootstrap||emptyBootstrap); setAssets(Array.isArray(assetList)?assetList:[]); const ntg=bootstrap?.tenantGroups||[]; const nv=bootstrap?.vms||[]; setTenantGroupForm(c=>({...c,tenant_id:c.tenant_id||bootstrap?.tenants?.[0]?.id||''})); setUserForm(c=>({...c,tenant_group_id:c.tenant_group_id||ntg[0]?.id||''})); const rpg=poolGroupId&&ntg.some(g=>g.id===poolGroupId)?poolGroupId:ntg[0]?.id||''; setPoolGroupId(rpg); setSelectedPoolIds((ntg.find(g=>g.id===rpg)?.pools||[]).map(p=>p.id)); const rv=selectedVmId&&nv.some(v=>String(v.vmid)===String(selectedVmId))?selectedVmId:nv[0]?.vmid?String(nv[0].vmid):''; setSelectedVmId(rv) }catch(err){setError(err.message||'No se pudo cargar')}finally{setLoading(false)} }

  useEffect(()=>{ if(typeof window==='undefined')return; const tk=localStorage.getItem('token'); const rt=localStorage.getItem('refresh_token'); if(!tk&&!rt){router.replace('/login');return} refreshData() },[])
  useEffect(()=>{ const g=data.tenantGroups.find(i=>i.id===poolGroupId); setSelectedPoolIds((g?.pools||[]).map(p=>p.id)) },[poolGroupId,data.tenantGroups])
  useEffect(()=>{ const vm=data.vms.find(i=>String(i.vmid)===String(selectedVmId)); if(!vm)return; setVmForm({vmid:String(vm.vmid),name:vm.name||'',node:vm.node||'',pool_id:vm.pool_id||'',tenant_id:vm.tenant_id||'',tenant_group_id:vm.tenant_group_id||'',status:vm.status||'',os_type:vm.os_type||'',elastic_host_name:vm.elastic_host_name||'',kibana_base_url:vm.kibana_base_url||'',monitored_services:vm.monitored_services||'',observability_enabled:!!vm.observability_enabled}) },[selectedVmId,data.vms])

  const to=data.tenants||[]; const tgo=data.tenantGroups||[]; const po=data.pools||[]; const ro=data.roles||[]
  const filteredVms=useMemo(()=>{ const term=vmSearch.trim().toLowerCase(); if(!term)return data.vms||[]; return(data.vms||[]).filter(vm=>[vm.name,vm.node,vm.pool_id,vm.status,String(vm.vmid)].filter(Boolean).some(v=>String(v).toLowerCase().includes(term))) },[vmSearch,data.vms])
  const toggleRole=id=>setUserForm(c=>({...c,role_ids:c.role_ids.includes(id)?c.role_ids.filter(v=>v!==id):[...c.role_ids,id]}))
  const togglePool=id=>setSelectedPoolIds(c=>c.includes(id)?c.filter(v=>v!==id):[...c,id])
  const runAction=async(action,msg)=>{ clearMessages();setBusy(true); try{await action();await refreshData();if(msg)setSuccess(msg)}catch(err){setError(err.message||'Error')}finally{setBusy(false)} }

  const handleCreateTenant=async(fd)=>{ await request('/api/admin/tenants',{method:'POST',body:JSON.stringify({code:fd.code,name:fd.name,type:fd.type,parent_tenant_id:fd.parent_tenant_id||null,status:'ACTIVE'})}); await refreshData();setSuccess(`Tenant "${fd.name}" creado.`) }
  const handleCreateUser=async(fd)=>{ await request('/api/admin/users',{method:'POST',body:JSON.stringify({username:fd.username,email:fd.email,firstName:fd.firstName,lastName:fd.lastName,password:fd.password,tenant_id:fd.tenant_id,role_ids:fd.role_ids})}); await refreshData();setSuccess(`Usuario "${fd.email}" creado.`) }

  const submitTenant=(e)=>{ e.preventDefault(); const p={code:tenantForm.code,name:tenantForm.name,status:tenantForm.status,type:tenantForm.type,parent_tenant_id:tenantForm.parent_tenant_id||null}; const path=tenantForm.id?`/api/admin/tenants/${tenantForm.id}`:'/api/admin/tenants'; runAction(async()=>{await request(path,{method:tenantForm.id?'PATCH':'POST',body:JSON.stringify(p)});setTenantForm(emptyTenantForm)},tenantForm.id?'Tenant actualizado':'Tenant creado') }
  const deleteTenant=(t)=>{ if(!window.confirm(`¿Eliminar ${t.name}?`))return; runAction(async()=>{await request(`/api/admin/tenants/${t.id}`,{method:'DELETE'});if(tenantForm.id===t.id)setTenantForm(emptyTenantForm)},'Tenant eliminado') }
  const submitTenantGroup=(e)=>{ e.preventDefault(); const p={tenant_id:tenantGroupForm.tenant_id,code:tenantGroupForm.code,name:tenantGroupForm.name}; const path=tenantGroupForm.id?`/api/admin/tenant-groups/${tenantGroupForm.id}`:'/api/admin/tenant-groups'; runAction(async()=>{await request(path,{method:tenantGroupForm.id?'PATCH':'POST',body:JSON.stringify(p)});setTenantGroupForm(emptyTenantGroupForm)},tenantGroupForm.id?'Grupo actualizado':'Grupo creado') }
  const deleteTenantGroup=(g)=>{ if(!window.confirm(`¿Eliminar ${g.name}?`))return; runAction(async()=>{await request(`/api/admin/tenant-groups/${g.id}`,{method:'DELETE'});if(tenantGroupForm.id===g.id)setTenantGroupForm(emptyTenantGroupForm)},'Grupo eliminado') }
  const submitUser=(e)=>{ e.preventDefault(); const p={username:userForm.username,email:userForm.email,firstName:userForm.firstName,lastName:userForm.lastName,password:userForm.password,tenant_id:userForm.tenant_id||null,tenant_group_id:userForm.tenant_group_id||null,role_ids:userForm.role_ids,enabled:userForm.enabled}; const path=userForm.id?`/api/admin/users/${userForm.id}`:'/api/admin/users'; runAction(async()=>{await request(path,{method:userForm.id?'PATCH':'POST',body:JSON.stringify(p)});setUserForm({...emptyUserForm,tenant_group_id:tgo[0]?.id||''})},userForm.id?'Usuario actualizado':'Usuario creado') }
  const startEditUser=(user)=>{ setUserForm({id:user.id,username:user.username||'',email:user.email||'',firstName:user.first_name||'',lastName:user.last_name||'',password:'',tenant_id:user.tenant_id||user.tenant?.id||'',tenant_group_id:user.tenant_group?.id||'',role_ids:(user.roles||[]).map(r=>r.id),enabled:user.enabled!==false}); setActiveTab('users'); typeof window!=='undefined'&&window.scrollTo({top:0,behavior:'smooth'}) }
  const toggleUserEnabled=(user,enabled)=>runAction(()=>request(`/api/admin/users/${user.id}/${enabled?'enable':'disable'}`,{method:'POST'}),enabled?'Usuario habilitado':'Usuario deshabilitado')
  const deleteUser=(user)=>{ if(!window.confirm(`¿Eliminar ${user.email}? Se borrará de Keycloak.`))return; runAction(async()=>{await request(`/api/admin/users/${user.id}`,{method:'DELETE'});if(userForm.id===user.id)setUserForm({...emptyUserForm,tenant_group_id:tgo[0]?.id||''})},'Usuario eliminado') }
  const savePoolBindings=()=>{ if(!poolGroupId)return; runAction(()=>request(`/api/admin/tenant-groups/${poolGroupId}/pools`,{method:'PUT',body:JSON.stringify({pool_ids:selectedPoolIds})}),'Pools guardados') }
  const saveVm=(e)=>{ e.preventDefault(); if(!vmForm.vmid)return; runAction(()=>request(`/api/admin/vms/${vmForm.vmid}`,{method:'PATCH',body:JSON.stringify({...vmForm,tenant_id:vmForm.tenant_id||null,tenant_group_id:vmForm.tenant_group_id||null})}),'VM actualizada') }
  const deleteVm=()=>{ if(!vmForm.vmid||!window.confirm(`¿Borrar VM ${vmForm.vmid}?`))return; runAction(async()=>{await request(`/api/admin/vms/${vmForm.vmid}`,{method:'DELETE'});setSelectedVmId('');setVmForm(emptyVmForm)},'VM eliminada') }
  const syncAll=()=>runAction(()=>request('/api/admin/sync-all',{method:'POST'}),'Sincronización completada')

  const TABS=[{key:'tenants',label:'Tenants & Grupos'},{key:'users',label:'Usuarios'},{key:'assets',label:'Activos'},{key:'vms',label:'Inventario VM'}]

  return (
    <AppShell title="Tenants & access" subtitle="Gestión de tenants, usuarios y asignación de activos."
      actions={<div style={{display:'flex',gap:8}}>
        <button style={altButtonStyle} onClick={syncAll} disabled={busy||loading}>{busy?'Procesando...':'Sync Proxmox'}</button>
        <button style={ghostButtonStyle} onClick={refreshData} disabled={busy||loading}>Recargar</button>
        <button style={ghostButtonStyle} onClick={()=>setWizard('tenant')}>+ Tenant</button>
        <button style={buttonStyle} onClick={()=>setWizard('user')}>+ Usuario</button>
      </div>}
    >
      {wizard==='tenant'&&<Wizard title="Nuevo tenant" onClose={()=>setWizard(null)} onFinish={handleCreateTenant} steps={[{label:'Tipo y datos',Component:p=><TenantStep1 {...p}/>},{label:'Confirmación',Component:p=><TenantStep2 {...p} tenants={to}/>}]}/>}
      {wizard==='user'&&<Wizard title="Nuevo usuario" onClose={()=>setWizard(null)} onFinish={handleCreateUser} steps={[{label:'Datos de cuenta',Component:p=><UserStep1 {...p}/>},{label:'Tenant y roles',Component:p=><UserStep2 {...p} tenants={to} roles={ro}/>},{label:'Confirmación',Component:p=><UserStep3 {...p} tenants={to} roles={ro}/>}]}/>}

      <div style={{display:'grid',gap:18}}>
        {error&&<div style={errorBoxStyle}>{error}</div>}
        {success&&<div style={successBoxStyle}>{success}</div>}

        <div style={{display:'flex',gap:4,background:T.card2,borderRadius:12,padding:4,width:'fit-content'}}>
          {TABS.map(t=><button key={t.key} onClick={()=>setActiveTab(t.key)} style={chip(activeTab===t.key)}>{t.label}</button>)}
        </div>

        {activeTab==='tenants'&&<div style={{display:'grid',gap:18}}>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(320px,1fr))',gap:18}}>
            <form onSubmit={submitTenant} style={cardStyle}>
              <div style={{fontSize:16,fontWeight:700,marginBottom:4}}>{tenantForm.id?'Editar tenant':'Nuevo tenant'}</div>
              <div style={{fontSize:12,color:T.muted,marginBottom:14}}>Catálogo principal para segmentar clientes o áreas.</div>
              <div style={{display:'grid',gap:12}}>
                <Field label="Code"><input style={inputStyle} value={tenantForm.code} onChange={e=>setTenantForm({...tenantForm,code:e.target.value})}/></Field>
                <Field label="Nombre"><input style={inputStyle} value={tenantForm.name} onChange={e=>setTenantForm({...tenantForm,name:e.target.value})}/></Field>
                <Field label="Status"><select style={inputStyle} value={tenantForm.status} onChange={e=>setTenantForm({...tenantForm,status:e.target.value})}><option value="ACTIVE">ACTIVE</option><option value="INACTIVE">INACTIVE</option></select></Field>
                <Field label="Tipo"><select style={inputStyle} value={tenantForm.type} onChange={e=>setTenantForm({...tenantForm,type:e.target.value,parent_tenant_id:''})}><option value="partner">Partner (ej. Conestra)</option><option value="client">Cliente final (ej. G-One)</option></select></Field>
                {tenantForm.type==='client'&&<Field label="Partner padre"><select style={inputStyle} value={tenantForm.parent_tenant_id} onChange={e=>setTenantForm({...tenantForm,parent_tenant_id:e.target.value})}><option value="">Selecciona el partner</option>{to.filter(t=>t.type==='partner'||t.type==='platform').map(t=><option key={t.id} value={t.id}>{t.name} ({t.type})</option>)}</select></Field>}
                <div style={{display:'flex',gap:10}}><button style={buttonStyle} disabled={busy||loading}>{tenantForm.id?'Guardar':'Crear tenant'}</button>{tenantForm.id&&<button type="button" style={ghostButtonStyle} onClick={()=>setTenantForm(emptyTenantForm)}>Cancelar</button>}</div>
              </div>
            </form>
            <form onSubmit={submitTenantGroup} style={cardStyle}>
              <div style={{fontSize:16,fontWeight:700,marginBottom:4}}>{tenantGroupForm.id?'Editar grupo':'Nuevo grupo'}</div>
              <div style={{fontSize:12,color:T.muted,marginBottom:14}}>Unidad operativa que liga usuarios, pools y visibilidad.</div>
              <div style={{display:'grid',gap:12}}>
                <Field label="Tenant"><select style={inputStyle} value={tenantGroupForm.tenant_id} onChange={e=>setTenantGroupForm({...tenantGroupForm,tenant_id:e.target.value})}><option value="">Selecciona un tenant</option>{to.map(t=><option key={t.id} value={t.id}>{t.name} ({t.code})</option>)}</select></Field>
                <Field label="Code"><input style={inputStyle} value={tenantGroupForm.code} onChange={e=>setTenantGroupForm({...tenantGroupForm,code:e.target.value})}/></Field>
                <Field label="Nombre"><input style={inputStyle} value={tenantGroupForm.name} onChange={e=>setTenantGroupForm({...tenantGroupForm,name:e.target.value})}/></Field>
                <div style={{display:'flex',gap:10}}><button style={buttonStyle} disabled={busy||loading}>{tenantGroupForm.id?'Guardar':'Crear grupo'}</button>{tenantGroupForm.id&&<button type="button" style={ghostButtonStyle} onClick={()=>setTenantGroupForm(emptyTenantGroupForm)}>Cancelar</button>}</div>
              </div>
            </form>
          </div>
          <div style={{...cardStyle,padding:0,overflow:'hidden'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'14px 18px',borderBottom:`1px solid ${T.border}`}}><span style={{fontSize:14,fontWeight:700}}>Tenants</span><span style={{fontSize:12,color:T.dim,fontFamily:'monospace'}}>{to.length} registros</span></div>
            <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead><tr>{['Code','Nombre','Tipo','Parent','Status','Acciones'].map(h=><th key={h} style={TH}>{h}</th>)}</tr></thead>
              <tbody>{to.map(t=>{const par=to.find(p=>p.id===t.parent_tenant_id);return(<tr key={t.id} onMouseEnter={e=>e.currentTarget.style.background=T.card2} onMouseLeave={e=>e.currentTarget.style.background='transparent'}><td style={{...TD,fontFamily:'monospace',fontSize:11,color:T.dim}}>{t.code}</td><td style={{...TD,fontWeight:700}}>{t.name}</td><td style={TD}><TypeBadge type={t.type}/></td><td style={{...TD,color:T.muted}}>{par?.name||'—'}</td><td style={TD}><span style={{fontSize:11,color:t.status==='ACTIVE'?T.green:T.red,fontFamily:'monospace'}}>{t.status}</span></td><td style={TD}><div style={{display:'flex',gap:6}}><button style={{...ghostButtonStyle,padding:'5px 10px',fontSize:11}} onClick={()=>setTenantForm({id:t.id,code:t.code,name:t.name,status:t.status||'ACTIVE',type:t.type||'client',parent_tenant_id:t.parent_tenant_id||''})}>Editar</button>{t.type!=='platform'&&<button style={{...dangerButtonStyle,padding:'5px 10px',fontSize:11}} onClick={()=>deleteTenant(t)}>Borrar</button>}</div></td></tr>)})}
              {!to.length&&<tr><td colSpan={6} style={{...TD,textAlign:'center',color:T.muted}}>Sin registros</td></tr>}</tbody>
            </table></div>
          </div>
          <div style={{...cardStyle,padding:0,overflow:'hidden'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'14px 18px',borderBottom:`1px solid ${T.border}`}}><span style={{fontSize:14,fontWeight:700}}>Grupos</span><span style={{fontSize:12,color:T.dim,fontFamily:'monospace'}}>{tgo.length} registros</span></div>
            <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead><tr>{['Grupo','Tenant','Pools','Acciones'].map(h=><th key={h} style={TH}>{h}</th>)}</tr></thead>
              <tbody>{tgo.map(g=>(<tr key={g.id} onMouseEnter={e=>e.currentTarget.style.background=T.card2} onMouseLeave={e=>e.currentTarget.style.background='transparent'}><td style={TD}><strong>{g.name}</strong><div style={{fontSize:11,color:T.muted,fontFamily:'monospace'}}>{g.code}</div></td><td style={{...TD,color:T.muted}}>{g.tenant?.name||'n/a'}</td><td style={{...TD,color:T.muted}}>{(g.pools||[]).map(p=>p.name).join(', ')||'Sin pools'}</td><td style={TD}><div style={{display:'flex',gap:6}}><button style={{...ghostButtonStyle,padding:'5px 10px',fontSize:11}} onClick={()=>setTenantGroupForm({id:g.id,tenant_id:g.tenant?.id||'',code:g.code,name:g.name})}>Editar</button><button style={{...dangerButtonStyle,padding:'5px 10px',fontSize:11}} onClick={()=>deleteTenantGroup(g)}>Borrar</button></div></td></tr>))}
              {!tgo.length&&<tr><td colSpan={4} style={{...TD,textAlign:'center',color:T.muted}}>Sin registros</td></tr>}</tbody>
            </table></div>
          </div>
        </div>}

        {activeTab==='users'&&<div style={{display:'grid',gap:18}}>
          <form onSubmit={submitUser} style={cardStyle}>
            <div style={{fontSize:16,fontWeight:700,marginBottom:4}}>{userForm.id?'Editar usuario':'Alta de usuario'}</div>
            <div style={{fontSize:12,color:T.muted,marginBottom:14}}>Crea o actualiza usuario en Keycloak, registro local y asignación de roles.</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:12}}>
              <Field label="Username"><input style={inputStyle} value={userForm.username} onChange={e=>setUserForm({...userForm,username:e.target.value})}/></Field>
              <Field label="Email"><input style={inputStyle} value={userForm.email} onChange={e=>setUserForm({...userForm,email:e.target.value})}/></Field>
              <Field label="Nombre(s)"><input style={inputStyle} value={userForm.firstName} onChange={e=>setUserForm({...userForm,firstName:e.target.value})}/></Field>
              <Field label="Apellidos"><input style={inputStyle} value={userForm.lastName} onChange={e=>setUserForm({...userForm,lastName:e.target.value})}/></Field>
              <Field label={userForm.id?'Nuevo password (opcional)':'Password inicial'}><input type="password" style={inputStyle} value={userForm.password} onChange={e=>setUserForm({...userForm,password:e.target.value})}/></Field>
              <Field label="Tenant (visibilidad)"><select style={inputStyle} value={userForm.tenant_id} onChange={e=>setUserForm({...userForm,tenant_id:e.target.value})}><option value="">Sin tenant</option>{to.map(t=><option key={t.id} value={t.id}>{t.name} ({t.type||'client'})</option>)}</select></Field>
              <Field label="Tenant group"><select style={inputStyle} value={userForm.tenant_group_id} onChange={e=>setUserForm({...userForm,tenant_group_id:e.target.value})}><option value="">Sin tenant group</option>{tgo.map(g=><option key={g.id} value={g.id}>{g.name} ({g.code})</option>)}</select></Field>
            </div>
            <div style={{marginTop:16}}><div style={{fontSize:12,color:T.muted,marginBottom:10}}>Roles</div>
              <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{ro.map(r=><label key={r.id} style={{display:'inline-flex',alignItems:'center',gap:8,padding:'7px 12px',border:`1px solid ${T.soft}`,borderRadius:999,color:T.text,background:T.card2,cursor:'pointer',fontSize:13}}><input type="checkbox" checked={userForm.role_ids.includes(r.id)} onChange={()=>toggleRole(r.id)}/><span>{r.code}</span></label>)}</div>
            </div>
            <div style={{display:'flex',gap:10,marginTop:16}}><button style={buttonStyle} disabled={busy||loading}>{userForm.id?'Guardar usuario':'Crear usuario'}</button>{userForm.id&&<button type="button" style={ghostButtonStyle} onClick={()=>setUserForm({...emptyUserForm,tenant_group_id:tgo[0]?.id||''})}>Cancelar edición</button>}</div>
          </form>
          <div style={{display:'grid',gridTemplateColumns:'minmax(320px,1fr) minmax(360px,1.2fr)',gap:18}}>
            <div style={cardStyle}>
              <div style={{fontSize:16,fontWeight:700,marginBottom:4}}>Asignación de pools</div>
              <div style={{fontSize:12,color:T.muted,marginBottom:14}}>Selecciona un grupo y define los pools visibles.</div>
              <div style={{display:'grid',gap:12}}>
                <Field label="Grupo"><select style={inputStyle} value={poolGroupId} onChange={e=>setPoolGroupId(e.target.value)}><option value="">Selecciona un grupo</option>{tgo.map(g=><option key={g.id} value={g.id}>{g.name} ({g.code})</option>)}</select></Field>
                <div style={{display:'grid',gap:8,maxHeight:280,overflow:'auto'}}>{po.map(pool=><label key={pool.id} style={{display:'flex',gap:8,alignItems:'center',padding:'10px 12px',border:`1px solid ${T.border}`,borderRadius:10,background:T.card2,color:T.text,cursor:'pointer'}}><input type="checkbox" checked={selectedPoolIds.includes(pool.id)} onChange={()=>togglePool(pool.id)}/><div><div style={{fontWeight:700}}>{pool.name}</div><div style={{fontSize:11,color:T.muted}}>{pool.external_id}</div></div></label>)}{!po.length&&<div style={{color:T.muted,fontSize:13}}>No hay pools disponibles.</div>}</div>
                <button type="button" style={buttonStyle} onClick={savePoolBindings} disabled={busy||!poolGroupId}>Guardar pools</button>
              </div>
            </div>
            <div style={{...cardStyle,padding:0,overflow:'hidden'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'14px 18px',borderBottom:`1px solid ${T.border}`}}><span style={{fontSize:14,fontWeight:700}}>Usuarios</span><span style={{fontSize:12,color:T.dim,fontFamily:'monospace'}}>{data.users.length} registros</span></div>
              <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr>{['Usuario','Tenant','Roles','Acciones'].map(h=><th key={h} style={TH}>{h}</th>)}</tr></thead>
                <tbody>{data.users.map(u=>(<tr key={u.id} onMouseEnter={e=>e.currentTarget.style.background=T.card2} onMouseLeave={e=>e.currentTarget.style.background='transparent'}><td style={TD}><div style={{fontWeight:700}}>{u.email}</div><div style={{fontSize:11,color:T.muted}}>{u.keycloak_id}</div></td><td style={TD}>{u.tenant_name?<div><div style={{fontWeight:600}}>{u.tenant_name}</div><div style={{fontSize:11,color:T.muted}}>{u.tenant_type}</div></div>:<span style={{color:T.muted}}>Sin asignar</span>}</td><td style={TD}><div style={{display:'flex',gap:4,flexWrap:'wrap'}}>{(u.roles||[]).map(r=><span key={r.id||r} style={{fontSize:10,padding:'3px 7px',borderRadius:6,background:'rgba(139,92,246,0.15)',color:'#c4b5fd',border:'1px solid rgba(139,92,246,0.35)',fontFamily:'monospace'}}>{r.code||r}</span>)}</div></td><td style={TD}><div style={{display:'flex',gap:5,flexWrap:'wrap'}}><button style={{...ghostButtonStyle,padding:'4px 8px',fontSize:11}} onClick={()=>startEditUser(u)}>Editar</button><button style={{...ghostButtonStyle,padding:'4px 8px',fontSize:11}} onClick={()=>toggleUserEnabled(u,false)}>Deshabilitar</button><button style={{...ghostButtonStyle,padding:'4px 8px',fontSize:11}} onClick={()=>toggleUserEnabled(u,true)}>Habilitar</button><button style={{...dangerButtonStyle,padding:'4px 8px',fontSize:11}} onClick={()=>deleteUser(u)}>Borrar</button></div></td></tr>))}
                {!data.users.length&&<tr><td colSpan={4} style={{...TD,textAlign:'center',color:T.muted}}>Sin registros</td></tr>}</tbody>
              </table></div>
            </div>
          </div>
        </div>}

        {activeTab==='assets'&&<div style={{...cardStyle,padding:0,overflow:'hidden'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'14px 18px',borderBottom:`1px solid ${T.border}`}}><div><div style={{fontSize:14,fontWeight:700}}>Asignar activos a clientes</div><div style={{fontSize:12,color:T.muted}}>Define qué activos pertenecen a cada cliente final.</div></div><span style={{fontSize:12,color:T.dim,fontFamily:'monospace'}}>{assets.length} activos</span></div>
          <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead><tr>{['Activo','OS','Estado agente','Cliente asignado','✓'].map(h=><th key={h} style={TH}>{h}</th>)}</tr></thead>
            <tbody>{assets.map(asset=>{const asgn=asset.tenant_assignments?.[0]; const aT=asgn?.tenant_id?to.find(t=>t.id===asgn.tenant_id):null; return(<tr key={asset.id} onMouseEnter={e=>e.currentTarget.style.background=T.card2} onMouseLeave={e=>e.currentTarget.style.background='transparent'}><td style={TD}><div style={{fontWeight:700}}>{asset.display_name||asset.host_name}</div><div style={{fontSize:11,color:T.muted}}>{asset.agent_version}</div></td><td style={{...TD,color:T.muted}}>{asset.os_type||'—'}</td><td style={TD}><span style={{fontSize:11,fontWeight:700,fontFamily:'monospace',color:asset.agent_status==='online'?T.green:T.red}}>{asset.agent_status||'—'}</span></td><td style={TD}><select style={{...inputStyle,width:200,fontSize:12}} value={asgn?.tenant_id||''} onChange={async e=>{const tid=e.target.value;try{if(tid)await request(`/api/admin/assets/${asset.id}/assign`,{method:'POST',body:JSON.stringify({tenantId:tid})});else await request(`/api/admin/assets/${asset.id}/assign`,{method:'DELETE'});const u=await request('/api/admin/assets').catch(()=>[]);setAssets(Array.isArray(u)?u:[]);setSuccess('Asignación guardada')}catch(err){setError(err.message||'Error al asignar')}}}><option value="">Sin asignar</option>{to.filter(t=>t.type==='client').map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></td><td style={TD}>{aT&&<span style={{fontSize:11,color:T.green}}>✓ {aT.name}</span>}</td></tr>)})}
            {!assets.length&&<tr><td colSpan={5} style={{...TD,textAlign:'center',color:T.muted}}>Sin activos</td></tr>}</tbody>
          </table></div>
        </div>}

        {activeTab==='vms'&&<div style={cardStyle}>
          <div style={{fontSize:16,fontWeight:700,marginBottom:4}}>Inventario VM</div>
          <div style={{fontSize:12,color:T.muted,marginBottom:18}}>Mantenimiento rápido de observabilidad y catálogos del inventario local.</div>
          <div style={{display:'grid',gridTemplateColumns:'minmax(280px,0.95fr) minmax(320px,1.05fr)',gap:18}}>
            <div>
              <div style={{marginBottom:12}}><input style={inputStyle} placeholder="Buscar VM por nombre, vmid, nodo o pool" value={vmSearch} onChange={e=>setVmSearch(e.target.value)}/></div>
              <div style={{maxHeight:420,overflow:'auto',display:'grid',gap:8}}>{filteredVms.map(vm=>(<button key={vm.vmid} type="button" onClick={()=>setSelectedVmId(String(vm.vmid))} style={{textAlign:'left',padding:12,borderRadius:12,border:selectedVmId===String(vm.vmid)?`2px solid ${T.primary}`:`1px solid ${T.border}`,background:selectedVmId===String(vm.vmid)?T.card3:T.card2,color:T.text,cursor:'pointer'}}><div style={{display:'flex',justifyContent:'space-between',gap:8}}><strong>{vm.name||`VM ${vm.vmid}`}</strong><span style={{color:T.muted}}>{vm.status||'unknown'}</span></div><div style={{marginTop:6,fontSize:12,color:T.muted}}>vmid: {vm.vmid} · nodo: {vm.node||'n/a'} · pool: {vm.pool_id||'sin pool'}</div></button>))}{!filteredVms.length&&<div style={{color:T.muted,fontSize:13}}>No hay VMs.</div>}</div>
            </div>
            <form onSubmit={saveVm} style={{display:'grid',gap:12}}>
              {!selectedVmId?<div style={{color:T.muted,fontSize:14}}>Selecciona una VM para editarla.</div>:(
                <><Field label="OS type"><select style={inputStyle} value={vmForm.os_type} onChange={e=>setVmForm({...vmForm,os_type:e.target.value})}><option value="">Sin definir</option><option value="windows">windows</option><option value="linux">linux</option></select></Field>
                <Field label="Elastic host name"><input style={inputStyle} value={vmForm.elastic_host_name} onChange={e=>setVmForm({...vmForm,elastic_host_name:e.target.value})}/></Field>
                <Field label="Kibana base URL"><input style={inputStyle} value={vmForm.kibana_base_url} onChange={e=>setVmForm({...vmForm,kibana_base_url:e.target.value})}/></Field>
                <Field label="Monitored services"><textarea style={textareaStyle} value={vmForm.monitored_services} onChange={e=>setVmForm({...vmForm,monitored_services:e.target.value})}/></Field>
                <Field label="Tenant"><select style={inputStyle} value={vmForm.tenant_id} onChange={e=>setVmForm({...vmForm,tenant_id:e.target.value})}><option value="">Sin tenant</option>{to.map(t=><option key={t.id} value={t.id}>{t.name} ({t.code})</option>)}</select></Field>
                <Field label="Tenant group"><select style={inputStyle} value={vmForm.tenant_group_id} onChange={e=>setVmForm({...vmForm,tenant_group_id:e.target.value})}><option value="">Sin tenant group</option>{tgo.map(g=><option key={g.id} value={g.id}>{g.name} ({g.code})</option>)}</select></Field>
                <label style={{display:'inline-flex',alignItems:'center',gap:8,fontSize:14,color:T.text}}><input type="checkbox" checked={vmForm.observability_enabled} onChange={e=>setVmForm({...vmForm,observability_enabled:e.target.checked})}/>Observabilidad habilitada</label>
                <div style={{display:'flex',gap:10}}><button style={buttonStyle} disabled={busy||loading}>Guardar VM</button><button type="button" style={dangerButtonStyle} onClick={deleteVm}>Borrar VM local</button></div></>
              )}
            </form>
          </div>
        </div>}
      </div>
    </AppShell>
  )
}