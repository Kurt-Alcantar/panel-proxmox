import { useEffect, useRef, useMemo, useState, useCallback } from 'react'
import * as THREE from 'three'

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

function severityColorVec(severity) {
  if (severity === 'critical') return new THREE.Color('#ff4c4c')
  if (severity === 'high') return new THREE.Color('#ff9500')
  if (severity === 'medium') return new THREE.Color('#ffd60a')
  return new THREE.Color('#52ffa8')
}

function formatLastSeen(ts) {
  if (!ts) return '—'
  const dt = new Date(ts)
  if (Number.isNaN(dt.getTime())) return '—'
  return dt.toLocaleString()
}

function latLonToVec3(lat, lon, radius) {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lon + 180) * (Math.PI / 180)
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  )
}

function buildArcPoints(fromLat, fromLon, toLat, toLon, radius, segments = 80) {
  const from = latLonToVec3(fromLat, fromLon, radius)
  const to = latLonToVec3(toLat, toLon, radius)
  const mid = from.clone().add(to).multiplyScalar(0.5)
  const arcHeight = radius * 0.45
  mid.setLength(mid.length() + arcHeight)
  const curve = new THREE.QuadraticBezierCurve3(from, mid, to)
  return curve.getPoints(segments)
}

function buildPulseRing(lat, lon, radius) {
  const pos = latLonToVec3(lat, lon, radius + 0.01)
  const geometry = new THREE.RingGeometry(0.008, 0.014, 32)
  const material = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#67e8f9'),
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.copy(pos)
  mesh.lookAt(new THREE.Vector3(0, 0, 0))
  mesh.rotateX(Math.PI / 2)
  return mesh
}

