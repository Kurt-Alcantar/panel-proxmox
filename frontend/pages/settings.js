import { useEffect, useState } from 'react'
import AppShell from '../components/AppShell'
import { applySettings, DEFAULT_SETTINGS, loadSettings, saveSettings } from '../lib/panel'
import { apiJson } from '../lib/auth'

const T = { text:'#f3edff',muted:'#b8abd9',dim:'#7c6fa0',card:'#171129',card2:'#21183a',card3:'#2a1f49',border:'#3b2d63',soft:'#4c3b7f',inpBg:'#120d22',primary:'#8b5cf6',green:'#22c55e',red:'#ef4444' }
const card = { background:T.card, border:`1px solid ${T.border}`, borderRadius:16, boxShadow:'0 8px 28px rgba(0,0,0,0.3)', padding:'22px 24px' }
const inp  = { width:'100%',background:T.inpBg,border:`1px solid ${T.soft}`,borderRadius:10,padding:'9px 12px',fontSize:13,color:T.text,outline:'none',boxSizing:'border-box' }
const btnP = { background:T.primary,color:'#fff',border:'none',borderRadius:10,padding:'8px 18px',fontSize:13,fontWeight:700,cursor:'pointer' }
const btnG = { background:T.card3,color:T.text,border:`1px solid ${T.soft}`,borderRadius:10,padding:'8px 18px',fontSize:13,fontWeight:700,cursor:'pointer' }
const chip = (active)=>({ display:'inline-flex',alignItems:'center',padding:'5px 14px',borderRadius:999,fontSize:12,fontWeight:600,cursor:'pointer',border:'none',background:active?'rgba(139,92,246,0.2)':T.card3,color:active?'#c4b5fd':T.muted,outline:active?'1px solid rgba(139,92,246,0.4)':'none' })

