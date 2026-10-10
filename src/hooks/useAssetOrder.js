import { useEffect, useRef, useState } from 'react'
import { useAutoRefresh } from './useAutoRefresh'

async function request(action, ids) {
  const response = await fetch('/api/data', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ids }) })
  const body = await response.json()
  if (!response.ok) throw new Error(body.message || '순서를 동기화하지 못했어요.')
  return body.ids
}

export function useAssetOrder(householdId, username, paused = false) {
  const key = `asset_order_${householdId}:${username}`
  const [order, setOrder] = useState(() => { try { return JSON.parse(localStorage.getItem(key) || localStorage.getItem(`asset_order_${householdId}`) || '[]') } catch { return [] } })
  const [status, setStatus] = useState('loading')
  const [message, setMessage] = useState('')
  const [retry, setRetry] = useState(0)
  const busy = useRef(false)
  const revision = useRef(0)
  const pausedRef = useRef(paused)
  pausedRef.current = paused
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    request('asset-order-get').then(ids => {
      if (cancelled) return
      if (ids !== null) { setOrder(ids); localStorage.setItem(key, JSON.stringify(ids)) }
      setStatus('ready'); setMessage('')
    }).catch(e => { if (!cancelled) { setStatus('error'); setMessage(e.message) } })
    return () => { cancelled = true }
  }, [key, retry])
  useAutoRefresh(async canApply => {
    if (paused || busy.current || status !== 'ready') return
    const version = revision.current
    try {
      const ids = await request('asset-order-get')
      if (ids !== null && canApply() && version === revision.current && !busy.current && !pausedRef.current) { setOrder(ids); localStorage.setItem(key, JSON.stringify(ids)) }
    } catch { /* Existing order stays visible; explicit saving reports failures. */ }
  }, key)
  function update(ids) { revision.current++; setOrder(ids); localStorage.setItem(key, JSON.stringify(ids)) }
  async function save() {
    if (busy.current || status === 'loading') return false
    busy.current = true; setStatus('saving')
    try {
      const ids = await request('asset-order-save', order)
      if (alive.current) { update(ids); setStatus('ready'); setMessage('') }
      return true
    } catch (e) {
      if (alive.current) { setStatus('error'); setMessage(e.message) }
      return false
    } finally { busy.current = false }
  }
  return { order, update, save, status, message, reload: () => setRetry(n => n + 1) }
}
