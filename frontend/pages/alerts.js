import AppShell from '../components/AppShell'

const alerts = [
  { title: 'Disk usage > 90% on srv-veeam-bkp', severity: 'Crítica', source: 'srv-veeam-bkp', rule: 'disk.used_pct > 90', ago: '8m ago' },
  { title: 'Failed logon spike on DC01', severity: 'Warning', source: 'DC01', rule: 'logon.fail > 20/5m', ago: '12m ago' },
  { title: 'Veeam job warning', severity: 'Warning', source: 'srv-veeam-bkp', rule: 'veeam.result = warning', ago: '1h ago' },
]

export default function AlertsPage() {
  return (
    <AppShell title="Alerts" subtitle="Vista de alertas activas con la misma estética del nuevo overview.">
      <div className="card">
        <div className="overview-card-head compact">
          <h3>Open incidents</h3>
          <span className="ch-meta">3 active</span>
        </div>
        <div className="overview-list-wrap">
          {alerts.map((alert) => (
            <div className="alert-row" key={alert.title}>
              <span className={`alert-accent ${alert.severity === 'Crítica' ? 'critical' : 'warning'}`} />
              <div>
                <div className="alert-title">{alert.title}</div>
                <div className="alert-meta">{alert.source} · {alert.rule}</div>
              </div>
              <div className="alert-ago">{alert.ago}</div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  )
}
