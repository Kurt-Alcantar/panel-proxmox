import { useEffect } from 'react'
import { useRouter } from 'next/router'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null

    if (token) {
      router.replace('/vms')
    } else {
      router.replace('/login')
    }
  }, [router])

  return <div>Cargando...</div>
}