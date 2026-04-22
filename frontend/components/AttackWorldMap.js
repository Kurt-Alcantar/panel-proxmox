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

function severityColorHex(severity) {
  if (severity === 'critical') return 0xff4c4c
  if (severity === 'high') return 0xff9500
  if (severity === 'medium') return 0xffd60a
  return 0x52ffa8
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
  mid.setLength(mid.length() + radius * 0.5)
  const curve = new THREE.QuadraticBezierCurve3(from, mid, to)
  return curve.getPoints(segments)
}

function buildGlobeTexture() {
  const W = 2048
  const H = 1024
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = '#060f1a'
  ctx.fillRect(0, 0, W, H)
  ctx.strokeStyle = 'rgba(103,232,249,0.07)'
  ctx.lineWidth = 1
  for (let lat = -80; lat <= 80; lat += 20) {
    const y = ((90 - lat) / 180) * H
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
  }
  for (let lon = -180; lon <= 180; lon += 20) {
    const x = ((lon + 180) / 360) * W
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
  }

  ctx.fillStyle = '#0d2137'
  ctx.strokeStyle = 'rgba(103,232,249,0.18)'
  ctx.lineWidth = 1.5

  function ll(lon, lat) {
    return [((lon + 180) / 360) * W, ((90 - lat) / 180) * H]
  }

  function poly(coords) {
    ctx.beginPath()
    coords.forEach(([lon, lat], i) => {
      const [x, y] = ll(lon, lat)
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
    })
    ctx.closePath(); ctx.fill(); ctx.stroke()
  }

  poly([[-168,71],[-140,70],[-120,72],[-95,75],[-80,73],[-65,68],[-55,63],[-52,47],[-65,44],[-70,41],[-74,40],[-80,34],[-81,30],[-87,30],[-90,29],[-97,26],[-105,23],[-110,24],[-118,29],[-120,34],[-124,37],[-124,46],[-130,54],[-138,58],[-142,60],[-152,58],[-160,59],[-166,63],[-168,65]])
  poly([[-70,76],[-55,82],[-20,83],[-18,76],[-30,70],[-45,68],[-60,68],[-70,72]])
  poly([[-81,8],[-77,4],[-75,0],[-70,-5],[-50,-10],[-35,-8],[-35,-20],[-40,-22],[-45,-23],[-48,-28],[-50,-33],[-68,-55],[-75,-52],[-72,-42],[-65,-38],[-58,-35],[-52,-33],[-45,-23],[-40,-15],[-38,-10],[-35,-5],[-50,5],[-60,8],[-73,10],[-78,8],[-81,8]])
  poly([[10,58],[20,60],[28,70],[15,70],[5,62],[-2,58],[-5,48],[0,44],[5,43],[14,37],[18,40],[24,38],[28,41],[30,46],[24,48],[15,48],[10,48],[8,54],[10,58]])
  poly([[-18,15],[-16,20],[-13,28],[0,30],[10,37],[15,37],[30,30],[35,22],[40,10],[42,2],[40,-5],[35,-17],[26,-33],[18,-35],[12,-18],[8,-5],[0,5],[-10,8],[-18,15]])
  poly([[30,70],[60,75],[80,73],[100,70],[120,68],[140,68],[145,60],[140,46],[130,32],[120,22],[110,18],[100,2],[95,5],[88,22],[80,28],[68,23],[60,25],[50,28],[40,36],[30,40],[26,40],[28,46],[35,46],[40,55],[50,58],[60,68],[80,73]])
  poly([[114,-22],[118,-20],[128,-14],[136,-12],[140,-18],[148,-20],[152,-25],[152,-34],[148,-38],[144,-38],[136,-35],[128,-32],[118,-28],[114,-22]])
  return new THREE.CanvasTexture(canvas)
}

