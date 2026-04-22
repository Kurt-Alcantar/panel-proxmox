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

// Build globe texture using canvas — land polygons from Natural Earth simplified
function buildGlobeTexture() {
  const W = 2048
  const H = 1024
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')

  // Ocean
  ctx.fillStyle = '#060f1a'
  ctx.fillRect(0, 0, W, H)

  // Grid lines
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

  // Land masses — simplified polygons (equirectangular projection)
  // Format: array of [lon, lat] pairs
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
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }

  // North America
  poly([[-168,71],[-140,70],[-120,72],[-95,75],[-80,73],[-65,68],[-55,63],[-52,47],[-65,44],[-70,41],[-74,40],[-80,34],[-81,30],[-87,30],[-90,29],[-97,26],[-105,23],[-110,24],[-118,29],[-120,34],[-124,37],[-124,46],[-130,54],[-138,58],[-142,60],[-152,58],[-160,59],[-166,63],[-168,65]])
  // Greenland
  poly([[-70,76],[-55,82],[-20,83],[-18,76],[-30,70],[-45,68],[-60,68],[-70,72]])
  // South America
  poly([[-81,8],[-77,4],[-75,0],[-70,-5],[-50,-10],[-35,-8],[-35,-20],[-40,-22],[-45,-23],[-48,-28],[-50,-33],[-68,-55],[-75,-52],[-72,-42],[-65,-38],[-58,-35],[-52,-33],[-45,-23],[-40,-15],[-38,-10],[-35,-5],[-50,5],[-60,8],[-73,10],[-78,8],[-81,8]])
  // Europe
  poly([[10,58],[20,60],[28,70],[15,70],[5,62],[-2,58],[-5,48],[0,44],[5,43],[14,37],[18,40],[24,38],[28,41],[30,46],[24,48],[15,48],[10,48],[8,54],[10,58]])
  // Scandinavia
  poly([[5,58],[8,58],[15,60],[20,63],[25,68],[28,70],[20,70],[15,70],[10,62],[5,58]])
  // Africa
  poly([[-18,15],[-16,20],[-13,28],[0,30],[10,37],[15,37],[30,30],[35,22],[40,10],[42,2],[40,-5],[35,-17],[26,-33],[18,-35],[12,-18],[8,-5],[0,5],[-10,8],[-18,15]])
  // Asia (simplified)
  poly([[30,70],[60,75],[80,73],[100,70],[120,68],[140,68],[145,60],[140,46],[130,32],[120,22],[110,18],[100,2],[95,5],[88,22],[80,28],[68,23],[60,25],[50,28],[40,36],[30,40],[26,40],[28,46],[35,46],[40,55],[50,58],[60,68],[80,73]])
  // Indian subcontinent
  poly([[68,23],[72,22],[78,8],[80,12],[80,22],[76,28],[72,34],[66,30],[62,26],[68,23]])
  // Southeast Asia
  poly([[100,22],[108,18],[108,10],[104,2],[104,-2],[108,-5],[115,1],[120,5],[120,22],[108,18],[100,22]])
  // Japan
  poly([[130,32],[132,33],[135,35],[136,36],[134,34],[130,32]])
  poly([[140,42],[142,44],[144,43],[141,40],[140,42]])
  // Australia
  poly([[114,-22],[118,-20],[128,-14],[136,-12],[140,-18],[148,-20],[152,-25],[152,-34],[148,-38],[144,-38],[136,-35],[128,-32],[118,-28],[114,-22]])
  // New Zealand
  poly([[172,-34],[174,-36],[174,-40],[172,-42],[170,-38],[172,-34]])
  poly([[170,-44],[172,-44],[172,-46],[168,-46],[170,-44]])
  // UK & Ireland
  poly([[-5,50],[-3,51],[0,51],[2,52],[0,58],[-4,58],[-5,57],[-3,54],[-5,52],[-5,50]])
  poly([[-10,51],[-8,55],[-6,55],[-6,52],[-10,51]])
  // Iceland
  poly([[-24,64],[-14,66],[-13,65],[-20,63],[-24,63],[-24,64]])
  // Indonesia (simplified)
  poly([[95,5],[100,2],[104,-2],[108,-7],[115,-8],[124,-8],[132,-4],[136,-4],[136,-2],[130,0],[124,1],[118,4],[110,4],[104,0],[100,2],[96,4],[95,5]])
  // Philippines
  poly([[118,18],[122,18],[126,8],[126,6],[122,10],[118,18]])
  // Madagascar
  poly([[44,-12],[50,-14],[50,-20],[46,-26],[44,-20],[44,-16],[44,-12]])
  // Central America
  poly([[-90,16],[-83,10],[-77,8],[-77,9],[-82,12],[-85,14],[-90,16]])
  // Caribbean islands (Cuba)
  poly([[-85,22],[-82,20],[-74,20],[-75,22],[-82,23],[-85,22]])

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
  const arcProgressRef = useRef([])
  const isDraggingRef = useRef(false)
  const prevMouseRef = useRef({ x: 0, y: 0 })
  const rotationRef = useRef({ x: 0.15, y: 1.8 }) // start showing Americas

  const [activePoint, setActivePoint] = useState(null)

  const destination = useMemo(() => {
    const lat = Number(data?.destination?.location?.lat)
    const lon = Number(data?.destination?.location?.lon)
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      return { label: data?.destination?.label || DEFAULT_DESTINATION.label, location: { lat, lon } }
    }
    return DEFAULT_DESTINATION
  }, [data])

  const visiblePoints = useMemo(() => (data?.points || []).slice(0, 24), [data])

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

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.9))
    const dir = new THREE.DirectionalLight(0x67e8f9, 0.6)
    dir.position.set(5, 3, 5)
    scene.add(dir)

    // Globe with canvas texture
    const RADIUS = 1
    const texture = buildGlobeTexture()
    const globeGeo = new THREE.SphereGeometry(RADIUS, 64, 64)
    const globeMat = new THREE.MeshPhongMaterial({ map: texture, specular: 0x112233, shininess: 8 })
    scene.add(new THREE.Mesh(globeGeo, globeMat))

    // Atmosphere
    const atmGeo = new THREE.SphereGeometry(RADIUS * 1.055, 64, 64)
    const atmMat = new THREE.MeshPhongMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.07, side: THREE.BackSide, depthWrite: false })
    scene.add(new THREE.Mesh(atmGeo, atmMat))

    // Groups
    const arcsGroup = new THREE.Group()
    const ringsGroup = new THREE.Group()
    scene.add(arcsGroup)
    scene.add(ringsGroup)
    arcsGroupRef.current = arcsGroup
    ringsGroupRef.current = ringsGroup

    // Destination pulse rings
    for (let i = 0; i < 3; i++) {
      const geo = new THREE.RingGeometry(0.008, 0.016, 32)
      const mat = new THREE.MeshBasicMaterial({ color: 0x67e8f9, side: THREE.DoubleSide, transparent: true, opacity: 0.8, depthWrite: false })
      const mesh = new THREE.Mesh(geo, mat)
      const pos = latLonToVec3(DEFAULT_DESTINATION.location.lat, DEFAULT_DESTINATION.location.lon, RADIUS + 0.01)
      mesh.position.copy(pos)
      mesh.lookAt(new THREE.Vector3(0, 0, 0))
      mesh.rotateX(Math.PI / 2)
      mesh.userData.isDestRing = true
      mesh.userData.pulseOffset = i * (Math.PI * 2 / 3)
      ringsGroup.add(mesh)
    }

    // Destination dot
    const destDot = new THREE.Mesh(
      new THREE.SphereGeometry(0.02, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0x67e8f9 })
    )
    destDot.position.copy(latLonToVec3(DEFAULT_DESTINATION.location.lat, DEFAULT_DESTINATION.location.lon, RADIUS + 0.015))
    scene.add(destDot)

    // Resize
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth; const h = el.clientHeight
      if (w && h) { renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix() }
    })
    ro.observe(el)

    // Animate
    let t = 0
    function animate() {
      frameRef.current = requestAnimationFrame(animate)
      t += 0.016
      if (!isDraggingRef.current) rotationRef.current.y += 0.0018
      scene.rotation.y = rotationRef.current.y
      scene.rotation.x = rotationRef.current.x

      arcProgressRef.current.forEach((state) => {
        if (!state || state.progress >= 1) return
        state.progress = Math.min(1, state.progress + state.speed)
        const count = Math.max(2, Math.floor(state.progress * state.allPoints.length))
        const pts = state.allPoints.slice(0, count)
        state.line.geometry.dispose()
        state.line.geometry = new THREE.BufferGeometry().setFromPoints(pts)
        if (state.glowLine) {
          state.glowLine.geometry.dispose()
          state.glowLine.geometry = new THREE.BufferGeometry().setFromPoints(pts)
        }
      })

      ringsGroup.children.forEach((ring) => {
        const phase = (t * 1.8 + ring.userData.pulseOffset) % (Math.PI * 2)
        const s = 1 + 2.2 * (phase / (Math.PI * 2))
        ring.scale.setScalar(s)
        ring.material.opacity = 0.75 * (1 - phase / (Math.PI * 2))
      })

      renderer.render(scene, camera)
    }
    animate()

    return () => {
      cancelAnimationFrame(frameRef.current)
      ro.disconnect()
      texture.dispose()
      renderer.dispose()
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement)
    }
  }, [])

  // Rebuild arcs when data changes
  useEffect(() => {
    const arcsGroup = arcsGroupRef.current
    const ringsGroup = ringsGroupRef.current
    if (!arcsGroup || !ringsGroup) return
    const RADIUS = 1

    // Clear arcs
    while (arcsGroup.children.length) {
      const c = arcsGroup.children[0]
      c.geometry?.dispose(); c.material?.dispose(); arcsGroup.remove(c)
    }
    // Clear origin rings
    ringsGroup.children.filter(r => r.userData.isOriginRing).forEach(r => {
      r.geometry?.dispose(); r.material?.dispose(); ringsGroup.remove(r)
    })
    arcProgressRef.current = []

    visiblePoints.forEach((point, i) => {
      const col = severityColorHex(point.severity)
      const allPoints = buildArcPoints(point.location.lat, point.location.lon, destination.location.lat, destination.location.lon, RADIUS)

      // Glow
      const glowMat = new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.15, linewidth: 1 })
      const glowLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(allPoints.slice(0, 2)), glowMat)
      arcsGroup.add(glowLine)

      // Arc
      const mat = new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.9, linewidth: 2 })
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(allPoints.slice(0, 2)), mat)
      arcsGroup.add(line)

      arcProgressRef.current.push({ line, glowLine, allPoints, progress: (i * 0.04) % 1, speed: 0.014 + i * 0.0003 })

      // Origin dot
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.013, 8, 8), new THREE.MeshBasicMaterial({ color: col }))
      dot.position.copy(latLonToVec3(point.location.lat, point.location.lon, RADIUS + 0.005))
      arcsGroup.add(dot)

      // Origin ring
      const ringGeo = new THREE.RingGeometry(0.006, 0.013, 24)
      const ringMat = new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide, transparent: true, opacity: 0.8, depthWrite: false })
      const ring = new THREE.Mesh(ringGeo, ringMat)
      ring.position.copy(latLonToVec3(point.location.lat, point.location.lon, RADIUS + 0.008))
      ring.lookAt(new THREE.Vector3(0, 0, 0))
      ring.rotateX(Math.PI / 2)
      ring.userData.isOriginRing = true
      ring.userData.pulseOffset = i * 0.7
      ringsGroup.add(ring)
    })
  }, [visiblePoints, destination])

  const onMouseDown = useCallback((e) => { isDraggingRef.current = true; prevMouseRef.current = { x: e.clientX, y: e.clientY } }, [])
  const onMouseMove = useCallback((e) => {
    if (!isDraggingRef.current) return
    rotationRef.current.y += (e.clientX - prevMouseRef.current.x) * 0.005
    rotationRef.current.x = Math.max(-1.2, Math.min(1.2, rotationRef.current.x + (e.clientY - prevMouseRef.current.y) * 0.005))
    prevMouseRef.current = { x: e.clientX, y: e.clientY }
  }, [])
  const onMouseUp = useCallback(() => { isDraggingRef.current = false }, [])

  useEffect(() => {
    if (!visiblePoints.length) return
    let idx = 0
    const id = setInterval(() => { idx = (idx + 1) % visiblePoints.length; setActivePoint(visiblePoints[idx]) }, 1600)
    return () => clearInterval(id)
  }, [visiblePoints])

  return (
    <div className="attack-world-wrap attack-world-wrap-kaspersky" style={{ position: 'relative' }}>
      <div className="attack-world-stage" style={{ position: 'relative', width: '100%', height: '100%', minHeight: 460 }}>
        <div className="attack-world-live-badge">LIVE TELEMETRY 3D</div>
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
          <div><span>Eventos geolocalizados</span><strong>{data?.summary?.totalEvents ?? 0}</strong></div>
          <div><span>Orígenes activos</span><strong>{visiblePoints.length}</strong></div>
          <div><span>Top country</span><strong>{data?.summary?.topCountry ?? 'Unknown'}</strong></div>
          <div><span>Destino</span><strong>{destination.label}</strong></div>
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
              <div className="attack-tip-row">Severidad: <strong style={{ color: severityColor(activePoint.severity) }}>{activePoint.severity}</strong></div>
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