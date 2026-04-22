import { useEffect, useRef, useMemo, useState } from 'react'

const DEFAULT_DESTINATION = {
  label: 'Protected infrastructure',
  location: { lat: 23.6345, lon: -102.5528 },
}

function severityColor(severity) {
  if (severity === 'critical') return '#ff4c4c'
  if (severity === 'high') return '#ff9500'
  if (severity === 'medium') return '#ffd60a'
  return '#52ffa8'
}

function formatLastSeen(ts) {
  if (!ts) return '—'
  const dt = new Date(ts)
  if (Number.isNaN(dt.getTime())) return '—'
  return dt.toLocaleString()
}

export default function AttackWorldMap({ data }) {
  const mountRef = useRef(null)
  const globeRef = useRef(null)
  const [activePoint, setActivePoint] = useState(null)
  const [GlobeLib, setGlobeLib] = useState(null)

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

  // Load globe.gl dynamically (SSR safe)
  useEffect(() => {
    import('globe.gl').then((mod) => {
      setGlobeLib(() => mod.default)
    })
  }, [])

  // Build/rebuild globe when lib or container is ready
  useEffect(() => {
    if (!GlobeLib || !mountRef.current) return

    const el = mountRef.current
    const width = el.clientWidth || 700
    const height = el.clientHeight || 460

    // Destroy previous instance
    if (globeRef.current) {
      globeRef.current._destructor?.()
      el.innerHTML = ''
    }

    const globe = GlobeLib()(el)
    globeRef.current = globe

    globe
      .width(width)
      .height(height)
      .backgroundColor('rgba(0,0,0,0)')
      .showAtmosphere(true)
      .atmosphereColor('rgba(103,232,249,0.25)')
      .atmosphereAltitude(0.18)
      .globeImageUrl(
        'https://unpkg.com/three-globe@2.31.0/example/img/earth-dark.jpg'
      )
      .bumpImageUrl(
        'https://unpkg.com/three-globe@2.31.0/example/img/earth-topology.png'
      )

    // Auto-rotate
    globe.controls().autoRotate = true
    globe.controls().autoRotateSpeed = 0.4
    globe.controls().enableZoom = true
    globe.controls().minDistance = 150
    globe.controls().maxDistance = 600

    // Point of view centred on Mexico (destination)
    globe.pointOfView(
      { lat: destination.location.lat, lng: destination.location.lon, altitude: 2.2 },
      0
    )

    return () => {
      globeRef.current?._destructor?.()
      if (el) el.innerHTML = ''
      globeRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [GlobeLib])

  // Update arcs, rings and labels whenever data changes
  useEffect(() => {
    const globe = globeRef.current
    if (!globe) return

    // --- Arcs (attack paths) ---
    const arcs = visiblePoints.map((point, i) => ({
      startLat: point.location.lat,
      startLng: point.location.lon,
      endLat: destination.location.lat,
      endLng: destination.location.lon,
      color: severityColor(point.severity),
      stroke: point.severity === 'critical' ? 1.2 : 0.7,
      dashLength: 0.4,
      dashGap: 0.2,
      animateTime: Math.max(800, 2000 - i * 50),
      _point: point,
    }))

    globe
      .arcsData(arcs)
      .arcColor('color')
      .arcStroke('stroke')
      .arcDashLength('dashLength')
      .arcDashGap('dashGap')
      .arcDashAnimateTime('animateTime')
      .arcAltitude(0.3)
      .onArcHover((arc) => setActivePoint(arc ? arc._point : null))

    // --- Origin rings ---
    const rings = visiblePoints.map((point) => ({
      lat: point.location.lat,
      lng: point.location.lon,
      maxR: point.severity === 'critical' ? 3.5 : 2.2,
      propagationSpeed: 2,
      repeatPeriod: 900,
      color: severityColor(point.severity),
    }))

    globe
      .ringsData(rings)
      .ringColor('color')
      .ringMaxRadius('maxR')
      .ringPropagationSpeed('propagationSpeed')
      .ringRepeatPeriod('repeatPeriod')

    // --- Destination point ---
    const destPoint = [
      {
        lat: destination.location.lat,
        lng: destination.location.lon,
        size: 0.6,
        color: '#67e8f9',
        label: destination.label,
      },
    ]

    globe
      .pointsData(destPoint)
      .pointColor('color')
      .pointAltitude('size')
      .pointRadius(0.5)
      .pointLabel('label')

    // --- HTML Labels for origin IPs ---
    const labels = visiblePoints.map((point) => ({
      lat: point.location.lat,
      lng: point.location.lon,
      text: point.ip,
      color: severityColor(point.severity),
      size: 0.4,
      _point: point,
    }))

    globe
      .labelsData(labels)
      .labelLat('lat')
      .labelLng('lng')
      .labelText('text')
      .labelColor('color')
      .labelSize('size')
      .labelDotRadius(0.3)
      .labelResolution(2)
  }, [visiblePoints, destination])

  return (
    <div className="attack-world-wrap attack-world-wrap-kaspersky" style={{ position: 'relative' }}>
      <div
        className="attack-world-stage"
        style={{ position: 'relative', width: '100%', height: '100%', minHeight: 460 }}
      >
        <div className="attack-world-live-badge">LIVE TELEMETRY 3D</div>
        <div
          ref={mountRef}
          style={{ width: '100%', height: '100%', minHeight: 460, cursor: 'grab' }}
        />
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
              <div className="attack-tip-eyebrow">Mapa táctico 3D</div>
              <div className="attack-tip-title">Sin rutas activas</div>
              <div className="attack-tip-row">Pasa el cursor sobre un arco para ver los detalles del ataque.</div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}