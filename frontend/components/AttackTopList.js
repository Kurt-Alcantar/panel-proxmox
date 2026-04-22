export default function AttackTopList({ data = null }) {
  const points = (data?.points || []).slice().sort((a, b) => b.count - a.count).slice(0, 8)

  return (
    <div className="attack-top-list">
      <div className="overview-card-head compact">
        <h3>Top attacking IPs · 24h</h3>
        <span className="ch-meta">{points.length} visibles</span>
      </div>

      <div className="attack-top-items">
        {points.length === 0 ? (
          <div className="muted">Sin datos geolocalizados.</div>
        ) : points.map((item) => (
          <div className="attack-top-item" key={item.ip}>
            <div>
              <div className="attack-top-ip">{item.ip}</div>
              <div className="attack-top-meta">
                {item.country}{item.city ? ` · ${item.city}` : ''} · {item.targetHost}
              </div>
            </div>
            <div className={`attack-sev sev-${item.severity}`}>{item.count}</div>
          </div>
        ))}
      </div>
    </div>
  )
}