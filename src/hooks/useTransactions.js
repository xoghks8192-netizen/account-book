import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { TRANSFER_CATEGORY } from '../categories'

function sortTx(list) {
  return [...list].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id))
}

export function useTransactions({ householdId, start, end, prevStart, prevEnd, owners, myName }) {
  const [transactions, setTransactions] = useState([])
  const [prevTransactions, setPrevTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // 이번 달 내역
  useEffect(() => {
    if (!householdId) return
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
    if (!householdId) return
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

  async function adjustAssetAmount(assetId, delta) {
    if (!assetId || !delta) return
    const { data } = await supabase.from('assets').select('amount').eq('id', assetId).single()
    if (!data) return
    await supabase.from('assets').update({ amount: Number(data.amount) + delta, updated_at: new Date().toISOString() }).eq('id', assetId)
  }

  async function handleAdd(tx) {
    const { data, error } = await supabase
      .from('transactions')
      .insert({ ...tx, author: tx.author || myName, household_id: householdId })
      .select().single()
    if (error) { setError(error.message); return null }
    if (tx.date >= start && tx.date < end) {
      setTransactions(prev => sortTx([...prev, data]))
    }
    if (data.linked_asset_id) {
      await adjustAssetAmount(data.linked_asset_id, Number(data.amount))
    }
    if (data.category === TRANSFER_CATEGORY && data.type === 'expense') {
      const partner = owners.find(o => o !== '공동' && o !== data.owner)
      if (partner) {
        const { data: counterData } = await supabase
          .from('transactions')
          .insert({ date: data.date, type: 'income', category: TRANSFER_CATEGORY, amount: data.amount, owner: partner, memo: data.memo, author: data.author, household_id: householdId })
          .select().single()
        if (counterData && counterData.date >= start && counterData.date < end) {
          setTransactions(prev => sortTx([...prev, counterData]))
        }
      }
    }
    return data
  }

  async function handleDelete(id) {
    const target = transactions.find(t => t.id === id)
    const { error } = await supabase.from('transactions').delete().eq('id', id)
    if (error) { setError(error.message); return false }
    setTransactions(prev => prev.filter(t => t.id !== id))
    if (target?.linked_asset_id) {
      await adjustAssetAmount(target.linked_asset_id, -Number(target.amount))
    }
    return true
  }

  async function handleUpdate(id, fields) {
    const old = transactions.find(t => t.id === id)
    const { data, error } = await supabase.from('transactions').update(fields).eq('id', id).select().single()
    if (error) { setError(error.message); return false }
    setTransactions(prev => sortTx(prev.map(t => t.id === id ? data : t)))
    if (old?.linked_asset_id) await adjustAssetAmount(old.linked_asset_id, -Number(old.amount))
    if (data.linked_asset_id) await adjustAssetAmount(data.linked_asset_id, Number(data.amount))
    return true
  }

  return { transactions, prevTransactions, loading, error, setError, handleAdd, handleDelete, handleUpdate }
}
