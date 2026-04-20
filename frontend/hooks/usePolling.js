import { useCallback, useEffect, useRef } from 'react'

/**
 * Polling adaptativo con AbortController.
 * No acumula requests si el anterior no terminó.
 * Se limpia automáticamente al desmontar.
 *
 * @param {Function} fn - async function que recibe AbortSignal y devuelve datos
 * @param {Function} onData - callback con los datos
 * @param {number} interval - ms entre ejecuciones
 * @param {boolean} enabled - si false, no hace nada
 */
export function usePolling(fn, onData, interval = 5000, enabled = true) {
  const running = useRef(false)
  const timerRef = useRef(null)
  const abortRef = useRef(null)
  const onDataRef = useRef(onData)
  onDataRef.current = onData

  const tick = useCallback(async () => {
    if (running.current) return
    running.current = true
    abortRef.current = new AbortController()
    try {
      const data = await fn(abortRef.current.signal)
      if (!abortRef.current.signal.aborted) {
        onDataRef.current(data)
      }
    } catch (e) {
      // silenciar AbortError
    } finally {
      running.current = false
    }
  }, [fn])

  useEffect(() => {
    if (!enabled) return
    tick()
    timerRef.current = setInterval(tick, interval)
    return () => {
      clearInterval(timerRef.current)
      abortRef.current?.abort()
      running.current = false
    }
  }, [tick, interval, enabled])
}
