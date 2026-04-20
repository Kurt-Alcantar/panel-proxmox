import { useEffect, useMemo, useState } from 'react'
import AppShell from '../components/AppShell'
import { loadTickets, saveTickets, seedTickets } from '../lib/panel'

const EMPTY_FORM = { title: '', priority: 'medium', owner: 'Plataforma', description: '' }

export default function SupportPage() {
  const [tickets, setTickets] = useState([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    setTickets(seedTickets())
  }, [])

  const persist = (next) => {
    setTickets(next)
    saveTickets(next)
    window.dispatchEvent(new Event('hyperox:tickets-updated'))
  }

  const createTicket = (e) => {
    e.preventDefault()
    const now = new Date().toISOString()
    const next = [{
      id: `SUP-${1000 + tickets.length + 1}`,
      ...form,
      status: 'open',
      createdAt: now,
      updatedAt: now,
    }, ...tickets]
    persist(next)
    setForm(EMPTY_FORM)
  }

  const updateStatus = (id, status) => {
    persist(tickets.map(ticket => ticket.id === id ? { ...ticket, status, updatedAt: new Date().toISOString() } : ticket))
  }

  const visible = useMemo(() => tickets.filter(ticket => filter === 'all' ? true : ticket.status === filter), [tickets, filter])

  return (
    <AppShell
      title="Support tickets"
      subtitle="Tablero operativo simple para registrar y dar seguimiento a incidencias del panel."
      actions={<div className="overview-toolbar"><button className={`chip ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All</button><button className={`chip ${filter === 'open' ? 'active' : ''}`} onClick={() => setFilter('open')}>Open</button><button className={`chip ${filter === 'in_progress' ? 'active' : ''}`} onClick={() => setFilter('in_progress')}>In progress</button><button className={`chip ${filter === 'closed' ? 'active' : ''}`} onClick={() => setFilter('closed')}>Closed</button></div>}
    >
      <div className="overview-bottom-grid" style={{ alignItems: 'start' }}>
        <section className="card overview-list-card cardPad">
          <div className="sectionHeader"><div><h2 className="sectionTitle">Nuevo ticket</h2><p className="sectionSub">Se guarda localmente en el navegador para seguimiento operativo.</p></div></div>
          <form className="adminFormGrid" onSubmit={createTicket}>
            <label className="authField"><span>Título</span><input className="authInput" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></label>
            <label className="authField"><span>Prioridad</span><select className="authInput" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
            <label className="authField"><span>Owner</span><input className="authInput" value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} /></label>
            <label className="authField" style={{ gridColumn: '1 / -1' }}><span>Descripción</span><textarea className="authInput" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows="5" /></label>
            <div><button className="btn btn-primary" type="submit">Crear ticket</button></div>
          </form>
        </section>

        <section className="card overview-list-card">
          <div className="overview-card-head compact"><h3>Tickets</h3><span className="ch-meta">{visible.length} items</span></div>
          <div className="overview-list-wrap">
            {visible.map(ticket => (
              <div className="alert-row" key={ticket.id}>
                <span className={`alert-accent ${ticket.priority === 'high' ? 'critical' : 'warning'}`} />
                <div style={{ flex: 1 }}>
                  <div className="alert-title">{ticket.id} · {ticket.title}</div>
                  <div className="alert-meta">{ticket.owner} · {ticket.priority} · {ticket.status}</div>
                  {ticket.description && <div className="muted" style={{ marginTop: 6 }}>{ticket.description}</div>}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {ticket.status !== 'in_progress' && <button className="btn btn-ghost btn-sm" onClick={() => updateStatus(ticket.id, 'in_progress')}>In progress</button>}
                  {ticket.status !== 'closed' && <button className="btn btn-secondary btn-sm" onClick={() => updateStatus(ticket.id, 'closed')}>Close</button>}
                </div>
              </div>
            ))}
            {visible.length === 0 && <div className="emptyState">Sin tickets para ese estado.</div>}
          </div>
        </section>
      </div>
    </AppShell>
  )
}
