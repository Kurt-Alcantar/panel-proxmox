import { useMemo, useState } from 'react'
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
} from 'react-simple-maps'

const GEO_URL =
  'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'

function radiusByCount(count) {
  if (count >= 100) return 10
  if (count >= 40) return 8
  if (count >= 10) return 6
  return 4
}

function severityColor(severity) {
  if (severity === 'critical') return '#ff3b30'
  if (severity === 'high') return '#ff9500'
  if (severity === 'medium') return '#ffd60a'
  return '#34c759'
}

export default function AttackWorldMap({ data }) {
  const [hovered, setHovered] = useState(null)
  const points = useMemo(() => data?.points || [], [data])

  return (
    <div className="attack-world-wrap">
      <div className="attack-world-stage">
        <ComposableMap
          projectionConfig={{ scale: 145 }}
          style={{ width: '100%', height: '100%' }}
        >
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  style={{
                    default: {
                      fill: '#121826',
                      stroke: 'rgba(148,163,184,0.18)',
                      strokeWidth: 0.5,
                      outline: 'none',
                    },
                    hover: {
                      fill: '#172033',
                      stroke: 'rgba(148,163,184,0.28)',
                      strokeWidth: 0.5,
                      outline: 'none',
                    },
                    pressed: {
                      fill: '#172033',
                      stroke: 'rgba(148,163,184,0.28)',
                      strokeWidth: 0.5,
                      outline: 'none',
                    },
                  }}
                />
              ))
            }
          </Geographies>

          {points.map((point) => (
            <Marker
              key={`${point.ip}-${point.location.lat}-${point.location.lon}`}
              coordinates={[point.location.lon, point.location.lat]}
              onMouseEnter={() => setHovered(point)}
              onMouseLeave={() => setHovered(null)}
            >
              <circle
                r={radiusByCount(point.count)}
                fill={severityColor(point.severity)}
                fillOpacity={0.78}
                stroke="rgba(255,255,255,0.7)"
                strokeWidth={1}
              />
            </Marker>
          ))}
        </ComposableMap>
      </div>

      <div className="attack-world-overlay">
        <div className="attack-world-summary">
          <div>
            <span>Total eventos</span>
            <strong>{data?.summary?.totalEvents ?? 0}</strong>
          </div>
          <div>
            <span>IPs únicas</span>
            <strong>{data?.summary?.uniqueSourceIps ?? 0}</strong>
          </div>
          <div>
            <span>Top country</span>
            <strong>{data?.summary?.topCountry ?? 'Unknown'}</strong>
          </div>
        </div>

        <div className="attack-world-tooltip">
          {hovered ? (
            <>
              <div className="attack-tip-title">{hovered.ip}</div>
              <div className="attack-tip-row">{hovered.country}{hovered.city ? ` · ${hovered.city}` : ''}</div>
              <div className="attack-tip-row">Eventos: {hovered.count}</div>
              <div className="attack-tip-row">Destino: {hovered.targetHost}</div>
              <div className="attack-tip-row">Severidad: {hovered.severity}</div>
            </>
          ) : (
            <div className="attack-tip-row">Pasa el cursor sobre un punto</div>
          )}
        </div>
      </div>
    </div>
  )
}