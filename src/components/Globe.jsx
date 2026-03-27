import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Stars, Sphere, useTexture, Html } from '@react-three/drei'
import * as THREE from 'three'

const CITY_POINTS = [
  { lat: 40.7128, lng: -74.006, label: 'New York' },
  { lat: 51.5074, lng: -0.1278, label: 'London' },
  { lat: 35.6762, lng: 139.6503, label: 'Tokyo' },
  { lat: -33.8688, lng: 151.2093, label: 'Sydney' },
  { lat: 1.3521, lng: 103.8198, label: 'Singapore' },
  { lat: 41.9028, lng: 12.4964, label: 'Rome' },
  { lat: 55.7558, lng: 37.6173, label: 'Moscow' },
  { lat: 19.4326, lng: -99.1332, label: 'Mexico City' },
  { lat: -23.5505, lng: -46.6333, label: 'São Paulo' },
  { lat: 28.6139, lng: 77.209, label: 'New Delhi' },
]

function latLngToVec3(lat, lng, radius) {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lng + 180) * (Math.PI / 180)
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  )
}

function Atmosphere({ radius }) {
  return (
    <Sphere args={[radius * 1.12, 64, 64]}>
      <meshBasicMaterial
        color="#0066ff"
        transparent
        opacity={0.04}
        side={THREE.BackSide}
      />
    </Sphere>
  )
}

function GlobeDot({ position }) {
  return (
    <mesh position={position}>
      <sphereGeometry args={[0.018, 16, 16]} />
      <meshBasicMaterial color="#00d4ff" />
    </mesh>
  )
}

function GlowRing({ radius }) {
  const ringRef = useRef()
  const points = useMemo(() => {
    const pts = []
    for (let i = 0; i <= 64; i++) {
      const angle = (i / 64) * Math.PI * 2
      pts.push(new THREE.Vector3(
        Math.cos(angle) * radius,
        0,
        Math.sin(angle) * radius
      ))
    }
    return pts
  }, [radius])

  useFrame((_, delta) => {
    if (ringRef.current) {
      ringRef.current.rotation.y += delta * 0.05
    }
  })

  return (
    <group ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
      <Line points={points} color="#00d4ff" opacity={0.15} />
    </group>
  )
}

function Line({ points, color, opacity = 0.6 }) {
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry().setFromPoints(points)
    return geo
  }, [points])

  return (
    <line geometry={geometry}>
      <lineBasicMaterial color={color} transparent opacity={opacity} />
    </line>
  )
}

function ArcLine({ start, end, radius }) {
  const points = useMemo(() => {
    const startVec = latLngToVec3(start.lat, start.lng, radius)
    const endVec = latLngToVec3(end.lat, end.lng, radius)
    const midVec = new THREE.Vector3().addVectors(startVec, endVec).multiplyScalar(1.25)
    const curve = new THREE.QuadraticBezierCurve3(startVec, midVec, endVec)
    return curve.getPoints(40)
  }, [start, end, radius])

  return <Line points={points} color="#00d4ff" opacity={0.5} />
}

function GlobeMesh({ globeRef }) {
  useFrame((_, delta) => {
    if (globeRef.current) {
      globeRef.current.rotation.y += delta * 0.04
    }
  })

  return (
    <group>
      <Sphere ref={globeRef} args={[1, 64, 64]}>
        <meshPhongMaterial
          color="#0a1628"
          emissive="#061020"
          shininess={10}
          specular="#003366"
        />
      </Sphere>
      <Atmosphere radius={1} />
      <GlowRing radius={1} />

      {CITY_POINTS.map((city, i) => {
        const pos = latLngToVec3(city.lat, city.lng, 1.01)
        return <GlobeDot key={i} position={pos} />
      })}

      {[0, 1, 2, 3, 4].map(i => {
        const start = CITY_POINTS[i]
        const end = CITY_POINTS[(i + 5) % CITY_POINTS.length]
        return <ArcLine key={i} start={start} end={end} radius={1.02} />
      })}
    </group>
  )
}

export default function Globe() {
  const globeRef = useRef()

  return (
    <Canvas
      camera={{ position: [0, 0, 3.2], fov: 50 }}
      style={{ background: 'transparent' }}
    >
      <ambientLight intensity={0.2} />
      <pointLight position={[5, 3, 5]} intensity={0.8} color="#00d4ff" />
      <pointLight position={[-5, -3, -5]} intensity={0.3} color="#0066ff" />
      <Stars radius={120} depth={60} count={4000} factor={4} fade speed={0.5} />
      <GlobeMesh globeRef={globeRef} />
    </Canvas>
  )
}
