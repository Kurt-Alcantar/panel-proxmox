import { useEffect, useMemo, useState } from 'react'
import AppShell from '../components/AppShell'
import { apiJson } from '../lib/auth'

const EMPTY_FORM = { title: '', priority: 'Medium', issueTypeName: '', description: '', labels: '' }

const PRIORITY_COLOR = {
  Highest: 'var(--red)',
  High: 'var(--red)',
  Medium: 'var(--amber)',
  Low: 'var(--green)',
  Lowest: 'var(--green)',
}

const STATUS_COLOR = {
  'To Do': 'var(--text-3)',
  'In Progress': 'var(--cyan)',
  'Done': 'var(--green)',
}

const STATUS_BG = {
  'To Do': 'oklch(0.33 0.011 248)',
  'In Progress': 'var(--cyan-dim)',
  'Done': 'var(--green-dim)',
}

function PriorityDot({ priority }) {
  return (
    <span style={{
      display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
      background: PRIORITY_COLOR[priority] || 'var(--text-4)', flexShrink: 0,
    }} />
  )
}

function StatusBadge({ status }) {
  const c = STATUS_COLOR[status] || 'var(--text-3)'
  const bg = STATUS_BG[status] || 'oklch(0.33 0.011 248)'
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 'var(--r-sm)',
      background: bg, color: c, letterSpacing: '0.03em', whiteSpace: 'nowrap',
    }}>
      {status || 'Unknown'}
    </span>
  )
}

