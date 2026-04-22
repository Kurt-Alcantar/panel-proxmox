import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import * as THREE from 'three'

const DEFAULT_DESTINATION = {
  label: 'Protected infrastructure',
  location: { lat: 23.6345, lon: -102.5528 },
}

const EARTH_TEXTURES = {
  map: 'https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg',
  normal: 'https://threejs.org/examples/textures/planets/earth_normal_2048.jpg',
  specular: 'https://threejs.org/examples/textures/planets/earth_specular_2048.jpg',
  clouds: 'https://threejs.org/examples/textures/planets/earth_clouds_1024.png',
}

function severityColor(severity) {
  if (severity === 'critical') return '#ff4c4c'
  if (severity === 'high') return '#ff9f43'
  if (severity === 'medium') return '#ffd166'
  return '#52ffa8'
}

function severityColorHex(severity) {
  if (severity === 'critical') return 0xff4c4c
  if (severity === 'high') return 0xff9f43
  if (severity === 'medium') return 0xffd166
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

function buildArcCurve(fromLat, fromLon, toLat, toLon, radius) {
  const from = latLonToVec3(fromLat, fromLon, radius)
  const to = latLonToVec3(toLat, toLon, radius)
  const distance = from.distanceTo(to)
  const altitude = THREE.MathUtils.clamp(radius * 0.22 + distance * 0.12, radius * 0.18, radius * 0.65)

  const mid = from.clone().add(to).multiplyScalar(0.5).normalize().multiplyScalar(radius + altitude)
  const control1 = from.clone().lerp(mid, 0.55)
  const control2 = to.clone().lerp(mid, 0.55)

  return new THREE.CubicBezierCurve3(from, control1, control2, to)
}

function createFallbackTexture() {
  const W = 2048
  const H = 1024
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')

  const ocean = ctx.createLinearGradient(0, 0, 0, H)
  ocean.addColorStop(0, '#08121f')
  ocean.addColorStop(0.5, '#0d2440')
  ocean.addColorStop(1, '#08111d')
  ctx.fillStyle = ocean
  ctx.fillRect(0, 0, W, H)

  ctx.strokeStyle = 'rgba(140,215,255,0.08)'
  ctx.lineWidth = 1
  for (let lat = -80; lat <= 80; lat += 20) {
    const y = ((90 - lat) / 180) * H
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(W, y)
    ctx.stroke()
  }
  for (let lon = -180; lon <= 180; lon += 20) {
    const x = ((lon + 180) / 360) * W
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, H)
    ctx.stroke()
  }

  const glow = ctx.createRadialGradient(W * 0.36, H * 0.4, 20, W * 0.36, H * 0.4, 420)
  glow.addColorStop(0, 'rgba(110,221,255,0.18)')
  glow.addColorStop(1, 'rgba(110,221,255,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function loadTexture(url) {
  return new Promise((resolve, reject) => {
    const loader = new THREE.TextureLoader()
    loader.setCrossOrigin('anonymous')
    loader.load(
      url,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace
        texture.anisotropy = 8
        resolve(texture)
      },
      undefined,
      reject
    )
  })
}

function buildStars(count = 1800, radius = 14) {
  const positions = new Float32Array(count * 3)
  for (let i = 0; i < count; i += 1) {
    const r = radius + Math.random() * 10
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
    positions[i * 3 + 1] = r * Math.cos(phi)
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta)
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const material = new THREE.PointsMaterial({
    color: 0xbfe8ff,
    size: 0.03,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
  })

  return new THREE.Points(geometry, material)
}

