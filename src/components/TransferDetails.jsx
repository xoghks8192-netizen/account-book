import { useEffect, useState } from 'react'
import Modal from './Modal'
import ProblemNotice from './ProblemNotice'
import { supabase } from '../lib/supabase'
import { useMoney } from '../lib/privacy'
import { formatLedgerDate } from '../lib/displayText'
export default function TransferDetails({transaction,onClose}) {
 const money=useMoney()
 const [rows,setRows]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState(false),[retry,setRetry]=useState(0)
 useEffect(()=>{
  let cancelled=false
  if(!transaction.transfer_id){setLoading(false);return}
  setLoading(true);setError(false)
  supabase.from('transactions').select('id,date,type,owner,amount,transfer_id').eq('transfer_id',transaction.transfer_id).order('id').then(({data,error})=>{
   if(cancelled)return
   setRows(data||[]);setError(!!error);setLoading(false)
  })
  return()=>{cancelled=true}
 },[transaction.id,transaction.transfer_id,retry])
 const sender=rows.find(r=>r.type==='expense'),receiver=rows.find(r=>r.type==='income')
 return <Modal title="배우자 이체 연결" onClose={onClose}>
   {!transaction.transfer_id?<p>이전 방식으로 입력한 이체라 자동 연결 정보가 없어요. 금액이나 날짜만으로 상대방 내역을 추측해 연결하지 않습니다.</p>:
    loading?<p role="status">연결된 내역을 확인 중…</p>:
    error?<ProblemNotice message="이체 내역을 불러오지 못했어요." onRetry={()=>setRetry(n=>n+1)}/>:
    sender&&receiver?<div className="transfer-summary">
      <div className="transfer-route"><span>{sender.owner}<small>보낸 사람</small></span><span aria-hidden="true">→</span><span>{receiver.owner}<small>받은 사람</small></span></div>
      <strong>{money(sender.amount)}원</strong>
      <p>{formatLedgerDate(sender.date, true)}</p>
      <p className="help-text">{sender.amount===receiver.amount&&sender.date===receiver.date?'양쪽 내역의 금액·날짜가 일치해요.':'양쪽 내역이 달라요. 수정 전에 확인해주세요.'}</p>
      <p className="help-text">금액·날짜 수정과 삭제는 양쪽에 함께 반영돼요.</p>
    </div>:<p role="alert">연결된 내역이 일부 없어요. 새 이체를 입력하기 전에 기존 내역을 확인해주세요.</p>}
 </Modal>
}
