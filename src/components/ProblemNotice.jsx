import { useState } from 'react'
import { useDiagnostics } from '../lib/diagnostics'
export default function ProblemNotice({message='연결 상태를 확인해주세요.', onRetry}) {
 const reports=useDiagnostics()
 const [copied,setCopied]=useState(false)
 async function copy() {
   try { await navigator.clipboard.writeText(JSON.stringify({app:'household-budget',reports},null,2));setCopied(true) } catch { setCopied(false) }
 }
 return <section className="problem-notice" role="alert">
   <strong>{message}</strong>
   <p>진단 정보에는 이름·비밀번호·거래 내용이 포함되지 않아요.</p>
   <div className="utility-actions">
     {onRetry && <button type="button" onClick={onRetry}>다시 시도</button>}
     <button type="button" onClick={copy}>{copied?'복사됨':'진단 정보 복사'}</button>
   </div>
 </section>
}
