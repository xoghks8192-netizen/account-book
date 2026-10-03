import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { mutationRequest } from '../lib/mutationRequest'
import { reportProblem } from '../lib/diagnostics'

function sortTx(list) {
  return [...list].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id))
}

export function useTransactions({ householdId, start, end, prevStart, prevEnd, owners, myName }) {
  const [transactions, setTransactions] = useState([])
  const [prevTransactions, setPrevTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const pending = useRef(null)
  const busy = useRef(false)
  const [mutationState,setMutationState] = useState({status:'idle'})
  const [refreshToken,setRefreshToken] = useState(0)
  const storageKey = 'hb-pending:'+householdId+':'+myName
  useEffect(()=>{
    pending.current=null
    try { const saved=JSON.parse(sessionStorage.getItem(storageKey)||'null'); if(saved?.requestId) pending.current=saved } catch {}
    setMutationState(pending.current?{status:'uncertain',message:'앞선 저장 요청의 결과를 확인해주세요.'}:{status:'idle'})
  },[storageKey])
  function refresh(){setRefreshToken(n=>n+1)}
  function forget(){pending.current=null;try{sessionStorage.removeItem(storageKey)}catch{}}
  const activeContext = useRef(null)
  activeContext.current = { householdId, myName, start, end, prevStart, prevEnd }
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
  }, [start, end, householdId, refreshToken])

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
  }, [prevStart, prevEnd, householdId, refreshToken])

  function applyResult(result) {
    if(activeContext.current.householdId!==householdId) return
    const touched=new Set([...(result.removedIds||[]),...(result.rows||[]).map(r=>r.id)])
    const reconcile=(list,from,to)=>sortTx([...list.filter(t=>!touched.has(t.id)),...(result.rows||[]).filter(t=>t.date>=from&&t.date<to)])
    const active=activeContext.current
    setTransactions(prev=>reconcile(prev,active.start,active.end))
    setPrevTransactions(prev=>reconcile(prev,active.prevStart,active.prevEnd))
  }

  async function runPending() {
    if(busy.current || !pending.current) return null
    const request=pending.current
    busy.current=true
    setError(null)
    setMutationState({status:'saving',message:'저장 중…'})
    let result=null
    try {
      result=await mutationRequest(request)
    } catch(e) {
      if(activeContext.current.householdId!==householdId || activeContext.current.myName!==myName) return null
      reportProblem('save',e.status)
      if(e.status===401) window.dispatchEvent(new Event('hb-session-expired'))
      if(e.uncertain) {
        setMutationState({status:'checking',message:'서버에 저장됐는지 확인 중…'})
        try {
          const checked=await mutationRequest({action:'status',requestId:request.requestId})
          if(checked.state==='confirmed') result=checked.result
        } catch {}
        if(!result) setMutationState({status:'uncertain',message:'저장 결과가 아직 확인되지 않았어요. 새로 입력하지 말고 아래 버튼으로 같은 요청을 다시 확인해주세요.'})
      } else {
        forget()
        setMutationState({status:'failed',message:e.message})
      }
    } finally { busy.current=false }
    if(activeContext.current.householdId!==householdId || activeContext.current.myName!==myName) return null
    if(result) {
      applyResult(result)
      forget()
      setMutationState({status:'saved',message:'저장 결과를 확인했어요.'})
      refresh()
    }
    return result ? {...result,action:request.action} : null
  }

  async function mutate(action,id,fields={}) {
    if(busy.current)return null
    if(pending.current) {
      setMutationState({status:'uncertain',message:'먼저 앞선 요청의 저장 결과를 확인해주세요.'})
      return null
    }
    const cleaned=Object.fromEntries(Object.entries(fields).filter(([key])=>['type','date','category','amount','memo','owner','linked_asset_id'].includes(key)))
    pending.current={action,id,fields:cleaned,requestId:crypto.randomUUID()}
    try{sessionStorage.setItem(storageKey,JSON.stringify(pending.current))}catch{}
    return runPending()
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

  return { transactions, prevTransactions, loading, error, setError, handleAdd, handleDelete, handleUpdate, mutationState, retryMutation:runPending, refresh }
}
