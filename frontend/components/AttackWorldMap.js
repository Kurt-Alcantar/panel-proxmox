import { useEffect, useMemo, useState } from 'react'
import {
  ComposableMap,
  Geographies,
  Geography,
  Graticule,
  Line,
  Marker,
  Sphere,
  ZoomableGroup,
} from 'react-simple-maps'

const GEO_URL =
  'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'

const DEFAULT_DESTINATION = {
  label: 'Protected infrastructure',
  location: { lat: 23.6345, lon: -102.5528 },
}

function severityColor(severity) {
  if (severity === 'critical') return 'rgba(255, 76, 76, 0.98)'
  if (severity === 'high') return 'rgba(255, 149, 0, 0.96)'
  if (severity === 'medium') return 'rgba(255, 214, 10, 0.94)'
  return 'rgba(82, 255, 168, 0.9)'
}

function traceWidth(count) {
  if (count >= 100) return 2.8
  if (count >= 40) return 2.2
  if (count >= 10) return 1.8
  return 1.35
}

function formatLastSeen(ts) {
  if (!ts) return '—'
  const dt = new Date(ts)
  if (Number.isNaN(dt.getTime())) return '—'
  return dt.toLocaleString()
}

export default function AttackWorldMap({ data }) {
  const [hovered, setHovered] = useState(null)
  const [activeIndex, setActiveIndex] = useState(0)

  const destination = useMemo(() => {
    const lat = Number(data?.destination?.location?.lat)
    const lon = Number(data?.destination?.location?.lon)
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      return {
        label: data?.destination?.label || DEFAULT_DESTINATION.label,
        location: { lat, lon },
      }
    }
    return DEFAULT_DESTINATION
  }, [data])

  const visiblePoints = useMemo(() => (data?.points || []).slice(0, 24), [data])

  useEffect(() => {
    if (!visiblePoints.length) return undefined
    const id = setInterval(() => {
      setActiveIndex((current) => (current + 1) % visiblePoints.length)
    }, 1400)
    return () => clearInterval(id)
  }, [visiblePoints.length])

  const activePoint = hovered || (visiblePoints.length ? visiblePoints[activeIndex % visiblePoints.length] : null)

  return (
    <div className="attack-world-wrap attack-world-wrap-kaspersky">
      <div className="attack-world-stage">
        <div className="attack-world-live-badge">LIVE TELEMETRY</div>

        <ComposableMap
          projection="geoEqualEarth"
          projectionConfig={{ scale: 175 }}
          style={{ width: '100%', height: '100%' }}
        >
          <Sphere
            fill="transparent"
            stroke="rgba(103, 232, 249, 0.18)"
            strokeWidth={0.8}
          />
          <Graticule stroke="rgba(94, 234, 212, 0.08)" strokeWidth={0.35} />

          <ZoomableGroup center={[0, 15]} zoom={1.02}>
            <Geographies geography={GEO_URL}>
              {({ geographies }) =>
                geographies.map((geo) => (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    style={{
                      default: {
                        fill: '#08111d',
                        stroke: 'rgba(103, 232, 249, 0.14)',
                        strokeWidth: 0.55,
                        outline: 'none',
                      },
                      hover: {
                        fill: '#0d1a2c',
                        stroke: 'rgba(103, 232, 249, 0.22)',
                        strokeWidth: 0.55,
                        outline: 'none',
                      },
                      pressed: {
                        fill: '#0d1a2c',
                        stroke: 'rgba(103, 232, 249, 0.22)',
                        strokeWidth: 0.55,
                        outline: 'none',
                      },
                    }}
                  />
                ))
              }
            </Geographies>

            {visiblePoints.map((point, index) => {
              const isActive = activePoint?.ip === point.ip
              const duration = `${Math.max(1.35, 2.6 - index * 0.06)}s`
              const severity = point.severity || 'low'
              return (
                <g key={`${point.ip}-${point.location?.lat}-${point.location?.lon}`}>
                  <Line
                    from={[point.location.lon, point.location.lat]}
                    to={[destination.location.lon, destination.location.lat]}
                    stroke="rgba(103, 232, 249, 0.1)"
                    strokeWidth={traceWidth(point.count) + 2.4}
                    className="attack-trace-glow"
                  />
                  <Line
                    from={[point.location.lon, point.location.lat]}
                    to={[destination.location.lon, destination.location.lat]}
                    stroke={severityColor(severity)}
                    strokeWidth={traceWidth(point.count)}
                    className={`attack-trace attack-trace-${severity}${isActive ? ' is-active' : ''}`}
                    style={{ '--trace-duration': duration }}
                    onMouseEnter={() => setHovered(point)}
                    onMouseLeave={() => setHovered(null)}
                  />
                </g>
              )
            })}

            {visiblePoints.map((point) => {
              const isActive = activePoint?.ip === point.ip
              return (
                <Marker
                  key={`origin-${point.ip}`}
                  coordinates={[point.location.lon, point.location.lat]}
                  onMouseEnter={() => setHovered(point)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <g className={`attack-origin${isActive ? ' is-active' : ''}`} style={{ color: severityColor(point.severity) }}>
                    <circle className="attack-origin-ping" r={isActive ? 8 : 6.5} />
                    <circle className="attack-origin-core" r={isActive ? 3.8 : 3.1} />
                  </g>
                </Marker>
              )
            })}

            <Marker coordinates={[destination.location.lon, destination.location.lat]}>
              <g className="attack-destination">
                <circle className="attack-destination-ring ring-1" r="12" />
                <circle className="attack-destination-ring ring-2" r="18" />
                <circle className="attack-destination-ring ring-3" r="24" />
                <circle className="attack-destination-core" r="5" />
                <text className="attack-destination-label" y={-28} textAnchor="middle">
                  {destination.label}
                </text>
              </g>
            </Marker>
          </ZoomableGroup>
        </ComposableMap>
      </div>

      <div className="attack-world-overlay">
        <div className="attack-world-summary attack-world-summary-kaspersky">
          <div>
            <span>Eventos geolocalizados</span>
            <strong>{data?.summary?.totalEvents ?? 0}</strong>
          </div>
          <div>
            <span>Orígenes activos</span>
            <strong>{visiblePoints.length}</strong>
          </div>
          <div>
            <span>Top country</span>
            <strong>{data?.summary?.topCountry ?? 'Unknown'}</strong>
          </div>
          <div>
            <span>Destino</span>
            <strong>{destination.label}</strong>
          </div>
        </div>

        <div className="attack-world-tooltip attack-world-tooltip-kaspersky">
          {activePoint ? (
            <>
              <div className="attack-tip-eyebrow">Ruta activa</div>
              <div className="attack-tip-title">{activePoint.ip}</div>
              <div className="attack-tip-route">
                <span>{activePoint.country}{activePoint.city ? ` · ${activePoint.city}` : ''}</span>
                <strong>→</strong>
                <span>{destination.label}</span>
              </div>
              <div className="attack-tip-row">Eventos: <strong>{activePoint.count}</strong></div>
              <div className="attack-tip-row">Host destino: <strong>{activePoint.targetHost || 'unknown-host'}</strong></div>
              <div className="attack-tip-row">Severidad: <strong>{activePoint.severity}</strong></div>
              <div className="attack-tip-row">Último evento: <strong>{formatLastSeen(activePoint.lastSeen)}</strong></div>
            </>
          ) : (
            <>
              <div className="attack-tip-eyebrow">Mapa táctico</div>
              <div className="attack-tip-title">Sin rutas activas</div>
              <div className="attack-tip-row">Cuando haya eventos con GeoIP se dibujarán flujos hacia el servidor protegido.</div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
