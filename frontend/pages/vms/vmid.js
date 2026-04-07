import { useRouter } from 'next/router'
import { useEffect, useMemo, useState } from 'react'
import AppShell from '../../components/AppShell'

const TAB_LABELS = {
  overview: 'Resumen',
  services: 'Servicios',
  logs: 'Logs',
  events: 'Eventos',
  audit: 'Auditoría'
}

export default function VmDetailPage() {
  const router = useRouter()
  const { vmid } = router.query

  const [vm, setVm] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('overview')
  const [auditRows, setAuditRows] = useState([])
  const [auditLoading, setAuditLoading] = useState(false)
  const [auditError, setAuditError] = useState('')

  const fetchVm = async () => {
    const token = localStorage.getItem('token')

    if (!token || !vmid) return

    try {
      setLoading(true)
      const res = await fetch(`/api/vms/${vmid}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })

      if (res.status === 401) {
        localStorage.removeItem('token')
        localStorage.removeItem('refresh_token')
        router.replace('/login')
        return
      }

      if (!res.ok) {
        throw new Error('No se pudo cargar la VM')
      }

      const data = await res.json()
      setVm(data)
    } catch (err) {
      setError(err.message || 'Error cargando detalle')
    } finally {
      setLoading(false)
    }
  }

  const fetchAudit = async () => {
    const token = localStorage.getItem('token')

    if (!token || !vmid) return

    try {
      setAuditLoading(true)
      setAuditError('')
      const res = await fetch(`/api/vms/${vmid}/audit`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })

      if (res.status === 401) {
        localStorage.removeItem('token')
        localStorage.removeItem('refresh_token')
        router.replace('/login')
        return
      }

      if (!res.ok) {
        throw new Error('No se pudo cargar la auditoría de la VM')
      }

      const data = await res.json()
      setAuditRows(data)
    } catch (err) {
      setAuditError(err.message || 'Error cargando auditoría')
    } finally {
      setAuditLoading(false)
    }
  }

  useEffect(() => {
    fetchVm()
  }, [vmid])

  useEffect(() => {
    if (tab === 'audit') {
      fetchAudit()
    }
  }, [tab, vmid])

  const badgeClass = (status) => {
    if (status === 'running') return 'badge running'
    if (status === 'stopped') return 'badge stopped'
    return 'badge unknown'
  }

  const openConsole = async () => {
    const token = localStorage.getItem('token')

    const res = await fetch(`/api/vms/${vmid}/console`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`
      }
    })

    const data = await res.json()
    if (data.url) {
      window.open(data.url, '_blank', 'noopener,noreferrer')
    }
  }

  const formatBytes = (value) => {
    const n = Number(value || 0)
    if (!n) return '-'
    return `${(n / 1024 / 1024 / 1024).toFixed(1)} GB`
  }

  const observability = vm?.observability || null
  const activeDashboard = useMemo(() => {
    if (!observability?.dashboards) return null
    return observability.dashboards[tab] || null
  }, [observability, tab])

  const renderOverview = () => (
    <>
      <div className="metricGrid">
        <div className="card metricCard">
          <div className="metricTitle">Estado VM</div>
          <div className="metricValue">{vm.status || '-'}</div>
        </div>
        <div className="card metricCard">
          <div className="metricTitle">vCPU</div>
          <div className="metricValue">{vm.cpu ?? '-'}</div>
        </div>
        <div className="card metricCard">
          <div className="metricTitle">Memoria</div>
          <div className="metricValue">{formatBytes(vm.memory)}</div>
        </div>
        <div className="card metricCard">
          <div className="metricTitle">Disco</div>
          <div className="metricValue">{formatBytes(vm.disk)}</div>
        </div>
      </div>

      <div className="infoGrid">
        <div className="infoItem">
          <div className="infoLabel">VMID</div>
          <div className="infoValue">{vm.vmid}</div>
        </div>
        <div className="infoItem">
          <div className="infoLabel">Nombre</div>
          <div className="infoValue">{vm.name}</div>
        </div>
        <div className="infoItem">
          <div className="infoLabel">Nodo</div>
          <div className="infoValue">{vm.node}</div>
        </div>
        <div className="infoItem">
          <div className="infoLabel">Pool</div>
          <div className="infoValue">{vm.pool_id || '-'}</div>
        </div>
        <div className="infoItem">
          <div className="infoLabel">SO</div>
          <div className="infoValue">{vm.os_type || '-'}</div>
        </div>
        <div className="infoItem">
          <div className="infoLabel">host.name Elastic</div>
          <div className="infoValue">{observability?.hostName || '-'}</div>
        </div>
      </div>

      <div className="card cardPad observabilitySummary">
        <div className="summaryHead">
          <div>
            <h3>Observabilidad por VM</h3>
            <p>
              Esta sección abre paneles separados por VM con filtro oficial en <strong>host.name</strong>.
            </p>
          </div>
          {observability?.baseUrl && (
            <a className="btn btnSecondary" href={observability.baseUrl} target="_blank" rel="noreferrer">
              Abrir Kibana
            </a>
          )}
        </div>

        <div className="serviceChips">
          {(observability?.services || []).map((service) => (
            <span key={service} className="serviceChip">{service}</span>
          ))}
          {(!observability?.services || observability.services.length === 0) && (
            <span className="muted">Sin servicios definidos</span>
          )}
        </div>
      </div>
    </>
  )

  const renderDashboardTab = () => {
    if (!observability?.enabled) {
      return (
        <div className="card cardPad">
          <div className="errorBox">
            Esta VM todavía no tiene observabilidad habilitada. Debes definir al menos <strong>os_type</strong>, <strong>elastic_host_name</strong> y dejar activa la bandera <strong>observability_enabled</strong>.
          </div>
        </div>
      )
    }

    if (!activeDashboard?.configured || !activeDashboard?.embedUrl) {
      const osTypeUpper = (observability.osType || 'OS').toUpperCase()
      const envName = `KIBANA_${osTypeUpper}_${tab.toUpperCase()}_DASHBOARD_ID`

      return (
        <div className="card cardPad">
          <div className="emptyState">
            Falta configurar el dashboard de esta vista. Define la variable de entorno <strong>{envName}</strong> en el servicio <strong>backend</strong> y reinicia el stack.
          </div>
        </div>
      )
    }

    return (
      <div className="embedSection">
        <div className="embedToolbar">
          <div>
            <div className="embedTitle">{TAB_LABELS[tab]}</div>
            <div className="embedSub">Filtro aplicado: host.name = {observability.hostName}</div>
          </div>

          {activeDashboard.openUrl && (
            <a className="btn btnSecondary" href={activeDashboard.openUrl} target="_blank" rel="noreferrer">
              Abrir en Kibana
            </a>
          )}
        </div>

        <div className="embedWrap large">
          <iframe src={activeDashboard.embedUrl} title={`Kibana ${TAB_LABELS[tab]}`} />
        </div>
      </div>
    )
  }

  const renderAuditTab = () => (
    <div className="auditVmLayout">
      <div className="card cardPad">
        <div className="sectionTitle">Auditoría del portal</div>
        {auditLoading && <p className="muted">Cargando...</p>}
        {auditError && <div className="errorBox">{auditError}</div>}

        {!auditLoading && !auditError && auditRows.length === 0 && (
          <div className="emptyState">Sin acciones registradas para esta VM.</div>
        )}

        {!auditLoading && auditRows.length > 0 && (
          <div className="tableWrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>User ID</th>
                  <th>Acción</th>
                  <th>Resultado</th>
                </tr>
              </thead>
              <tbody>
                {auditRows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.created_at}</td>
                    <td>{row.user_id || '-'}</td>
                    <td>{row.action}</td>
                    <td>{row.result}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {renderDashboardTab()}
    </div>
  )

  const renderActiveTab = () => {
    if (tab === 'overview') return renderOverview()
    if (tab === 'audit') return renderAuditTab()
    return renderDashboardTab()
  }

  return (
    <AppShell
      title={vm ? vm.name : 'Detalle VM'}
      subtitle="Vista operativa, métricas, servicios, logs y auditoría por VM."
    >
      {loading && <p className="muted">Cargando...</p>}
      {error && <div className="errorBox">{error}</div>}

      {!loading && vm && (
        <>
          <div className="detailHeader">
            <div>
              <div className="detailMeta">
                <span className={badgeClass(vm.status)}>{vm.status || 'unknown'}</span>
                <span className="badge unknown">Pool: {vm.pool_id || '-'}</span>
                <span className="badge unknown">VMID: {vm.vmid}</span>
                <span className="badge unknown">SO: {vm.os_type || '-'}</span>
              </div>
            </div>

            <div className="actions">
              <button className="btn btnSecondary" onClick={() => router.push('/vms')}>
                Volver
              </button>
              <button className="btn btnPrimary" onClick={openConsole}>
                Abrir consola
              </button>
            </div>
          </div>

          <div className="tabBar">
            {Object.entries(TAB_LABELS).map(([key, label]) => (
              <button
                key={key}
                className={`tabBtn ${tab === key ? 'active' : ''}`}
                onClick={() => setTab(key)}
              >
                {label}
              </button>
            ))}
          </div>

          {renderActiveTab()}
        </>
      )}
    </AppShell>
  )
}