export default function AttackWorldMap({ data }) {
  const mountRef = useRef(null)
  const rendererRef = useRef(null)
  const cameraRef = useRef(null)
  const frameRef = useRef(null)
  const sceneRootRef = useRef(null)
  const globeGroupRef = useRef(null)
  const arcsGroupRef = useRef(null)
  const markersGroupRef = useRef(null)
  const particlesRef = useRef([])
  const destinationMarkerRef = useRef(null)
  const destinationRingsRef = useRef([])
  const cloudMeshRef = useRef(null)
  const disposeTextureRefs = useRef([])
  const isDraggingRef = useRef(false)
  const prevPointerRef = useRef({ x: 0, y: 0 })
  const rotationVelocityRef = useRef({ x: 0, y: 0.0016 })
  const rotationRef = useRef({ x: 0.34, y: 1.98 })

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

  const visiblePoints = useMemo(() => (data?.points || []).slice(0, 36), [data])

  const clearGroup = useCallback((group) => {
    if (!group) return
    while (group.children.length) {
      const child = group.children[0]
      if (child.geometry) child.geometry.dispose()
      if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose?.())
      else child.material?.dispose?.()
      group.remove(child)
    }
  }, [])

  useEffect(() => {
    const el = mountRef.current
    if (!el) return

    let cancelled = false
    const width = el.clientWidth || 900
    const height = el.clientHeight || 520

    const scene = new THREE.Scene()

    const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 1000)
    camera.position.set(0, 0.12, 3.45)
    cameraRef.current = camera

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(width, height)
    renderer.setClearColor(0x000000, 0)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    el.appendChild(renderer.domElement)
    rendererRef.current = renderer

    const sceneRoot = new THREE.Group()
    const globeGroup = new THREE.Group()
    const arcsGroup = new THREE.Group()
    const markersGroup = new THREE.Group()
    sceneRoot.add(globeGroup)
    sceneRoot.add(arcsGroup)
    sceneRoot.add(markersGroup)
    scene.add(sceneRoot)

    sceneRootRef.current = sceneRoot
    globeGroupRef.current = globeGroup
    arcsGroupRef.current = arcsGroup
    markersGroupRef.current = markersGroup

    const ambient = new THREE.AmbientLight(0xffffff, 0.9)
    const hemi = new THREE.HemisphereLight(0x9ad8ff, 0x08131f, 1.15)
    const dir = new THREE.DirectionalLight(0xffffff, 1.45)
    dir.position.set(4.6, 2.2, 4.8)
    const rim = new THREE.DirectionalLight(0x4cc9f0, 0.85)
    rim.position.set(-5, -1, -3)
    scene.add(ambient, hemi, dir, rim)

    const stars = buildStars()
    scene.add(stars)

    const RADIUS = 1.15
    const globeGeometry = new THREE.SphereGeometry(RADIUS, 128, 128)
    const atmosphereGeometry = new THREE.SphereGeometry(RADIUS * 1.045, 96, 96)
    const cloudGeometry = new THREE.SphereGeometry(RADIUS * 1.013, 96, 96)

    const atmosphere = new THREE.Mesh(
      atmosphereGeometry,
      new THREE.MeshPhongMaterial({
        color: 0x4cc9f0,
        transparent: true,
        opacity: 0.12,
        side: THREE.BackSide,
        depthWrite: false,
      })
    )
    globeGroup.add(atmosphere)

    let earthMesh
    let cloudMesh

    Promise.allSettled([
      loadTexture(EARTH_TEXTURES.map),
      loadTexture(EARTH_TEXTURES.normal),
      loadTexture(EARTH_TEXTURES.specular),
      loadTexture(EARTH_TEXTURES.clouds),
    ]).then((results) => {
      if (cancelled) return

      const [mapRes, normalRes, specRes, cloudRes] = results
      const map = mapRes.status === 'fulfilled' ? mapRes.value : createFallbackTexture()
      const normalMap = normalRes.status === 'fulfilled' ? normalRes.value : null
      const specularMap = specRes.status === 'fulfilled' ? specRes.value : null
      const clouds = cloudRes.status === 'fulfilled' ? cloudRes.value : null

      disposeTextureRefs.current.push(map)
      if (normalMap) disposeTextureRefs.current.push(normalMap)
      if (specularMap) disposeTextureRefs.current.push(specularMap)
      if (clouds) disposeTextureRefs.current.push(clouds)

      earthMesh = new THREE.Mesh(
        globeGeometry,
        new THREE.MeshPhongMaterial({
          map,
          normalMap,
          specularMap,
          specular: new THREE.Color(0x3c6e91),
          shininess: 18,
        })
      )
      globeGroup.add(earthMesh)

      if (clouds) {
        cloudMesh = new THREE.Mesh(
          cloudGeometry,
          new THREE.MeshPhongMaterial({
            map: clouds,
            transparent: true,
            opacity: 0.18,
            depthWrite: false,
          })
        )
        globeGroup.add(cloudMesh)
        cloudMeshRef.current = cloudMesh
      }
    })

    const resizeObserver = new ResizeObserver(() => {
      const w = el.clientWidth || 900
      const h = el.clientHeight || 520
      renderer.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    })
    resizeObserver.observe(el)

    let t = 0
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate)
      t += 0.016

      rotationVelocityRef.current.y *= 0.992
      rotationVelocityRef.current.x *= 0.992

      if (!isDraggingRef.current) {
        rotationVelocityRef.current.y += 0.00001
      }

      rotationRef.current.y += rotationVelocityRef.current.y
      rotationRef.current.x = THREE.MathUtils.clamp(rotationRef.current.x + rotationVelocityRef.current.x, -0.65, 0.65)
      sceneRoot.rotation.x = rotationRef.current.x
      sceneRoot.rotation.y = rotationRef.current.y

      if (cloudMeshRef.current) cloudMeshRef.current.rotation.y += 0.00055
      stars.rotation.y += 0.00012

      destinationRingsRef.current.forEach((ring, idx) => {
        const phase = (t * 1.65 + idx * 0.85) % (Math.PI * 2)
        const pulse = phase / (Math.PI * 2)
        const scale = 1 + pulse * 2.7
        ring.scale.setScalar(scale)
        ring.material.opacity = 0.38 * (1 - pulse)
      })

      particlesRef.current.forEach((packet, idx) => {
        if (!packet?.curve || !packet.mesh) return
        packet.progress = (packet.progress + packet.speed) % 1
        const pos = packet.curve.getPoint(packet.progress)
        packet.mesh.position.copy(pos)
        packet.mesh.scale.setScalar(0.72 + Math.sin(t * 5 + idx) * 0.15)
      })

      renderer.render(scene, camera)
    }
    animate()

    return () => {
      cancelled = true
      cancelAnimationFrame(frameRef.current)
      resizeObserver.disconnect()
      clearGroup(arcsGroupRef.current)
      clearGroup(markersGroupRef.current)
      clearGroup(globeGroupRef.current)
      stars.geometry.dispose()
      stars.material.dispose()
      disposeTextureRefs.current.forEach((texture) => texture?.dispose?.())
      disposeTextureRefs.current = []
      renderer.dispose()
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement)
    }
  }, [clearGroup])

  useEffect(() => {
    const arcsGroup = arcsGroupRef.current
    const markersGroup = markersGroupRef.current
    if (!arcsGroup || !markersGroup) return

    clearGroup(arcsGroup)
    clearGroup(markersGroup)
    particlesRef.current = []
    destinationRingsRef.current = []
    destinationMarkerRef.current = null

    const radius = 1.15
    const destinationPos = latLonToVec3(destination.location.lat, destination.location.lon, radius + 0.018)

    const destinationCore = new THREE.Mesh(
      new THREE.SphereGeometry(0.03, 22, 22),
      new THREE.MeshBasicMaterial({ color: 0x8bf7ff })
    )
    destinationCore.position.copy(destinationPos)
    markersGroup.add(destinationCore)
    destinationMarkerRef.current = destinationCore

    for (let i = 0; i < 3; i += 1) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.014, 0.024, 48),
        new THREE.MeshBasicMaterial({
          color: 0x65f2ff,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.32,
          depthWrite: false,
        })
      )
      ring.position.copy(destinationPos)
      ring.lookAt(new THREE.Vector3(0, 0, 0))
      ring.rotateX(Math.PI / 2)
      markersGroup.add(ring)
      destinationRingsRef.current.push(ring)
    }

    visiblePoints.forEach((point, idx) => {
      const color = severityColorHex(point.severity)
      const curve = buildArcCurve(
        point.location.lat,
        point.location.lon,
        destination.location.lat,
        destination.location.lon,
        radius + 0.01
      )

      const tube = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 96, point.count >= 50 ? 0.0066 : 0.0048, 10, false),
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: point.count >= 50 ? 0.82 : 0.58,
          depthWrite: false,
        })
      )
      arcsGroup.add(tube)

      const glow = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 96, point.count >= 50 ? 0.012 : 0.008, 10, false),
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.08,
          depthWrite: false,
        })
      )
      arcsGroup.add(glow)

      const originPos = latLonToVec3(point.location.lat, point.location.lon, radius + 0.014)

      const originCore = new THREE.Mesh(
        new THREE.SphereGeometry(point.count >= 50 ? 0.02 : 0.016, 16, 16),
        new THREE.MeshBasicMaterial({ color })
      )
      originCore.position.copy(originPos)
      markersGroup.add(originCore)

      const originRing = new THREE.Mesh(
        new THREE.RingGeometry(0.008, 0.017, 32),
        new THREE.MeshBasicMaterial({
          color,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.28,
          depthWrite: false,
        })
      )
      originRing.position.copy(originPos)
      originRing.lookAt(new THREE.Vector3(0, 0, 0))
      originRing.rotateX(Math.PI / 2)
      originRing.scale.setScalar(1 + (idx % 3) * 0.22)
      markersGroup.add(originRing)

      const packet = new THREE.Mesh(
        new THREE.SphereGeometry(point.count >= 50 ? 0.016 : 0.012, 14, 14),
        new THREE.MeshBasicMaterial({ color: 0xe6fdff, transparent: true, opacity: 0.92 })
      )
      arcsGroup.add(packet)
      particlesRef.current.push({
        mesh: packet,
        curve,
        progress: (idx * 0.085) % 1,
        speed: 0.0028 + Math.min(point.count, 120) * 0.000018,
      })
    })
  }, [visiblePoints, destination, clearGroup])

  const onPointerDown = useCallback((e) => {
    isDraggingRef.current = true
    prevPointerRef.current = { x: e.clientX, y: e.clientY }
  }, [])

  const onPointerMove = useCallback((e) => {
    if (!isDraggingRef.current) return
    const dx = e.clientX - prevPointerRef.current.x
    const dy = e.clientY - prevPointerRef.current.y
    rotationVelocityRef.current.y = dx * 0.00055
    rotationVelocityRef.current.x = dy * 0.0004
    prevPointerRef.current = { x: e.clientX, y: e.clientY }
  }, [])

  const onPointerUp = useCallback(() => {
    isDraggingRef.current = false
  }, [])

  useEffect(() => {
    if (!visiblePoints.length) {
      setActivePoint(null)
      return undefined
    }
    let idx = 0
    setActivePoint(visiblePoints[0])
    const id = setInterval(() => {
      idx = (idx + 1) % visiblePoints.length
      setActivePoint(visiblePoints[idx])
    }, 2200)
    return () => clearInterval(id)
  }, [visiblePoints])

  return (
    <div className="attack-world-wrap attack-world-wrap-kaspersky" style={{ position: 'relative' }}>
      <div className="attack-world-stage attack-world-stage-real3d" style={{ position: 'relative', width: '100%', height: '100%', minHeight: 520 }}>
        <div className="attack-world-scanlines" />
        <div className="attack-world-live-badge">LIVE THREAT TELEMETRY</div>
        <div className="attack-world-legend">
          <span className="low">low</span>
          <span className="medium">medium</span>
          <span className="high">high</span>
          <span className="critical">critical</span>
        </div>
        <div
          ref={mountRef}
          style={{ width: '100%', height: '100%', minHeight: 520, cursor: isDraggingRef.current ? 'grabbing' : 'grab' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        />
      </div>

      <div className="attack-world-overlay">
        <div className="attack-world-summary attack-world-summary-kaspersky attack-world-summary-grid">
          <div><span>Eventos geolocalizados</span><strong>{data?.summary?.totalEvents ?? 0}</strong></div>
          <div><span>Orígenes activos</span><strong>{visiblePoints.length}</strong></div>
          <div><span>País dominante</span><strong>{data?.summary?.topCountry ?? 'Unknown'}</strong></div>
          <div><span>Destino protegido</span><strong>{destination.label}</strong></div>
        </div>

        <div className="attack-world-tooltip attack-world-tooltip-kaspersky attack-world-tooltip-real3d">
          {activePoint ? (
            <>
              <div className="attack-tip-eyebrow">Live route focus</div>
              <div className="attack-tip-title">{activePoint.ip}</div>
              <div className="attack-tip-route">
                <span>{activePoint.country}{activePoint.city ? ` · ${activePoint.city}` : ''}</span>
                <strong>→</strong>
                <span>{destination.label}</span>
              </div>
              <div className="attack-tip-grid">
                <div className="attack-tip-stat"><span>Eventos</span><strong>{activePoint.count}</strong></div>
                <div className="attack-tip-stat"><span>Severidad</span><strong style={{ color: severityColor(activePoint.severity) }}>{activePoint.severity}</strong></div>
                <div className="attack-tip-stat attack-tip-stat-wide"><span>Host destino</span><strong>{activePoint.targetHost || 'unknown-host'}</strong></div>
                <div className="attack-tip-stat attack-tip-stat-wide"><span>Último evento</span><strong>{formatLastSeen(activePoint.lastSeen)}</strong></div>
              </div>
            </>
          ) : (
            <>
              <div className="attack-tip-eyebrow">Mapa táctico 3D</div>
              <div className="attack-tip-title">Esperando rutas activas</div>
              <div className="attack-tip-row">No hay eventos geolocalizados disponibles todavía.</div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
