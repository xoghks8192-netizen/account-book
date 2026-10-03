import { createHmac, timingSafeEqual } from 'node:crypto'
import { fail, rateLimit } from './auth.js'
const MAX_BYTES=3000000
export function signBackup(payload, secret=process.env.SUPABASE_SERVICE_ROLE_KEY) {
  if(!secret) throw fail(503,'백업 서명 설정을 확인해주세요.')
  return createHmac('sha256',secret).update('household-backup-v1:'+payload).digest('hex')
}
export function verifyBackup(file,user,secret) {
  if(!file || file.format!=='household-budget-backup' || file.version!==1 ||
     typeof file.payload!=='string' || Buffer.byteLength(file.payload)>MAX_BYTES ||
     typeof file.signature!=='string' || !/^[a-f0-9]{64}$/.test(file.signature))
    throw fail(400,'새 JSON 백업 파일을 선택해주세요. 기존 CSV는 복원에 필요한 연결 정보가 없어 지원하지 않습니다.')
  const expected=signBackup(file.payload,secret)
  if(!timingSafeEqual(Buffer.from(file.signature,'hex'),Buffer.from(expected,'hex'))) throw fail(400,'파일이 변경됐거나 서명이 유효하지 않습니다.')
  let payload
  try { payload=JSON.parse(file.payload) } catch { throw fail(400,'백업 파일을 읽을 수 없습니다.') }
  if(payload.householdId!==user.household_id || payload.username!==user.username)
    throw fail(403,'백업을 만든 가구와 계정에서만 복원할 수 있습니다.')
  for(const key of ['assets','transactions','recurring_templates']) {
    if(!Array.isArray(payload.data?.[key]) || payload.data[key].length>10000) throw fail(400,'백업 항목 수를 확인해주세요.')
    const ids=payload.data[key].map(r=>String(r.id))
    if(new Set(ids).size!==ids.length) throw fail(400,'중복된 항목 번호가 있는 백업입니다.')
  }
  return payload
}
export async function handleBackup(req,res,db,user) {
  const {action,file,requestId}=req.body||{}
  const mode={'backup-export':'export','backup-preview':'preview','backup-restore':'restore'}[action]
  if(!mode) throw fail(400,'잘못된 백업 요청입니다.')
  await rateLimit(db,'backup:'+user.username,20)
  let document
  if(mode!=='export') document=verifyBackup(file,user)
  if(mode==='restore' && !/^[a-f0-9-]{36}$/i.test(requestId||'')) throw fail(400,'복원 요청 번호를 확인해주세요.')
  const {data,error}=await db.rpc('hb_backup',{p_actor:user.username,p_mode:mode,
    p_data:document?.data||null,p_request:mode==='restore'?requestId:mode==='preview'?'00000000-0000-4000-8000-000000000001':null})
  if(error?.code==='PGRST202' || error?.code==='42883') throw Object.assign(fail(503,'백업 복원 준비가 필요합니다. SQL 024를 실행한 뒤 다시 시도해주세요.'),{code:'BACKUP_SETUP_REQUIRED'})
  if(error?.code==='P0001') throw fail(400,error.message)
  if(error) throw fail(503,'백업 처리를 완료하지 못했습니다. 같은 요청으로 다시 시도해주세요.')
  if(mode==='export') {
    const payload=JSON.stringify({householdId:user.household_id,username:user.username,createdAt:new Date().toISOString(),data})
    if(Buffer.byteLength(payload)>MAX_BYTES) throw fail(400,'백업 파일이 너무 큽니다. 관리자에게 문의해주세요.')
    return res.status(200).json({format:'household-budget-backup',version:1,payload,signature:signBackup(payload)})
  }
  return res.status(200).json({...data,createdAt:document.createdAt})
}
