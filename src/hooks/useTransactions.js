import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

function sortTx(list) {
  return [...list].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id))
}

export function useTransactions({ householdId, start, end, prevStart, prevEnd, owners, myName }) {
  const [transactions, setTransactions] = useState([])
  const [prevTransactions, setPrevTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const pendingRequests = useRef(new Map())
  const activeContext = useRef(null)
  activeContext.current = { householdId, start, end, prevStart, prevEnd }
  // 이번 달 내역
  useEffect(() => {
    if (!householdId) { setTransactions([]); setPrevTransactions([]); setLoading(false); return }
    let cancelled = false
    async function load() {
      setLoading(true); setError(null)
      const { data, error } = await supabase
        .from('transactions').select('*')
        .eq('household_id', householdId)
        .gte('date', start).lt('date', end)
        .order('date', { ascending: false }).order('id', { ascending: false })
      if (cancelled) return
      if (error) setError(error.message)
      else setTransactions(data)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [start, end, householdId])

  // 지난 달 내역
  useEffect(() => {
    if (!householdId) { setTransactions([]); setPrevTransactions([]); setLoading(false); return }
    let cancelled = false
    async function load() {
      const { data, error } = await supabase
        .from('transactions').select('*')
        .eq('household_id', householdId)
        .gte('date', prevStart).lt('date', prevEnd)
      if (cancelled) return
      if (!error) setPrevTransactions(data)
    }
    load()
    return () => { cancelled = true }
  }, [prevStart, prevEnd, householdId])

  async function mutate(action, id, fields = {}) {
    const cleaned = Object.fromEntries(Object.entries(fields).filter(([key]) =>
      ['type','date','category','amount','memo','owner','linked_asset_id'].includes(key)))
    const signature = JSON.stringify({householdId,action,id,fields:cleaned})
    let pending = pendingRequests.current.get(signature)
    if (pending?.inFlight) return null
    if (!pending) {
      pending = { requestId:crypto.randomUUID(), inFlight:false }
      pendingRequests.current.set(signature,pending)
    }
    pending.inFlight = true
    setError(null)
    try {
      const res = await fetch('/api/transactions', {
        method:'POST', credentials:'same-origin', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({action,id,fields:cleaned,requestId:pending.requestId}),
      })
      const result = await res.json()
      if (res.status === 401) window.dispatchEvent(new Event('hb-session-expired'))
      if (!res.ok) {
        // Keep the request ID on uncertain/network/server failures for safe retries.
        if (res.status < 500) pendingRequests.current.delete(signature)
        throw new Error(result.error || '내역을 저장하지 못했습니다.')
      }
      const touched = new Set([...(result.removedIds || []), ...(result.rows || []).map(r => r.id)])
      const reconcile = (list, from, to) => sortTx([
        ...list.filter(t => !touched.has(t.id)),
        ...(result.rows || []).filter(t => t.date >= from && t.date < to),
      ])
      const active = activeContext.current
      if (active.householdId === householdId) {
        setTransactions(prev => reconcile(prev,active.start,active.end))
        setPrevTransactions(prev => reconcile(prev,active.prevStart,active.prevEnd))
      }
      pendingRequests.current.delete(signature)
      return result
    } catch(e) {
      if (activeContext.current.householdId === householdId) {
        setError(e.message || '처리 결과를 확인하지 못했습니다. 연결을 확인하고 다시 시도해주세요.')
      }
      return null
    } finally { pending.inFlight = false }
  }

  async function handleAdd(tx) {
    const result = await mutate('add',null,tx)
    return result?.primary || null
  }
  async function handleDelete(id) {
    return !!await mutate('delete',id)
  }
  async function handleUpdate(id,fields) {
    return !!await mutate('update',id,fields)
  }

  return { transactions, prevTransactions, loading, error, setError, handleAdd, handleDelete, handleUpdate }
}
