export function clearSession() {
  if (typeof window === 'undefined') return
  localStorage.removeItem('token')
  localStorage.removeItem('refresh_token')
}

export async function apiFetch(url, options = {}) {
  if (typeof window === 'undefined') throw new Error('Solo disponible en navegador')

  let token = localStorage.getItem('token')
  const refreshToken = localStorage.getItem('refresh_token')

  const buildHeaders = (extra = {}) => ({
    ...(options.headers || {}),
    ...extra,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  })

  let res = await fetch(url, { ...options, headers: buildHeaders() })

  if (res.status !== 401) return res
  if (!refreshToken) {
    clearSession()
    return res
  }

  const refreshRes = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  })

  if (!refreshRes.ok) {
    clearSession()
    return res
  }

  const refreshData = await refreshRes.json()
  if (!refreshData?.access_token) {
    clearSession()
    return res
  }

  localStorage.setItem('token', refreshData.access_token)
  localStorage.setItem('refresh_token', refreshData.refresh_token || refreshToken)
  token = refreshData.access_token

  return fetch(url, { ...options, headers: buildHeaders() })
}

export async function apiJson(url, options = {}) {
  const res = await apiFetch(url, options)
  if (res.status === 401) throw new Error('AUTH_EXPIRED')
  if (!res.ok) {
    let message = 'Error de solicitud'
    try {
      const data = await res.json()
      message = data?.message || data?.error || message
    } catch {
      try {
        message = await res.text() || message
      } catch {}
    }
    throw new Error(message)
  }
  return res.json()
}

export function requireToken(router) {
  if (typeof window === 'undefined') return false
  const token = localStorage.getItem('token')
  if (!token) {
    router?.replace('/login')
    return false
  }
  return true
}