export default function SettingsPage() {
  const [settings,setSettings]=useState(DEFAULT_SETTINGS); const [tab,setTab]=useState('appearance')
  const [profile,setProfile]=useState({firstName:'',lastName:'',username:''})
  const [pw,setPw]=useState({current:'',next:'',confirm:''}); const [saving,setSaving]=useState(false)
  const [msg,setMsg]=useState({type:'',text:''})
  useEffect(()=>{ const c=loadSettings();setSettings(c);applySettings(c); apiJson('/api/me').then(d=>setProfile({firstName:d.displayName?.split(' ')[0]||'',lastName:d.displayName?.split(' ').slice(1).join(' ')||'',username:d.email||''})).catch(()=>{}) },[])
  const update=p=>{ const n={...settings,...p};setSettings(n);saveSettings(n);applySettings(n) }
  const flash=(type,text)=>{ setMsg({type,text});setTimeout(()=>setMsg({type:'',text:''}),4000) }
  const saveProfile=async e=>{ e.preventDefault();setSaving(true); try{ await apiJson('/api/me',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({firstName:profile.firstName,lastName:profile.lastName})}); flash('ok','Perfil actualizado.') }catch(err){flash('err',err.message)}finally{setSaving(false)} }
  const savePw=async e=>{ e.preventDefault(); if(pw.next!==pw.confirm){flash('err','Las contraseñas no coinciden.');return}; if(pw.next.length<8){flash('err','Mínimo 8 caracteres.');return}; setSaving(true); try{ await apiJson('/api/me/password',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({currentPassword:pw.current,newPassword:pw.next})}); setPw({current:'',next:'',confirm:''});flash('ok','Contraseña actualizada.') }catch(err){flash('err',err.message)}finally{setSaving(false)} }
  const accents=['cyan','teal','green','violet','coral']
  const Lbl=({children})=><div style={{fontSize:10,fontFamily:'monospace',textTransform:'uppercase',letterSpacing:'0.1em',color:T.muted,marginBottom:8}}>{children}</div>
  const Field=({label,children})=><div style={{display:'grid',gap:6}}><label style={{fontSize:12,color:T.muted}}>{label}</label>{children}</div>
  return (
    <AppShell title="Settings" subtitle="Preferencias de cuenta y apariencia del panel.">
      <div style={{display:'flex',gap:6,marginBottom:22}}>
        {[['appearance','Apariencia'],['account','Cuenta']].map(([k,l])=><button key={k} style={chip(tab===k)} onClick={()=>setTab(k)}>{l}</button>)}
      </div>
      {msg.text && <div style={{borderRadius:10,padding:'10px 14px',marginBottom:16,fontSize:12,fontWeight:600,...(msg.type==='ok'?{background:'rgba(34,197,94,0.12)',color:'#86efac',border:'1px solid rgba(34,197,94,0.35)'}:{background:'rgba(239,68,68,0.12)',color:'#fca5a5',border:'1px solid rgba(239,68,68,0.35)'})}}>{msg.text}</div>}
      {tab==='appearance' && (
        <div style={{...card,maxWidth:440}}>
          <div style={{fontSize:16,fontWeight:700,marginBottom:22}}>Apariencia</div>
          <div style={{marginBottom:20}}><Lbl>Color de acento</Lbl>
            <div style={{display:'flex',gap:10}}>
              {accents.map(a=><button key={a} className={`swatch ${a} ${settings.accent===a?'active':''}`} onClick={()=>update({accent:a})}/>)}
            </div>
          </div>
          <div style={{marginBottom:20}}><Lbl>Radio de bordes ({settings.radius}px)</Lbl>
            <input type="range" min="12" max="26" value={settings.radius} onChange={e=>update({radius:Number(e.target.value)})} style={{width:'100%'}}/>
          </div>
          <label style={{display:'flex',alignItems:'center',gap:10,fontSize:13,color:T.muted,cursor:'pointer'}}>
            <input type="checkbox" checked={settings.dense} onChange={e=>update({dense:e.target.checked})}/>Layout denso
          </label>
          <div style={{marginTop:16,fontSize:10,fontFamily:'monospace',color:T.dim}}>hyperox · dark · {settings.accent} · r{settings.radius}</div>
        </div>
      )}
      {tab==='account' && (
        <div style={{display:'grid',gap:16,maxWidth:480}}>
          <div style={card}>
            <div style={{fontSize:16,fontWeight:700,marginBottom:20}}>Información de perfil</div>
            <form onSubmit={saveProfile} style={{display:'grid',gap:14}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <Field label="Nombre"><input style={inp} value={profile.firstName} onChange={e=>setProfile(p=>({...p,firstName:e.target.value}))} placeholder="Nombre"/></Field>
                <Field label="Apellidos"><input style={inp} value={profile.lastName} onChange={e=>setProfile(p=>({...p,lastName:e.target.value}))} placeholder="Apellidos"/></Field>
              </div>
              <Field label="Email / Usuario">
                <input style={{...inp,opacity:.5}} value={profile.username} disabled/>
                <span style={{fontSize:11,color:T.dim,marginTop:4}}>El email se gestiona desde Keycloak</span>
              </Field>
              <div><button style={btnP} type="submit" disabled={saving}>{saving?'Guardando...':'Guardar cambios'}</button></div>
            </form>
          </div>
          <div style={card}>
            <div style={{fontSize:16,fontWeight:700,marginBottom:20}}>Cambiar contraseña</div>
            <form onSubmit={savePw} style={{display:'grid',gap:14}}>
              {[['current','Contraseña actual'],['next','Nueva contraseña (mín. 8)'],['confirm','Confirmar nueva']].map(([k,l])=>(
                <Field key={k} label={l}><input style={inp} type="password" value={pw[k]} onChange={e=>setPw(p=>({...p,[k]:e.target.value}))} required/></Field>
              ))}
              <div><button style={btnG} type="submit" disabled={saving}>{saving?'Actualizando...':'Actualizar contraseña'}</button></div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  )
}
