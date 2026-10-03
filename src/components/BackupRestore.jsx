import { useRef, useState } from 'react'
import Modal from './Modal'
import { reportProblem } from '../lib/diagnostics'
export default function BackupRestore({onClose,onRestored}) {
 const [file,setFile]=useState(null),[preview,setPreview]=useState(null),[busy,setBusy]=useState(false)
 const [error,setError]=useState(''),[done,setDone]=useState(false),[confirmed,setConfirmed]=useState(false)
 const request=useRef(null), input=useRef(null), restoring=useRef(false)
 async function call(action,backup,requestId) {
  try {
   const res=await fetch('/api/data',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,file:backup,requestId})})
   const data=await res.json()
   if(res.status===401) window.dispatchEvent(new Event('hb-session-expired'))
   if(!res.ok){reportProblem('restore',res.status);throw new Error(data.message||data.error||'복원하지 못했습니다.')}
   return data
  } catch(e){reportProblem('restore');throw e}
 }
 async function read(e) {
  const selected=e.target.files?.[0]
  if(!selected)return
  setPreview(null);setFile(null);setError('');setDone(false);setConfirmed(false);setBusy(true)
  try {
   if(selected.size>4000000)throw new Error('4MB 이하의 JSON 백업 파일을 선택해주세요.')
   const backup=JSON.parse(await selected.text())
   const result=await call('backup-preview',backup)
   setFile(backup);setPreview(result);request.current=crypto.randomUUID()
  }catch(e){setError(e.message||'백업 파일을 읽지 못했습니다.')}finally{setBusy(false)}
 }
 async function restore() {
  if(restoring.current||!confirmed)return
  restoring.current=true;setBusy(true);setError('')
  try { const result=await call('backup-restore',file,request.current);setPreview(result);setDone(true);onRestored() }
  catch(e){setError(e.message+' 결과를 확인하지 못했다면 창을 닫지 말고 같은 복원 버튼으로 다시 확인해주세요.')}
  finally {restoring.current=false;setBusy(false)}
 }
 return <Modal title="백업 복원" onClose={()=>{if(!busy)onClose()}}>
  <p>이 계정에서 만든 JSON 백업을 선택해주세요. 기존 항목은 덮어쓰지 않고, 없는 항목만 추가해요.</p>
  <p className="help-text">기존 CSV는 지원하지 않아요. 설정·분류 목록·과거 자산 그래프는 복원 대상이 아닙니다. 휴지통에 있는 자산도 기존 항목으로 처리해요.</p>
  <input ref={input} type="file" accept=".json,application/json" disabled={busy||done} onChange={read}/>
  {busy&&<p role="status">처리 중…</p>}
  {error&&<p role="alert" className="utility-error">{error}</p>}
  {preview&&<>
   <p>{new Date(preview.createdAt).toLocaleString('ko-KR')} 백업</p>
   <table className="restore-table"><thead><tr><th>항목</th><th>{done?'복원됨':'추가 예정'}</th><th>기존 항목</th></tr></thead>
    <tbody>{[['transactions','내역'],['assets','자산'],['recurring_templates','고정 항목']].map(([key,label])=><tr key={key}><th>{label}</th><td>{preview.added[key]}</td><td>{preview.skipped[key]}</td></tr>)}</tbody>
   </table>
   <p className="help-text">내역을 복원해도 현재 자산 잔액을 다시 더하거나 빼지 않아요. 기존 잔액과 소프트 삭제 상태는 유지됩니다. 파일에는 개인정보가 있으니 안전하게 보관해주세요.</p>
   {!done&&<label className="restore-confirm"><input type="checkbox" checked={confirmed} disabled={busy} onChange={e=>setConfirmed(e.target.checked)}/>미리보기와 잔액 유지 안내를 확인했습니다.</label>}
   {!done?<button className="submit-btn" disabled={!confirmed||busy||!Object.values(preview.added).some(Number)} onClick={restore}>없는 항목 복원하기</button>:<p role="status">복원 결과를 확인했어요. 내역과 자산을 갱신했습니다.</p>}
  </>}
 </Modal>
}
