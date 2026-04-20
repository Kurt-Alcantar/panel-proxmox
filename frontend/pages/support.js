import { useEffect, useMemo, useState } from 'react'
import AppShell from '../components/AppShell'
import { apiJson } from '../lib/auth'

const EMPTY_FORM = { title: '', priority: 'Medium', issueTypeName: '', description: '', labels: '' }

export default function SupportPage() {
  const [tickets, setTickets] = useState([])
  const [meta, setMeta] = useState({ issueTypes: [], projectKey: 'CM', configured: false })
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [comment, setComment] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [refreshTick, setRefreshTick] = useState(0)
  const [form, setForm] = useState(EMPTY_FORM)

  useEffect(() => {
    let active = true
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const query = new URLSearchParams()
        if (search.trim()) query.set('search', search.trim())
        if (statusFilter !== 'all') query.set('status', statusFilter)
        const [metaData, listData] = await Promise.all([
          apiJson('/api/support/meta'),
          apiJson(`/api/support/tickets${query.toString() ? `?${query.toString()}` : ''}`),
        ])
        if (!active) return
        setMeta(metaData)
        setTickets(listData.items || [])
        if (detail?.key) {
          const stillExists = (listData.items || []).find((row) => row.key === detail.key)
          if (!stillExists) setDetail(null)
        }
      } catch (e) {
        if (!active) return
        setError(e.message || 'No se pudo cargar Jira')
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, refreshTick])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return tickets
    return tickets.filter((t) =>
      [t.key, t.title, t.status, t.priority, t.assignee?.displayName, t.issueType]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q)),
    )
  }, [tickets, search])

  const reload = () => setRefreshTick((v) => v + 1)

  const openDetail = async (key) => {
    setError('')
    try {
      const data = await apiJson(`/api/support/tickets/${key}`)
      setDetail(data)
    } catch (e) {
      setError(e.message || 'No se pudo cargar el ticket')
    }
  }

  const createTicket = async (e) => {
    e.preventDefault()
    setCreating(true)
    setError('')
    try {
      const created = await apiJson('/api/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          labels: form.labels.split(',').map((v) => v.trim()).filter(Boolean),
        }),
      })
      setForm(EMPTY_FORM)
      setDetail(created)
      reload()
      window.dispatchEvent(new Event('hyperox:tickets-updated'))
    } catch (e) {
      setError(e.message || 'No se pudo crear el ticket')
    } finally {
      setCreating(false)
    }
  }

  const moveTicket = async (transitionId) => {
    if (!detail?.key || !transitionId) return
    setError('')
    try {
      const updated = await apiJson(`/api/support/tickets/${detail.key}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transitionId }),
      })
      setDetail(updated)
      reload()
      window.dispatchEvent(new Event('hyperox:tickets-updated'))
    } catch (e) {
      setError(e.message || 'No se pudo mover el ticket')
    }
  }

  const addComment = async (e) => {
    e.preventDefault()
    if (!detail?.key || !comment.trim()) return
    setError('')
    try {
      const updated = await apiJson(`/api/support/tickets/${detail.key}/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: comment.trim() }),
      })
      setComment('')
      setDetail(updated)
      reload()
    } catch (e) {
      setError(e.message || 'No se pudo agregar comentario')
    }
  }

  return (
    <AppShell
      title="Support tickets"
      subtitle={meta.configured ? `Integrado con Jira Cloud · proyecto ${meta.projectKey}` : 'Configura Jira en backend para habilitar soporte real.'}
      actions={
        <div className="overview-toolbar">
          <button className={`chip ${statusFilter === 'all' ? 'active' : ''}`} onClick={() => setStatusFilter('all')}>All</button>
          <button className={`chip ${statusFilter === 'To Do' ? 'active' : ''}`} onClick={() => setStatusFilter('To Do')}>To do</button>
          <button className={`chip ${statusFilter === 'In Progress' ? 'active' : ''}`} onClick={() => setStatusFilter('In Progress')}>In progress</button>
          <button className={`chip ${statusFilter === 'Done' ? 'active' : ''}`} onClick={() => setStatusFilter('Done')}>Done</button>
          <button className="btn btn-ghost btn-sm" onClick={reload}>Refresh</button>
        </div>
      }
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search Jira tickets..."
    >
      <div className="overview-bottom-grid" style={{ alignItems: 'start', gridTemplateColumns: '1.05fr 1.2fr 1.15fr' }}>
        <section className="card overview-list-card cardPad">
          <div className="sectionHeader"><div><h2 className="sectionTitle">Nuevo ticket</h2><p className="sectionSub">Alta directa en Jira.</p></div></div>
          <form className="adminFormGrid" onSubmit={createTicket}>
            <label className="authField"><span>Título</span><input className="authInput" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></label>
            <label className="authField"><span>Prioridad</span><select className="authInput" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}><option>Highest</option><option>High</option><option>Medium</option><option>Low</option><option>Lowest</option></select></label>
            <label className="authField"><span>Issue type</span><select className="authInput" value={form.issueTypeName} onChange={(e) => setForm({ ...form, issueTypeName: e.target.value })}><option value="">Default project issue type</option>{meta.issueTypes.map((type) => <option value={type.name} key={type.id}>{type.name}</option>)}</select></label>
            <label className="authField"><span>Labels</span><input className="authInput" placeholder="source-elastic, sev-critical" value={form.labels} onChange={(e) => setForm({ ...form, labels: e.target.value })} /></label>
            <label className="authField" style={{ gridColumn: '1 / -1' }}><span>Descripción</span><textarea className="authInput" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows="6" /></label>
            <div><button className="btn btn-primary" type="submit" disabled={creating || !meta.configured}>{creating ? 'Creando...' : 'Crear ticket'}</button></div>
          </form>
          {!meta.configured && <div className="emptyState" style={{ marginTop: 12 }}>Falta configurar JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN y JIRA_PROJECT_KEY en el backend.</div>}
          {error && <div className="emptyState" style={{ marginTop: 12, color: 'var(--danger)' }}>{error}</div>}
        </section>

        <section className="card overview-list-card">
          <div className="overview-card-head compact"><h3>Tickets</h3><span className="ch-meta">{filtered.length} items</span></div>
          <div className="overview-list-wrap">
            {loading ? <div className="emptyState">Cargando tickets...</div> : filtered.map(ticket => (
              <button className="alert-row" key={ticket.key} onClick={() => openDetail(ticket.key)} style={{ width: '100%', textAlign: 'left', background: 'transparent', border: 0 }}>
                <span className={`alert-accent ${/done/i.test(ticket.status) ? 'ok' : /progress/i.test(ticket.status) ? 'warning' : 'critical'}`} />
                <div style={{ flex: 1 }}>
                  <div className="alert-title">{ticket.key} · {ticket.title}</div>
                  <div className="alert-meta">{ticket.issueType} · {ticket.priority} · {ticket.status}</div>
                  <div className="muted" style={{ marginTop: 6 }}>{ticket.assignee?.displayName || 'Unassigned'} · updated {new Date(ticket.updatedAt).toLocaleString()}</div>
                </div>
              </button>
            ))}
            {!loading && filtered.length === 0 && <div className="emptyState">Sin tickets para ese filtro.</div>}
          </div>
        </section>

        <section className="card overview-list-card cardPad">
          <div className="sectionHeader"><div><h2 className="sectionTitle">Detalle</h2><p className="sectionSub">Transiciones y comentarios del issue.</p></div></div>
          {!detail ? <div className="emptyState">Selecciona un ticket.</div> : (
            <>
              <div style={{ display: 'grid', gap: 10 }}>
                <div className="alert-title">{detail.key} · {detail.title}</div>
                <div className="alert-meta">{detail.issueType} · {detail.priority} · {detail.status}</div>
                <div className="muted">Assignee: {detail.assignee?.displayName || 'Unassigned'}</div>
                {detail.labels?.length > 0 && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{detail.labels.map((label) => <span className="chip" key={label}>{label}</span>)}</div>}
                {detail.description && <div className="emptyState" style={{ textAlign: 'left', whiteSpace: 'pre-wrap' }}>{detail.description}</div>}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {(detail.transitions || []).map((transition) => (
                    <button key={transition.id} className="btn btn-secondary btn-sm" onClick={() => moveTicket(transition.id)}>{transition.name}</button>
                  ))}
                </div>
              </div>
              <div className="sectionHeader" style={{ marginTop: 16 }}><div><h2 className="sectionTitle">Comentarios</h2></div></div>
              <div className="overview-list-wrap" style={{ maxHeight: 280 }}>
                {(detail.comments || []).map((item) => (
                  <div key={item.id} className="alert-row">
                    <span className="alert-accent info" />
                    <div style={{ flex: 1 }}>
                      <div className="alert-title">{item.author}</div>
                      <div className="alert-meta">{new Date(item.createdAt).toLocaleString()}</div>
                      <div className="muted" style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}>{item.bodyText}</div>
                    </div>
                  </div>
                ))}
                {(detail.comments || []).length === 0 && <div className="emptyState">Sin comentarios.</div>}
              </div>
              <form onSubmit={addComment} className="adminFormGrid" style={{ marginTop: 14 }}>
                <label className="authField" style={{ gridColumn: '1 / -1' }}><span>Nuevo comentario</span><textarea className="authInput" rows="4" value={comment} onChange={(e) => setComment(e.target.value)} /></label>
                <div><button className="btn btn-primary btn-sm" type="submit">Agregar comentario</button></div>
                <a className="btn btn-ghost btn-sm" href={detail.url} target="_blank" rel="noreferrer">Open in Jira</a>
              </form>
            </>
          )}
        </section>
      </div>
    </AppShell>
  )
}
