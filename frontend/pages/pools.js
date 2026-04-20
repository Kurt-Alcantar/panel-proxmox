import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import AppShell from '../components/AppShell'
import { apiJson, clearSession } from '../lib/auth'

export default function GruposPage() {
  const router = useRouter()
  const [pools, setPools] = useState([])
  const [vms, setVms] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState({})

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [poolRows, vmRows] = await Promise.all([
        apiJson('/api/pools').catch(() => apiJson('/api/infra/pools').catch(() => [])),
        apiJson('/api/my/vms').catch(() => []),
      ])
      setPools(poolRows)
      setVms(vmRows)
    } catch (err) {
      if (err.message === 'AUTH_EXPIRED') { clearSession(); router.replace('/login'); return }
      setError(err.message || 'No se pudieron cargar los grupos')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { load() }, [load])

  const rows = useMemo(() => {
    const grouped = new Map()
    pools.forEach(pool => grouped.set(pool.external_id || pool.name, { ...pool, vms: [] }))
    vms.forEach(vm => {
      const key = vm.pool_id || 'Sin grupo'
      if (!grouped.has(key)) grouped.set(key, { id: key, name: key, external_id: key, vms: [] })
      grouped.get(key).vms.push(vm)
    })
    return [...grouped.values()]
      .filter(item => query ? `${item.name} ${item.external_id}`.toLowerCase().includes(query.toLowerCase()) : true)
      .sort((a, b) => b.vms.length - a.vms.length)
  }, [pools, vms, query])

  const toggle = (key) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }))

  const statusColor = (status) => ({
    running: 'var(--green)', stopped: 'var(--red)', paused: 'var(--amber)',
  })[status] || 'var(--text-4)'

  return (
    <AppShell
      title="Grupos"
      subtitle="Agrupación de VMs Proxmox por grupo de infraestructura"
      searchValue={query}
      onSearchChange={setQuery}
      searchPlaceholder="Buscar grupo..."
    >
      {error && <div className="errorBox" style={{ marginBottom: 16 }}>{error}</div>}

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total grupos', value: rows.length },
          { label: 'Total VMs', value: vms.length },
          { label: 'Running', value: vms.filter(v => v.status === 'running').length },
          { label: 'Stopped', value: vms.filter(v => v.status !== 'running').length },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-4)', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="card cardPad"><div className="muted">Cargando grupos...</div></div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {rows.map(pool => {
            const key = pool.external_id || pool.name
            const isOpen = expanded[key]
            const running = pool.vms.filter(v => v.status === 'running').length
            return (
              <div key={key} className="card" style={{ overflow: 'hidden' }}>
                {/* Header del grupo */}
                <div
                  onClick={() => toggle(key)}
                  style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', cursor: 'pointer', userSelect: 'none' }}
                >
                  <span style={{
                    fontSize: 13, transform: isOpen ? 'rotate(90deg)' : 'none',
                    transition: 'transform 0.2s', color: 'var(--text-3)', display: 'inline-block', flexShrink: 0,
                  }}>▶</span>

                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: 14 }}>{pool.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-4)', fontFamily: 'var(--font-mono)' }}>{pool.external_id}</div>
                  </div>

                  <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{pool.vms.length}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-4)' }}>VMs</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--green)' }}>{running}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-4)' }}>Running</div>
                    </div>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 'var(--r-sm)',
                      background: running > 0 ? 'var(--green-dim)' : 'var(--surface-3)',
                      color: running > 0 ? 'var(--green)' : 'var(--text-4)',
                    }}>
                      {running > 0 ? 'activo' : 'inactivo'}
                    </span>
                  </div>
                </div>

                {/* VMs del grupo */}
                {isOpen && (
                  <div style={{ borderTop: '1px solid var(--border-soft)' }}>
                    {pool.vms.length === 0 ? (
                      <div style={{ padding: '14px 18px', color: 'var(--text-4)', fontSize: 13 }}>Sin VMs asignadas</div>
                    ) : (
                      <table className="table" style={{ fontSize: 13 }}>
                        <thead>
                          <tr>
                            <th>VM</th>
                            <th>VMID</th>
                            <th>Nodo</th>
                            <th>Estado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pool.vms.map(vm => (
                            <tr key={vm.vmid} style={{ cursor: 'pointer' }} onClick={() => router.push(`/vms/${vm.vmid}`)}>
                              <td style={{ fontWeight: 600, color: 'var(--text)' }}>{vm.name || `VM ${vm.vmid}`}</td>
                              <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-4)' }}>{vm.vmid}</td>
                              <td style={{ color: 'var(--text-3)' }}>{vm.node || '—'}</td>
                              <td>
                                <span style={{ fontSize: 11, color: statusColor(vm.status), fontWeight: 700 }}>
                                  {vm.status || '—'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            )
          })}
          {rows.length === 0 && <div className="card cardPad"><div className="emptyState">Sin grupos disponibles.</div></div>}
        </div>
      )}
    </AppShell>
  )
}
