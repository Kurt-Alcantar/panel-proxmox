import { useMemo } from 'react'
import AppShell from '../components/AppShell'

const pools = [
  { name: 'ACME-DB', count: 8, status: 'healthy' },
  { name: 'ACME-WEB', count: 12, status: 'healthy' },
  { name: 'BACKUP', count: 4, status: 'warning' },
  { name: 'EDGE', count: 6, status: 'healthy' },
]

export default function PoolsPage() {
  const total = useMemo(() => pools.reduce((acc, item) => acc + item.count, 0), [])

  return (
    <AppShell title="Pools" subtitle={`Agrupación visual de recursos. ${total} VMs referenciadas.`}>
      <div className="vmCardGrid">
        {pools.map((pool, idx) => (
          <div className="vmCard" key={pool.name}>
            <div className="vmCardTop">
              <div>
                <div className="vmCardTitleBtn">{pool.name}</div>
                <div className="vmCardTags"><span className="vmTag">Pool</span></div>
              </div>
              <span className={`vm-status ${pool.status === 'healthy' ? 'running' : 'paused'}`}>{pool.status}</span>
            </div>
            <div className="vmMetrics">
              <div className="vmMetric"><div className="vmMetricLabel">Assets</div><div className="vmMetricValue">{pool.count}</div></div>
              <div className="vmMetric"><div className="vmMetricLabel">CPU tier</div><div className="vmMetricValue">Balanced</div></div>
              <div className="vmMetric"><div className="vmMetricLabel">Origin</div><div className="vmMetricValue">Proxmox</div></div>
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  )
}
