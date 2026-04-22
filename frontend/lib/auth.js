// Panel Hyperox v2 — auth helpers
// IMPORTANTE: usa el cliente 'hyperox-panel' (público, scope limitado)
// NO usar 'admin-cli' que es cliente server-side de administración de Keycloak

export function clearSession() {
  if (typeof window === 'undefined') return
  localStorage.removeItem('token')
  localStorage.removeItem('refresh_token')
}

async function refreshAccessToken(refreshToken) {
  const refreshRes = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  })

  if (!refreshRes.ok) return null

  const refreshData = await refreshRes.json().catch(() => null)
  if (!refreshData?.access_token) return null

  localStorage.setItem('token', refreshData.access_token)
  localStorage.setItem('refresh_token', refreshData.refresh_token || refreshToken)
  return refreshData.access_token
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
    window.location.href = '/login'
    return res
  }

  const freshToken = await refreshAccessToken(refreshToken)
  if (!freshToken) {
    clearSession()
    window.location.href = '/login'
    return res
  }

  token = freshToken
  return fetch(url, { ...options, headers: buildHeaders() })
}

export async function apiJson(url, options = {}) {
  const res = await apiFetch(url, options)
  if (res.status === 401) {
    clearSession()
    if (typeof window !== 'undefined') window.location.href = '/login'
    throw new Error('AUTH_EXPIRED')
  }
  if (!res.ok) {
    let message = 'Error de solicitud'
    try {
      const data = await res.json()
      message = data?.message || data?.error || message
    } catch {
      try { message = await res.text() || message } catch {}
    }
    throw new Error(message)
  }
  return res.json()
}

export async function apiEventStream(url, { signal, onOpen, onMessage, onError } = {}) {
  if (typeof window === 'undefined') throw new Error('Solo disponible en navegador')

  let token = localStorage.getItem('token')
  const refreshToken = localStorage.getItem('refresh_token')

  const openStream = async () => {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'text/event-stream',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal,
      cache: 'no-store',
    })

    if (res.status === 401 && refreshToken) {
      const freshToken = await refreshAccessToken(refreshToken)
      if (!freshToken) throw new Error('AUTH_EXPIRED')
      token = freshToken
      return openStream()
    }

    if (res.status === 401) throw new Error('AUTH_EXPIRED')
    if (!res.ok || !res.body) throw new Error(`STREAM_HTTP_${res.status}`)
    return res
  }

  const res = await openStream()
  onOpen?.(res)

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  const emitChunk = (chunk) => {
    const lines = chunk.split('\n')
    let event = 'message'
    const dataLines = []

    for (const rawLine of lines) {
      const line = rawLine.trimEnd()
      if (!line) continue
      if (line.startsWith('event:')) {
        event = line.slice(6).trim()
        continue
      }
      if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).trim())
      }
    }

    if (!dataLines.length) return

    try {
      const payload = JSON.parse(dataLines.join('\n'))
      onMessage?.({ event, data: payload })
    } catch (err) {
      onError?.(err)
    }
  }

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const chunks = buffer.split('\n\n')
    buffer = chunks.pop() || ''
    for (const chunk of chunks) emitChunk(chunk)
  }

  if (buffer.trim()) emitChunk(buffer)
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