export default function AttackWorldMap({ data }) {
  const mountRef = useRef(null)
  const rendererRef = useRef(null)
  const sceneRef = useRef(null)
  const cameraRef = useRef(null)
  const frameRef = useRef(null)
  const arcsGroupRef = useRef(null)
  const ringsGroupRef = useRef(null)
  const arcProgressRef = useRef([])
  const ringScalesRef = useRef([])
  const isDraggingRef = useRef(false)
  const prevMouseRef = useRef({ x: 0, y: 0 })
  const rotationRef = useRef({ x: 0.4, y: 0 })

  const [activePoint, setActivePoint] = useState(null)

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

  // Init Three.js scene
  useEffect(() => {
    const el = mountRef.current
    if (!el) return

    const width = el.clientWidth || 700
    const height = el.clientHeight || 460

    // Scene
    const scene = new THREE.Scene()
    sceneRef.current = scene

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)
    camera.position.z = 2.8
    cameraRef.current = camera

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(width, height)
    renderer.setClearColor(0x000000, 0)
    el.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // Lights
    const ambient = new THREE.AmbientLight(0x67e8f9, 0.3)
    scene.add(ambient)
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8)
    dirLight.position.set(5, 3, 5)
    scene.add(dirLight)

    // Globe
    const RADIUS = 1
    const globeGeo = new THREE.SphereGeometry(RADIUS, 64, 64)
    const loader = new THREE.TextureLoader()
    const globeMat = new THREE.MeshPhongMaterial({
      color: 0x08111d,
      emissive: 0x001020,
      specular: 0x1a3a5c,
      shininess: 12,
    })
    loader.load(
      'https://unpkg.com/three-globe@2.24.13/example/img/earth-dark.jpg',
      (tex) => { globeMat.map = tex; globeMat.needsUpdate = true }
    )
    const globe = new THREE.Mesh(globeGeo, globeMat)
    scene.add(globe)

    // Atmosphere glow
    const atmGeo = new THREE.SphereGeometry(RADIUS * 1.06, 64, 64)
    const atmMat = new THREE.MeshPhongMaterial({
      color: 0x67e8f9,
      transparent: true,
      opacity: 0.06,
      side: THREE.BackSide,
      depthWrite: false,
    })
    scene.add(new THREE.Mesh(atmGeo, atmMat))

    // Grid lines (graticule approximation)
    const gridMat = new THREE.LineBasicMaterial({ color: 0x1a3a5c, transparent: true, opacity: 0.25 })
    for (let lat = -80; lat <= 80; lat += 20) {
      const pts = []
      for (let lon = -180; lon <= 180; lon += 3) {
        pts.push(latLonToVec3(lat, lon, RADIUS + 0.001))
      }
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), gridMat))
    }
    for (let lon = -180; lon <= 180; lon += 20) {
      const pts = []
      for (let lat = -90; lat <= 90; lat += 3) {
        pts.push(latLonToVec3(lat, lon, RADIUS + 0.001))
      }
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), gridMat))
    }

    // Groups for dynamic objects
    const arcsGroup = new THREE.Group()
    const ringsGroup = new THREE.Group()
    scene.add(arcsGroup)
    scene.add(ringsGroup)
    arcsGroupRef.current = arcsGroup
    ringsGroupRef.current = ringsGroup

    // Destination marker
    const destPos = latLonToVec3(DEFAULT_DESTINATION.location.lat, DEFAULT_DESTINATION.location.lon, RADIUS + 0.01)
    const destGeo = new THREE.SphereGeometry(0.018, 16, 16)
    const destMat = new THREE.MeshBasicMaterial({ color: 0x67e8f9 })
    const destMesh = new THREE.Mesh(destGeo, destMat)
    destMesh.position.copy(destPos)
    scene.add(destMesh)

    // Destination pulse rings
    for (let i = 0; i < 3; i++) {
      const r = buildPulseRing(DEFAULT_DESTINATION.location.lat, DEFAULT_DESTINATION.location.lon, RADIUS)
      r.userData.pulseOffset = i * (Math.PI * 2 / 3)
      r.userData.isDestRing = true
      ringsGroup.add(r)
    }

    // Resize observer
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth
      const h = el.clientHeight
      if (w && h) {
        renderer.setSize(w, h)
        camera.aspect = w / h
        camera.updateProjectionMatrix()
      }
    })
    ro.observe(el)

    // Animation loop
    let t = 0
    function animate() {
      frameRef.current = requestAnimationFrame(animate)
      t += 0.016

      // Auto-rotate when not dragging
      if (!isDraggingRef.current) {
        rotationRef.current.y += 0.0015
      }
      scene.rotation.y = rotationRef.current.y
      scene.rotation.x = rotationRef.current.x

      // Animate arc progress
      arcProgressRef.current.forEach((state, i) => {
        if (!state) return
        state.progress = Math.min(1, state.progress + state.speed)
        const { line, allPoints } = state
        const count = Math.floor(state.progress * allPoints.length)
        const pts = allPoints.slice(0, Math.max(2, count))
        const geo = new THREE.BufferGeometry().setFromPoints(pts)
        line.geometry.dispose()
        line.geometry = geo
      })

      // Animate destination pulse rings
      ringsGroup.children.forEach((ring) => {
        if (ring.userData.isDestRing) {
          const s = 1 + 1.5 * ((Math.sin(t * 2 + ring.userData.pulseOffset) + 1) / 2)
          ring.scale.setScalar(s)
          ring.material.opacity = 0.6 * (1 - (s - 1) / 1.5)
        } else if (ring.userData.isOriginRing) {
          const s = 1 + 2.5 * ((Math.sin(t * 3 + ring.userData.pulseOffset) + 1) / 2)
          ring.scale.setScalar(s)
          ring.material.opacity = 0.7 * (1 - (s - 1) / 2.5)
        }
      })

      renderer.render(scene, camera)
    }
    animate()

    return () => {
      cancelAnimationFrame(frameRef.current)
      ro.disconnect()
      renderer.dispose()
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement)
    }
  }, [])

  // Update arcs and rings when data changes
  useEffect(() => {
    const arcsGroup = arcsGroupRef.current
    const ringsGroup = ringsGroupRef.current
    if (!arcsGroup || !ringsGroup) return

    // Clear old arcs
    while (arcsGroup.children.length) {
      arcsGroup.children[0].geometry.dispose()
      arcsGroup.children[0].material.dispose()
      arcsGroup.remove(arcsGroup.children[0])
    }
    // Clear origin rings (keep dest rings)
    const toRemove = ringsGroup.children.filter(r => r.userData.isOriginRing)
    toRemove.forEach(r => { r.geometry.dispose(); r.material.dispose(); ringsGroup.remove(r) })

    arcProgressRef.current = []

    const RADIUS = 1
    visiblePoints.forEach((point, i) => {
      const color = severityColorVec(point.severity)
      const allPoints = buildArcPoints(
        point.location.lat, point.location.lon,
        destination.location.lat, destination.location.lon,
        RADIUS
      )

      // Glow line (wider, transparent)
      const glowMat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.18, linewidth: 3 })
      const glowLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(allPoints.slice(0, 2)), glowMat)
      arcsGroup.add(glowLine)

      // Main arc line
      const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9, linewidth: 2 })
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(allPoints.slice(0, 2)), mat)
      arcsGroup.add(line)

      arcProgressRef.current.push({
        line,
        allPoints,
        progress: 0,
        speed: 0.012 + i * 0.0005,
      })

      // Origin dot
      const dotGeo = new THREE.SphereGeometry(0.012, 10, 10)
      const dotMat = new THREE.MeshBasicMaterial({ color })
      const dot = new THREE.Mesh(dotGeo, dotMat)
      dot.position.copy(latLonToVec3(point.location.lat, point.location.lon, RADIUS + 0.005))
      arcsGroup.add(dot)

      // Origin pulse ring
      const ring = buildPulseRing(point.location.lat, point.location.lon, RADIUS)
      ring.material.color = color
      ring.userData.isOriginRing = true
      ring.userData.pulseOffset = i * 0.8
      ringsGroup.add(ring)
    })
  }, [visiblePoints, destination])

  // Mouse drag to rotate
  const onMouseDown = useCallback((e) => {
    isDraggingRef.current = true
    prevMouseRef.current = { x: e.clientX, y: e.clientY }
  }, [])
  const onMouseMove = useCallback((e) => {
    if (!isDraggingRef.current) return
    const dx = e.clientX - prevMouseRef.current.x
    const dy = e.clientY - prevMouseRef.current.y
    rotationRef.current.y += dx * 0.005
    rotationRef.current.x += dy * 0.005
    rotationRef.current.x = Math.max(-1.2, Math.min(1.2, rotationRef.current.x))
    prevMouseRef.current = { x: e.clientX, y: e.clientY }
  }, [])
  const onMouseUp = useCallback(() => { isDraggingRef.current = false }, [])

  // Cycle active point for tooltip
  useEffect(() => {
    if (!visiblePoints.length) return
    let idx = 0
    const id = setInterval(() => {
      idx = (idx + 1) % visiblePoints.length
      setActivePoint(visiblePoints[idx])
    }, 1600)
    return () => clearInterval(id)
  }, [visiblePoints])

  return (
    <div className="attack-world-wrap attack-world-wrap-kaspersky" style={{ position: 'relative' }}>
      <div
        className="attack-world-stage"
        style={{ position: 'relative', width: '100%', height: '100%', minHeight: 460 }}
      >
        <div className="attack-world-live-badge">LIVE TELEMETRY 3D</div>
        <div
          ref={mountRef}
          style={{ width: '100%', height: '100%', minHeight: 460, cursor: isDraggingRef.current ? 'grabbing' : 'grab' }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
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
              <div className="attack-tip-row">Esperando eventos con GeoIP...</div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}