export async function mutationRequest(payload, fetcher = fetch) {
  const controller=new AbortController()
  const timer=setTimeout(()=>controller.abort(),15000)
  try {
    const res=await fetcher('/api/transactions',{method:'POST',credentials:'same-origin',
      headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:controller.signal})
    const result=await res.json()
    if(!res.ok) throw Object.assign(new Error(result.error || '저장 요청을 처리하지 못했습니다.'),{status:res.status,uncertain:res.status>=500})
    return result
  } catch(e) {
    if(!e.status) e.uncertain=true
    throw e
  } finally { clearTimeout(timer) }
}