export default function AttackWorldMap({ data }) {
  const mountRef = useRef(null)
  const rendererRef = useRef(null)
  const sceneRef = useRef(null)
  const cameraRef = useRef(null)
  const frameRef = useRef(null)
  const arcsGroupRef = useRef(null)
  const ringsGroupRef = useRef(null)
  const particlesGroupRef = useRef(null)
  const eventMeshesRef = useRef(new Map())
  const isDraggingRef = useRef(false)
  const prevMouseRef = useRef({ x: 0, y: 0 })
  const rotationRef = useRef({ x: 0.18, y: 1.72 })

  const [activePoint, setActivePoint] = useState(null)

  const destination = useMemo(() => {
    const lat = Number(data?.destination?.location?.lat)
    const lon = Number(data?.destination?.location?.lon)
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      return { label: data?.destination?.label || DEFAULT_DESTINATION.label, location: { lat, lon } }
    }
    return DEFAULT_DESTINATION
  }, [data])

  const visibleEvents = useMemo(() => {
    const items = (data?.events || []).slice()
    items.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    return items.slice(-80)
  }, [data])

  useEffect(() => {
    const el = mountRef.current
    if (!el) return

    const width = el.clientWidth || 700
    const height = el.clientHeight || 460

    const scene = new THREE.Scene()
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 1000)
    camera.position.z = 2.6
    cameraRef.current = camera

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(width, height)
    renderer.setClearColor(0x000000, 0)
    el.appendChild(renderer.domElement)
    rendererRef.current = renderer

    scene.add(new THREE.AmbientLight(0xffffff, 0.9))
    const dir = new THREE.DirectionalLight(0x67e8f9, 0.7)
    dir.position.set(5, 3, 5)
    scene.add(dir)

    const RADIUS = 1
    const texture = buildGlobeTexture()
    const globeGeo = new THREE.SphereGeometry(RADIUS, 64, 64)
    const globeMat = new THREE.MeshPhongMaterial({ map: texture, specular: 0x112233, shininess: 8 })
    scene.add(new THREE.Mesh(globeGeo, globeMat))

    const atmGeo = new THREE.SphereGeometry(RADIUS * 1.055, 64, 64)
    const atmMat = new THREE.MeshPhongMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.07, side: THREE.BackSide, depthWrite: false })
    scene.add(new THREE.Mesh(atmGeo, atmMat))

    const arcsGroup = new THREE.Group()
    const ringsGroup = new THREE.Group()
    const particlesGroup = new THREE.Group()
    scene.add(arcsGroup)
    scene.add(ringsGroup)
    scene.add(particlesGroup)
    arcsGroupRef.current = arcsGroup
    ringsGroupRef.current = ringsGroup
    particlesGroupRef.current = particlesGroup

    for (let i = 0; i < 3; i++) {
      const ringGeo = new THREE.RingGeometry(0.014, 0.022, 32)
      const ringMat = new THREE.MeshBasicMaterial({ color: 0x67e8f9, side: THREE.DoubleSide, transparent: true, opacity: 0.8, depthWrite: false })
      const ring = new THREE.Mesh(ringGeo, ringMat)
      ring.position.copy(latLonToVec3(DEFAULT_DESTINATION.location.lat, DEFAULT_DESTINATION.location.lon, RADIUS + 0.012))
      ring.lookAt(new THREE.Vector3(0, 0, 0))
      ring.rotateX(Math.PI / 2)
      ring.userData.pulseOffset = i * 0.8
      ringsGroup.add(ring)
    }

    const destDot = new THREE.Mesh(
      new THREE.SphereGeometry(0.02, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0x67e8f9 })
    )
    destDot.position.copy(latLonToVec3(DEFAULT_DESTINATION.location.lat, DEFAULT_DESTINATION.location.lon, RADIUS + 0.015))
    scene.add(destDot)

    const ro = new ResizeObserver(() => {
      const w = el.clientWidth; const h = el.clientHeight
      if (w && h) { renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix() }
    })
    ro.observe(el)

    let t = 0
    function animate() {
      frameRef.current = requestAnimationFrame(animate)
      t += 0.016
      if (!isDraggingRef.current) rotationRef.current.y += 0.0013
      scene.rotation.y = rotationRef.current.y
      scene.rotation.x = rotationRef.current.x

      ringsGroup.children.forEach((ring) => {
        const phase = (t * 1.8 + ring.userData.pulseOffset) % (Math.PI * 2)
        const s = 1 + 2.2 * (phase / (Math.PI * 2))
        ring.scale.setScalar(s)
        ring.material.opacity = 0.75 * (1 - phase / (Math.PI * 2))
      })

      const now = Date.now()
      eventMeshesRef.current.forEach((state, key) => {
        const ageMs = now - state.createdAt
        const ttl = state.ttlMs || 90000
        const life = Math.min(1, ageMs / ttl)
        const headProgress = Math.min(1, ageMs / Math.max(ttl * 0.35, 1200))
        const tailProgress = Math.max(0, headProgress - 0.18)
        const headCount = Math.max(2, Math.floor(headProgress * state.allPoints.length))
        const tailCount = Math.max(0, Math.floor(tailProgress * state.allPoints.length))
        const pts = state.allPoints.slice(tailCount, headCount)

        if (pts.length >= 2) {
          state.line.geometry.dispose()
          state.line.geometry = new THREE.BufferGeometry().setFromPoints(pts)
          state.glowLine.geometry.dispose()
          state.glowLine.geometry = new THREE.BufferGeometry().setFromPoints(pts)
          state.particle.position.copy(pts[pts.length - 1])
        }

        const opacity = Math.max(0, 1 - life)
        state.line.material.opacity = 0.85 * opacity
        state.glowLine.material.opacity = 0.18 * opacity
        state.originDot.material.opacity = 0.9 * opacity
        state.originRing.material.opacity = 0.7 * opacity
        state.particle.material.opacity = 0.95 * opacity
        state.originRing.scale.setScalar(1 + life * 2.2)

        if (life >= 1) {
          ;[state.line, state.glowLine, state.originDot, state.originRing, state.particle].forEach((mesh) => {
            mesh.geometry?.dispose?.()
            mesh.material?.dispose?.()
            mesh.parent?.remove(mesh)
          })
          eventMeshesRef.current.delete(key)
        }
      })

      renderer.render(scene, camera)
    }
    animate()

    return () => {
      cancelAnimationFrame(frameRef.current)
      ro.disconnect()
      texture.dispose()
      eventMeshesRef.current.forEach((state) => {
        ;[state.line, state.glowLine, state.originDot, state.originRing, state.particle].forEach((mesh) => {
          mesh.geometry?.dispose?.()
          mesh.material?.dispose?.()
          mesh.parent?.remove(mesh)
        })
      })
      eventMeshesRef.current.clear()
      renderer.dispose()
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement)
    }
  }, [])

  useEffect(() => {
    const arcsGroup = arcsGroupRef.current
    const ringsGroup = ringsGroupRef.current
    const particlesGroup = particlesGroupRef.current
    if (!arcsGroup || !ringsGroup || !particlesGroup) return
    const RADIUS = 1
    const ttlMs = Number(data?.liveWindowMs || 90000)

    visibleEvents.forEach((point, i) => {
      const key = point.eventId || `${point.timestamp}:${point.ip}:${i}`
      if (eventMeshesRef.current.has(key)) return

      const col = severityColorHex(point.severity)
      const allPoints = buildArcPoints(point.location.lat, point.location.lon, destination.location.lat, destination.location.lon, RADIUS)

      const glowLine = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(allPoints.slice(0, 2)),
        new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.15, linewidth: 1 })
      )
      arcsGroup.add(glowLine)

      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(allPoints.slice(0, 2)),
        new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.9, linewidth: 2 })
      )
      arcsGroup.add(line)

      const originDot = new THREE.Mesh(
        new THREE.SphereGeometry(0.013, 8, 8),
        new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 1 })
      )
      originDot.position.copy(latLonToVec3(point.location.lat, point.location.lon, RADIUS + 0.005))
      arcsGroup.add(originDot)

      const originRing = new THREE.Mesh(
        new THREE.RingGeometry(0.006, 0.013, 24),
        new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide, transparent: true, opacity: 0.8, depthWrite: false })
      )
      originRing.position.copy(latLonToVec3(point.location.lat, point.location.lon, RADIUS + 0.008))
      originRing.lookAt(new THREE.Vector3(0, 0, 0))
      originRing.rotateX(Math.PI / 2)
      ringsGroup.add(originRing)

      const particle = new THREE.Mesh(
        new THREE.SphereGeometry(0.015, 10, 10),
        new THREE.MeshBasicMaterial({ color: 0xf8fafc, transparent: true, opacity: 0.95 })
      )
      particle.position.copy(allPoints[0])
      particlesGroup.add(particle)

      eventMeshesRef.current.set(key, {
        allPoints,
        line,
        glowLine,
        originDot,
        originRing,
        particle,
        createdAt: new Date(point.timestamp || Date.now()).getTime(),
        ttlMs,
      })
    })
  }, [visibleEvents, destination, data?.liveWindowMs])

  const onMouseDown = useCallback((e) => { isDraggingRef.current = true; prevMouseRef.current = { x: e.clientX, y: e.clientY } }, [])
  const onMouseMove = useCallback((e) => {
    if (!isDraggingRef.current) return
    rotationRef.current.y += (e.clientX - prevMouseRef.current.x) * 0.005
    rotationRef.current.x = Math.max(-1.2, Math.min(1.2, rotationRef.current.x + (e.clientY - prevMouseRef.current.y) * 0.005))
    prevMouseRef.current = { x: e.clientX, y: e.clientY }
  }, [])
  const onMouseUp = useCallback(() => { isDraggingRef.current = false }, [])

  useEffect(() => {
    if (!visibleEvents.length) {
      setActivePoint(null)
      return
    }
    let idx = 0
    setActivePoint(visibleEvents[visibleEvents.length - 1])
    const id = setInterval(() => {
      idx = (idx + 1) % visibleEvents.length
      setActivePoint(visibleEvents[idx])
    }, 1200)
    return () => clearInterval(id)
  }, [visibleEvents])

  return (
    <div className="attack-world-wrap attack-world-wrap-kaspersky" style={{ position: 'relative' }}>
      <div className="attack-world-stage" style={{ position: 'relative', width: '100%', height: '100%', minHeight: 460 }}>
        <div className="attack-world-live-badge">
          {data?.streamConnected ? 'LIVE STREAM · SSE' : 'RECONNECTING LIVE STREAM'}
        </div>
        <div
          ref={mountRef}
          style={{ width: '100%', height: '100%', minHeight: 460, cursor: 'grab' }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
        />
      </div>

      <div className="attack-world-overlay">
        <div className="attack-world-summary attack-world-summary-kaspersky">
          <div><span>Eventos activos</span><strong>{data?.summary?.totalEvents ?? 0}</strong></div>
          <div><span>IPs activas</span><strong>{data?.summary?.uniqueSourceIps ?? 0}</strong></div>
          <div><span>Top country</span><strong>{data?.summary?.topCountry ?? 'Unknown'}</strong></div>
          <div><span>Último pulso</span><strong>{data?.summary?.lastEventAt ? formatLastSeen(data.summary.lastEventAt) : '—'}</strong></div>
        </div>

        <div className="attack-world-tooltip attack-world-tooltip-kaspersky">
          {activePoint ? (
            <>
              <div className="attack-tip-eyebrow">Live route focus</div>
              <div className="attack-tip-title">{activePoint.ip}</div>
              <div className="attack-tip-route">
                <span>{activePoint.country}{activePoint.city ? ` · ${activePoint.city}` : ''}</span>
                <strong>→</strong>
                <span>{destination.label}</span>
              </div>
              <div className="attack-tip-row">Eventos: <strong>{activePoint.count || 1}</strong></div>
              <div className="attack-tip-row">Host destino: <strong>{activePoint.targetHost || 'unknown-host'}</strong></div>
              <div className="attack-tip-row">Severidad: <strong style={{ color: severityColor(activePoint.severity) }}>{activePoint.severity}</strong></div>
              <div className="attack-tip-row">Último evento: <strong>{formatLastSeen(activePoint.lastSeen || activePoint.timestamp)}</strong></div>
            </>
          ) : (
            <>
              <div className="attack-tip-eyebrow">Mapa táctico 3D</div>
              <div className="attack-tip-title">Sin rutas activas</div>
              <div className="attack-tip-row">Esperando eventos nuevos con GeoIP...</div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}