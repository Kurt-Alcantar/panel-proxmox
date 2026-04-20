import AppShell from '../components/AppShell'

const agents = [
  { name: 'srv-sql-prod-01', version: '8.19.14', policy: 'windows-prod', state: 'online' },
  { name: 'srv-veeam-bkp', version: '8.19.14', policy: 'windows-backup', state: 'online' },
  { name: 'srv-web-edge-02', version: '8.19.14', policy: 'linux-edge', state: 'offline' },
]

export default function FleetAgentsPage() {
  return (
    <AppShell title="Fleet agents" subtitle="Vista base para continuar con el wiring de Fleet sin tocar backend todavía.">
      <div className="card">
        <div className="overview-card-head compact">
          <h3>Registered agents</h3>
          <span className="ch-meta">{agents.length} agents</span>
        </div>
        <div className="overview-list-wrap">
          {agents.map((agent) => (
            <div className="top-asset-row" key={agent.name}>
              <div className="top-asset-icon">•</div>
              <div>
                <div className="top-asset-name">{agent.name}</div>
                <div className="top-asset-meta">{agent.policy} · {agent.version} · {agent.state}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  )
}
