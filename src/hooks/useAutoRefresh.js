import { useEffect, useRef } from 'react'

// Do not replace rows while a user is typing or editing in a dialog.
export function canAutoRefresh(doc = document) {
  return doc.visibilityState === 'visible' &&
    !doc.querySelector('[role="dialog"], .modal-overlay') &&
    !doc.activeElement?.matches('input, textarea, select, [contenteditable="true"]')
}

export function useAutoRefresh(callback, enabled = true) {
  const latest = useRef(callback)
  latest.current = callback
  useEffect(() => {
    if (!enabled) return
    let running = false, disposed = false
    async function refresh() {
      if (running || disposed || !navigator.onLine || !canAutoRefresh()) return
      running = true
      const callback = latest.current
      try { await callback(() => !disposed && canAutoRefresh()) } catch { /* Existing data stays visible while offline. */ }
      finally { running = false }
    }
    const timer = setInterval(refresh, 15000)
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('online', refresh)
    return () => {
      disposed = true
      clearInterval(timer)
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('online', refresh)
    }
  }, [enabled])
}