function Label({ text }) {
  return (
    <span style={{
      fontSize: 11, padding: '2px 7px', borderRadius: 'var(--r-xs)',
      background: 'var(--surface-3)', color: 'var(--text-3)',
      border: '1px solid var(--border-soft)', whiteSpace: 'nowrap',
    }}>
      {text}
    </span>
  )
}

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
  const [showCreate, setShowCreate] = useState(false)
  const [transitioning, setTransitioning] = useState(false)
  const [addingComment, setAddingComment] = useState(false)

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
      setShowCreate(false)
      reload()
      window.dispatchEvent(new Event('hyperox:tickets-updated'))
    } catch (e) {
      setError(e.message || 'No se pudo crear el ticket')
    } finally {
      setCreating(false)
    }
  }

  const moveTicket = async (transitionId) => {
    if (!detail?.key || !transitionId || transitioning) return
    setTransitioning(true)
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
    } finally {
      setTransitioning(false)
    }
  }

  const addComment = async (e) => {
    e.preventDefault()
    if (!detail?.key || !comment.trim() || addingComment) return
    setAddingComment(true)
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
    } finally {
      setAddingComment(false)
    }
  }

  const ts = (v) => v ? new Date(v).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }) : ''

  return (
    <AppShell
      title="Support tickets"
      subtitle={meta.configured ? `Jira Cloud · ${meta.projectKey}` : 'Configura Jira en backend.'}
      actions={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', background: 'var(--surface-2)', borderRadius: 'var(--r-md)', padding: 2, gap: 2 }}>
            {[['all', 'All'], ['To Do', 'To do'], ['In Progress', 'In progress'], ['Done', 'Done']].map(([val, label]) => (
              <button
                key={val}
                onClick={() => setStatusFilter(val)}
                style={{
                  padding: '5px 12px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
                  borderRadius: 'var(--r-sm)', transition: 'all 0.15s',
                  background: statusFilter === val ? 'var(--surface-3)' : 'transparent',
                  color: statusFilter === val ? 'var(--text)' : 'var(--text-3)',
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <button onClick={reload} style={{ padding: '5px 10px', fontSize: 12, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', color: 'var(--text-2)', cursor: 'pointer' }}>
            Refresh
          </button>
          <button onClick={() => setShowCreate(v => !v)} style={{ padding: '6px 14px', fontSize: 12, fontWeight: 700, background: 'var(--cyan)', border: 'none', borderRadius: 'var(--r-sm)', color: '#fff', cursor: 'pointer' }}>
            + Nuevo ticket
          </button>
        </div>
      }
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Buscar tickets..."
    >
      <style>{`
        .st-layout { display: grid; grid-template-columns: 1fr 1.6fr; gap: 16px; align-items: start; }
        .st-ticket { display: flex; align-items: flex-start; gap: 10px; padding: 12px 14px; border-bottom: 1px solid var(--border-soft); cursor: pointer; transition: background 0.12s; }
        .st-ticket:hover { background: var(--surface-2); }
        .st-ticket.active { background: var(--surface-2); border-left: 2px solid var(--cyan); }
        .st-ticket:last-child { border-bottom: none; }
        .st-comment { padding: 12px 0; border-bottom: 1px solid var(--border-soft); }
        .st-comment:last-child { border-bottom: none; }
        .st-input { width: 100%; background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--r-sm); padding: 8px 10px; font-size: 13px; color: var(--text); outline: none; box-sizing: border-box; }
        .st-input:focus { border-color: var(--cyan-deep); }
        .st-label { font-size: 12px; color: var(--text-3); display: block; margin-bottom: 4px; }
        .st-section { font-size: 11px; font-weight: 700; color: var(--text-4); text-transform: uppercase; letter-spacing: 0.08em; padding: 10px 0 6px; }
        @media (max-width: 768px) { .st-layout { grid-template-columns: 1fr; } }
      `}</style>

      {error && (
        <div style={{ background: 'var(--red-dim)', border: '1px solid var(--red)', borderRadius: 'var(--r-md)', padding: '10px 14px', fontSize: 13, color: 'var(--red)', marginBottom: 14 }}>
          {error}
        </div>
      )}

      {/* Modal crear ticket */}
      {showCreate && (
        <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', padding: '20px 22px', marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Nuevo ticket</div>
            <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
          </div>
          <form onSubmit={createTicket}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="st-label">Título *</label>
                <input className="st-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required placeholder="Resumen del issue..." />
              </div>
              <div>
                <label className="st-label">Prioridad</label>
                <select className="st-input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                  {['Highest','High','Medium','Low','Lowest'].map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="st-label">Issue type</label>
                <select className="st-input" value={form.issueTypeName} onChange={(e) => setForm({ ...form, issueTypeName: e.target.value })}>
                  <option value="">Default</option>
                  {meta.issueTypes.map((t) => <option value={t.name} key={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="st-label">Labels</label>
                <input className="st-input" placeholder="tag1, tag2" value={form.labels} onChange={(e) => setForm({ ...form, labels: e.target.value })} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="st-label">Descripción</label>
                <textarea className="st-input" rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Detalla el problema..." style={{ resize: 'vertical' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" disabled={creating || !meta.configured} style={{ padding: '7px 18px', background: 'var(--cyan)', border: 'none', borderRadius: 'var(--r-sm)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                {creating ? 'Creando...' : 'Crear ticket'}
              </button>
              <button type="button" onClick={() => setShowCreate(false)} style={{ padding: '7px 14px', background: 'var(--surface-3)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', color: 'var(--text-2)', fontSize: 13, cursor: 'pointer' }}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="st-layout">
        {/* Lista de tickets */}
        <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', overflow: 'hidden' }}>
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Tickets</span>
            <span style={{ fontSize: 12, color: 'var(--text-4)' }}>{filtered.length} resultados</span>
          </div>
          <div style={{ maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' }}>
            {loading && <div style={{ padding: 20, color: 'var(--text-3)', fontSize: 13, textAlign: 'center' }}>Cargando...</div>}
            {!loading && filtered.length === 0 && <div style={{ padding: 20, color: 'var(--text-4)', fontSize: 13, textAlign: 'center' }}>Sin tickets para ese filtro.</div>}
            {!loading && filtered.map(ticket => (
              <div
                key={ticket.key}
                className={`st-ticket ${detail?.key === ticket.key ? 'active' : ''}`}
                onClick={() => openDetail(ticket.key)}
              >
                <PriorityDot priority={ticket.priority} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--cyan)', fontFamily: 'var(--font-mono)', letterSpacing: '0.02em' }}>{ticket.key}</span>
                    <StatusBadge status={ticket.status} />
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500, lineHeight: 1.4, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {ticket.title}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-4)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <span>{ticket.assignee?.displayName || 'Sin asignar'}</span>
                    <span>·</span>
                    <span>{ts(ticket.updatedAt)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Panel de detalle */}
        <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', overflow: 'hidden' }}>
          {!detail ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-4)', fontSize: 13 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🎫</div>
              Selecciona un ticket para ver el detalle
            </div>
          ) : (
            <>
              {/* Header del ticket */}
              <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--cyan)', fontFamily: 'var(--font-mono)' }}>{detail.key}</span>
                      <StatusBadge status={detail.status} />
                      <span style={{ fontSize: 11, color: 'var(--text-4)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <PriorityDot priority={detail.priority} /> {detail.priority}
                      </span>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', lineHeight: 1.4 }}>{detail.title}</div>
                  </div>
                  <a href={detail.url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: 'var(--cyan)', textDecoration: 'none', whiteSpace: 'nowrap', padding: '4px 8px', border: '1px solid var(--cyan-deep)', borderRadius: 'var(--r-sm)' }}>
                    Ver en Jira ↗
                  </a>
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  {detail.labels?.map((l) => <Label key={l} text={l} />)}
                </div>
              </div>

              {/* Info rápida */}
              <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-4)', marginBottom: 2 }}>Asignado a</div>
                  <div style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 500 }}>{detail.assignee?.displayName || '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-4)', marginBottom: 2 }}>Reportado por</div>
                  <div style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 500 }}>{detail.reporter?.displayName || '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-4)', marginBottom: 2 }}>Tipo</div>
                  <div style={{ fontSize: 13, color: 'var(--text-2)' }}>{detail.issueType || '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-4)', marginBottom: 2 }}>Actualizado</div>
                  <div style={{ fontSize: 13, color: 'var(--text-2)' }}>{ts(detail.updatedAt)}</div>
                </div>
              </div>

              {/* Descripción */}
              {detail.description && (
                <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)' }}>
                  <div className="st-section">Descripción</div>
                  <div style={{ fontSize: 13, color: 'var(--text-2)', whiteSpace: 'pre-wrap', lineHeight: 1.6, maxHeight: 200, overflowY: 'auto' }}>
                    {detail.description}
                  </div>
                </div>
              )}

              {/* Transiciones */}
              {detail.transitions?.length > 0 && (
                <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)' }}>
                  <div className="st-section">Mover a</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {detail.transitions.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => moveTicket(t.id)}
                        disabled={transitioning}
                        style={{
                          padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none',
                          borderRadius: 'var(--r-sm)', transition: 'all 0.15s',
                          background: t.category === 'Done' ? 'var(--green-dim)' : t.category === 'In Progress' ? 'var(--cyan-dim)' : 'var(--surface-3)',
                          color: t.category === 'Done' ? 'var(--green)' : t.category === 'In Progress' ? 'var(--cyan)' : 'var(--text-2)',
                        }}
                      >
                        {transitioning ? '...' : t.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Comentarios */}
              <div style={{ padding: '0 18px 12px' }}>
                <div className="st-section">Comentarios ({detail.comments?.length || 0})</div>
                <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                  {(!detail.comments || detail.comments.length === 0) && (
                    <div style={{ fontSize: 13, color: 'var(--text-4)', padding: '8px 0' }}>Sin comentarios aún.</div>
                  )}
                  {(detail.comments || []).map((item) => (
                    <div key={item.id} className="st-comment">
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>{item.author}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-4)' }}>{ts(item.createdAt)}</span>
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-3)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{item.bodyText}</div>
                    </div>
                  ))}
                </div>

                {/* Agregar comentario */}
                <form onSubmit={addComment} style={{ marginTop: 12 }}>
                  <textarea
                    className="st-input"
                    rows={3}
                    placeholder="Escribe un comentario..."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    style={{ resize: 'none', marginBottom: 8 }}
                  />
                  <button
                    type="submit"
                    disabled={addingComment || !comment.trim()}
                    style={{
                      padding: '6px 14px', fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer',
                      borderRadius: 'var(--r-sm)', background: comment.trim() ? 'var(--cyan)' : 'var(--surface-3)',
                      color: comment.trim() ? '#fff' : 'var(--text-4)',
                    }}
                  >
                    {addingComment ? 'Enviando...' : 'Comentar'}
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </AppShell>
  )
}