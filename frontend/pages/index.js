import { useEffect } from 'react'
import { useRouter } from 'next/router'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    router.replace(token ? '/overview' : '/login')
  }, [router])

  return <div className="emptyState">Cargando...</div>
}
