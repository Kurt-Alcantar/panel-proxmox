import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import AppShell from '../../components/AppShell'

export default function VmDetailPage() {
  const router = useRouter()
  const { vmid } = router.query

  const [vm, setVm] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('overview')

  const fetchVm = async () => {
    const token = localStorage.getItem('token')

    if (!token || !vmid) return

    try {
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

  useEffect(() => {
    fetchVm()
  }, [vmid])

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

  const renderOverview = () => (
    <>
      <div className="metricGrid">
        <div className="card metricCard">
          <div className="metricTitle">Estado</div>
          <div className="metricValue">{vm.status || '-'}</div>
        </div>
        <div className="card metricCard">
          <div className="metricTitle">CPU</div>
          <div className="metricValue">{vm.cpu ?? '-'}</div>
        </div>
        <div className="card metricCard">
          <div className="metricTitle">Memory</div>
          <div className="metricValue">{vm.memory ?? '-'}</div>
        </div>
        <div className="card metricCard">
          <div className="metricTitle">Disk</div>
          <div className="metricValue">{vm.disk ?? '-'}</div>
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
      </div>
    </>
  )

  const renderDashboards = () => {
    const kibanaUrl = `http://192.168.10.163:5601/app/dashboards#/view/VM-OVERVIEW?embed=true&_g=(time:(from:now-24h,to:now))&_a=(query:(language:kuery,query:'host.name:"${vm.name}"'))`

    return (
      <div className="embedWrap">
        <iframe src={kibanaUrl} title="Elastic Dashboard" />
      </div>
    )
  }

  return (
    <AppShell
      title={vm ? vm.name : 'Detalle VM'}
      subtitle="Vista operativa, métricas y dashboards."
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
            <button
              className={`tabBtn ${tab === 'overview' ? 'active' : ''}`}
              onClick={() => setTab('overview')}
            >
              Overview
            </button>
            <button
              className={`tabBtn ${tab === 'dashboards' ? 'active' : ''}`}
              onClick={() => setTab('dashboards')}
            >
              Dashboards
            </button>
          </div>

          {tab === 'overview' && renderOverview()}
          {tab === 'dashboards' && renderDashboards()}
        </>
      )}
    </AppShell>
  )
}