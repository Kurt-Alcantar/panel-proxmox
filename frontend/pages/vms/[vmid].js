import { useRouter } from 'next/router'
import { useEffect, useMemo, useState } from 'react'
import AppShell from '../../components/AppShell'

const WINDOWS_TABS = {
  overview: 'Resumen',
  security: 'Seguridad',
  services: 'Servicios',
  events: 'Eventos',
  audit: 'Auditoría'
}

function KpiCard({ label, value, tone = 'default' }) {
  return (
    <div className={`card metricCard tone-${tone}`}>
      <div className="metricTitle">{label}</div>
      <div className="metricValue">{value ?? '-'}</div>
    </div>
  )
}

function MiniBarList({ rows, emptyText = 'Sin datos' }) {
  if (!rows || rows.length === 0) return <div className="emptyState">{emptyText}</div>

  const max = Math.max(...rows.map((row) => row.count || 0), 1)

  return (
    <div className="miniBarList">
      {rows.map((row) => (
        <div className="miniBarRow" key={row.key}>
          <div className="miniBarTop">
            <span className="miniBarLabel">{row.key || '(vacío)'}</span>
            <span className="miniBarCount">{row.count}</span>
          </div>
          <div className="miniBarTrack">
            <div className="miniBarFill" style={{ width: `${(row.count / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function DataTable({ columns, rows, emptyText = 'Sin datos' }) {
  if (!rows || rows.length === 0) {
    return <div className="emptyState">{emptyText}</div>
  }

  return (
    <div className="tableWrap">
      <table className="table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id || row.timestamp || index}>
              {columns.map((column) => (
                <td key={column.key}>{row[column.key] || '-'}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function VmDetailPage() {
  const router = useRouter()
  const { vmid } = router.query

  const [vm, setVm] = useState(null)
  const [tab, setTab] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [overview, setOverview] = useState(null)
  const [security, setSecurity] = useState(null)
  const [services, setServices] = useState(null)
  const [events, setEvents] = useState(null)
  const [auditRows, setAuditRows] = useState([])
  const [tabLoading, setTabLoading] = useState(false)
  const [tabError, setTabError] = useState('')

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null

  const apiGet = async (path) => {
    const activeToken = localStorage.getItem('token')
    if (!activeToken) {
      router.replace('/login')
      return null
    }

    const res = await fetch(path, {
      headers: {
        Authorization: `Bearer ${activeToken}`
      }
    })

    if (res.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('refresh_token')
      router.replace('/login')
      return null
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.message || 'Error consultando API')
    }

    return res.json()
  }

  const fetchVm = async () => {
    if (!vmid || !token) return

    try {
      setLoading(true)
      setError('')
      const data = await apiGet(`/api/vms/${vmid}`)
      if (data) setVm(data)
    } catch (err) {
      setError(err.message || 'No se pudo cargar la VM')
    } finally {
      setLoading(false)
    }
  }

  const fetchTabData = async () => {
    if (!vmid || !token) return
    if (tab === 'overview' && overview) return
    if (tab === 'security' && security) return
    if (tab === 'services' && services) return
    if (tab === 'events' && events) return
    if (tab === 'audit' && auditRows.length) return

    try {
      setTabLoading(true)
      setTabError('')

      if (tab === 'overview') {
        const data = await apiGet(`/api/vms/${vmid}/observability/overview`)
        if (data) setOverview(data)
      }

      if (tab === 'security') {
        const data = await apiGet(`/api/vms/${vmid}/observability/security`)
        if (data) setSecurity(data)
      }

      if (tab === 'services') {
        const data = await apiGet(`/api/vms/${vmid}/observability/services`)
        if (data) setServices(data)
      }

      if (tab === 'events') {
        const data = await apiGet(`/api/vms/${vmid}/observability/events`)
        if (data) setEvents(data)
      }

      if (tab === 'audit') {
        const data = await apiGet(`/api/vms/${vmid}/audit`)
        if (data) setAuditRows(data)
      }
    } catch (err) {
      setTabError(err.message || 'No se pudo cargar la vista')
    } finally {
      setTabLoading(false)
    }
  }

  useEffect(() => {
    fetchVm()
  }, [vmid])

  useEffect(() => {
    fetchTabData()
  }, [tab, vmid])

  const formatBytes = (value) => {
    const n = Number(value || 0)
    if (!n) return '-'
    return `${(n / 1024 / 1024 / 1024).toFixed(1)} GB`
  }

  const formatPct = (value) => {
    if (value === null || value === undefined) return '-'
    return `${Number(value).toFixed(1)}%`
  }

  const observability = vm?.observability || { enabled: false, services: [] }

  const renderOverview = () => (
    <>
      <div className="metricGrid">
        <KpiCard label="Estado VM" value={vm?.status || '-'} />
        <KpiCard label="vCPU" value={vm?.cpu ?? '-'} />
        <KpiCard label="Memoria" value={formatBytes(vm?.memory)} />
        <KpiCard label="Disco" value={formatBytes(vm?.disk)} />
      </div>

      <div className="nativeGridTwo">
        <div className="card cardPad">
          <div className="sectionTitle">Resumen operativo 24h</div>
          {tabLoading && !overview && <div className="muted">Cargando...</div>}
          {overview?.enabled === false && <div className="emptyState">{overview.reason}</div>}
          {overview?.enabled !== false && overview && (
            <>
              <div className="metricGrid compact">
                <KpiCard label="CPU promedio" value={formatPct(overview.cpuAvgPct)} tone="info" />
                <KpiCard label="Memoria usada" value={formatPct(overview.memoryUsedPct)} tone="info" />
                <KpiCard label="Disco usado" value={formatPct(overview.diskUsedPct)} tone="info" />
                <KpiCard label="Errores 24h" value={overview.errorCount24h} tone="danger" />
              </div>
              <div className="infoGrid compactInfoGrid">
                <div className="infoItem"><div className="infoLabel">Último check-in</div><div className="infoValue">{overview.lastSeen || '-'}</div></div>
                <div className="infoItem"><div className="infoLabel">host.name Elastic</div><div className="infoValue">{overview.hostName || '-'}</div></div>
                <div className="infoItem"><div className="infoLabel">SO</div><div className="infoValue">{overview.osType || '-'}</div></div>
                <div className="infoItem"><div className="infoLabel">Kibana</div><div className="infoValue">{overview.kibanaUrl || '-'}</div></div>
              </div>
            </>
          )}
        </div>

        <div className="card cardPad">
          <div className="sectionTitle">Servicios monitoreados</div>
          <div className="serviceChips native">
            {(observability.services || []).map((service) => (
              <span key={service} className="serviceChip">{service}</span>
            ))}
            {!observability.services?.length && <span className="muted">Sin servicios definidos</span>}
          </div>
          <div className="summaryActions">
            {observability.baseUrl && (
              <a className="btn btnSecondary" href={observability.baseUrl} target="_blank" rel="noreferrer">Abrir Kibana</a>
            )}
          </div>
        </div>
      </div>

      <div className="card cardPad">
        <div className="sectionTitle">Errores recientes</div>
        <DataTable
          columns={[
            { key: 'timestamp', label: 'Fecha' },
            { key: 'level', label: 'Nivel' },
            { key: 'serviceName', label: 'Servicio' },
            { key: 'processName', label: 'Proceso' },
            { key: 'dataset', label: 'Dataset' },
            { key: 'message', label: 'Mensaje' }
          ]}
          rows={overview?.recentErrors || []}
          emptyText="Sin errores en las últimas 24 horas."
        />
      </div>
    </>
  )

  const renderSecurity = () => {
    if (security?.enabled === false) {
      return <div className="card cardPad"><div className="emptyState">{security.reason}</div></div>
    }

    return (
      <>
        <div className="metricGrid compact">
          <KpiCard label="Logons exitosos" value={security?.kpis?.successLogons24h ?? '-'} tone="success" />
          <KpiCard label="Logons fallidos" value={security?.kpis?.failedLogons24h ?? '-'} tone="danger" />
          <KpiCard label="Bloqueos" value={security?.kpis?.lockouts24h ?? '-'} tone="warning" />
          <KpiCard label="Privilegios" value={security?.kpis?.privilegeEvents24h ?? '-'} tone="warning" />
          <KpiCard label="Cambios usuario" value={security?.kpis?.userChanges24h ?? '-'} tone="info" />
          <KpiCard label="Grupos privilegiados" value={security?.kpis?.groupChanges24h ?? '-'} tone="info" />
          <KpiCard label="Accesos remotos" value={security?.kpis?.remoteAccess24h ?? '-'} tone="info" />
        </div>

        <div className="nativeGridTwo">
          <div className="card cardPad">
            <div className="sectionTitle">Fallos por usuario</div>
            <MiniBarList rows={security?.failuresByUser || []} emptyText="Sin fallos agrupados por usuario" />
          </div>
          <div className="card cardPad">
            <div className="sectionTitle">Fallos por IP</div>
            <MiniBarList rows={security?.failuresByIp || []} emptyText="Sin fallos agrupados por IP" />
          </div>
        </div>

        <div className="card cardPad">
          <div className="sectionTitle">Logons exitosos recientes</div>
          <DataTable columns={[
            { key: 'timestamp', label: 'Fecha' },
            { key: 'user', label: 'Usuario' },
            { key: 'sourceIp', label: 'IP' },
            { key: 'logonType', label: 'Tipo logon' },
            { key: 'message', label: 'Mensaje' }
          ]} rows={security?.recentSuccess || []} />
        </div>

        <div className="card cardPad">
          <div className="sectionTitle">Logons fallidos recientes</div>
          <DataTable columns={[
            { key: 'timestamp', label: 'Fecha' },
            { key: 'user', label: 'Usuario' },
            { key: 'sourceIp', label: 'IP' },
            { key: 'status', label: 'Status' },
            { key: 'subStatus', label: 'SubStatus' },
            { key: 'message', label: 'Mensaje' }
          ]} rows={security?.recentFailed || []} />
        </div>

        <div className="nativeGridTwo">
          <div className="card cardPad">
            <div className="sectionTitle">Eventos de privilegio</div>
            <DataTable columns={[
              { key: 'timestamp', label: 'Fecha' },
              { key: 'eventCode', label: 'Evento' },
              { key: 'user', label: 'Usuario' },
              { key: 'privilegeList', label: 'Privilegios' },
              { key: 'message', label: 'Mensaje' }
            ]} rows={security?.privilegeEvents || []} />
          </div>
          <div className="card cardPad">
            <div className="sectionTitle">Cambios administrativos</div>
            <DataTable columns={[
              { key: 'timestamp', label: 'Fecha' },
              { key: 'eventCode', label: 'Evento' },
              { key: 'targetUser', label: 'Usuario objetivo' },
              { key: 'actorUser', label: 'Actor' },
              { key: 'memberName', label: 'Miembro' },
              { key: 'message', label: 'Mensaje' }
            ]} rows={security?.userChanges || []} />
          </div>
        </div>

        <div className="card cardPad">
          <div className="sectionTitle">RDP / WinRM / PSRemoting</div>
          <DataTable columns={[
            { key: 'timestamp', label: 'Fecha' },
            { key: 'user', label: 'Usuario' },
            { key: 'sourceIp', label: 'IP' },
            { key: 'processName', label: 'Proceso' },
            { key: 'logonType', label: 'Tipo' },
            { key: 'message', label: 'Mensaje' }
          ]} rows={security?.remoteAccess || []} />
        </div>
      </>
    )
  }

  const renderServices = () => {
    if (services?.enabled === false) {
      return <div className="card cardPad"><div className="emptyState">{services.reason}</div></div>
    }

    return (
      <>
        <div className="card cardPad">
          <div className="sectionTitle">Estado de servicios</div>
          <DataTable columns={[
            { key: 'timestamp', label: 'Fecha' },
            { key: 'serviceName', label: 'Servicio' },
            { key: 'state', label: 'Estado' },
            { key: 'message', label: 'Mensaje' }
          ]} rows={services?.rows || []} emptyText="No se detectaron estados recientes para los servicios configurados." />
        </div>

        <div className="card cardPad">
          <div className="sectionTitle">Servicios configurados sin telemetría reciente</div>
          <div className="serviceChips native">
            {(services?.missingConfiguredServices || []).map((service) => (
              <span key={service} className="serviceChip mutedChip">{service}</span>
            ))}
            {(!services?.missingConfiguredServices || services.missingConfiguredServices.length === 0) && (
              <span className="muted">Todos los servicios configurados tuvieron al menos un evento reciente.</span>
            )}
          </div>
        </div>
      </>
    )
  }

  const renderEvents = () => (
    <div className="card cardPad">
      <div className="sectionTitle">Eventos recientes del host</div>
      <DataTable columns={[
        { key: 'timestamp', label: 'Fecha' },
        { key: 'channel', label: 'Canal' },
        { key: 'eventCode', label: 'Evento' },
        { key: 'action', label: 'Acción' },
        { key: 'level', label: 'Nivel' },
        { key: 'processName', label: 'Proceso' },
        { key: 'serviceName', label: 'Servicio' },
        { key: 'sourceIp', label: 'IP' },
        { key: 'message', label: 'Mensaje' }
      ]} rows={events?.rows || []} />
    </div>
  )

  const renderAudit = () => (
    <div className="card cardPad">
      <div className="sectionTitle">Auditoría del portal</div>
      <DataTable columns={[
        { key: 'created_at', label: 'Fecha' },
        { key: 'user_id', label: 'User ID' },
        { key: 'action', label: 'Acción' },
        { key: 'result', label: 'Resultado' }
      ]} rows={auditRows || []} emptyText="Sin acciones registradas para esta VM." />
    </div>
  )

  const activeTabView = useMemo(() => {
    if (tab === 'overview') return renderOverview()
    if (tab === 'security') return renderSecurity()
    if (tab === 'services') return renderServices()
    if (tab === 'events') return renderEvents()
    if (tab === 'audit') return renderAudit()
    return null
  }, [tab, vm, overview, security, services, events, auditRows, tabLoading])

  return (
    <AppShell title={vm ? vm.name : 'Detalle VM'} subtitle="Dashboard nativo Windows sin iframe, consumiendo Elasticsearch directamente.">
      {loading && <div className="portal-info">Cargando...</div>}
      {error && <div className="errorBox">{error}</div>}

      {!loading && vm && (
        <>
          <div className="detailHeader">
            <div>
              <div className="detailMeta">
                <span className={`badge ${vm.status === 'running' ? 'running' : vm.status === 'stopped' ? 'stopped' : 'unknown'}`}>{vm.status || 'unknown'}</span>
                <span className="badge unknown">Pool: {vm.pool_id || '-'}</span>
                <span className="badge unknown">VMID: {vm.vmid}</span>
                <span className="badge unknown">SO: {vm.os_type || '-'}</span>
              </div>
            </div>

            <div className="actions">
              <button className="btn btnSecondary" onClick={() => router.push('/vms')}>Volver</button>
              <button className="btn btnPrimary" onClick={async () => {
                const res = await fetch(`/api/vms/${vmid}/console`, { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
                const data = await res.json()
                if (data?.url) window.open(data.url, '_blank', 'noopener,noreferrer')
              }}>Abrir consola</button>
            </div>
          </div>

          <div className="infoGrid compactInfoGrid">
            <div className="infoItem"><div className="infoLabel">Nombre</div><div className="infoValue">{vm.name}</div></div>
            <div className="infoItem"><div className="infoLabel">Nodo</div><div className="infoValue">{vm.node || '-'}</div></div>
            <div className="infoItem"><div className="infoLabel">host.name Elastic</div><div className="infoValue">{observability.hostName || '-'}</div></div>
            <div className="infoItem"><div className="infoLabel">Observabilidad</div><div className="infoValue">{observability.enabled ? 'Habilitada' : 'No habilitada'}</div></div>
          </div>

          <div className="tabBar">
            {Object.entries(WINDOWS_TABS).map(([key, label]) => (
              <button key={key} className={`tabBtn ${tab === key ? 'active' : ''}`} onClick={() => setTab(key)}>{label}</button>
            ))}
          </div>

          {tabLoading && <div className="portal-info">Cargando vista...</div>}
          {tabError && <div className="errorBox">{tabError}</div>}

          {activeTabView}
        </>
      )}
    </AppShell>
  )
}
