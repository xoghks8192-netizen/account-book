import { useSyncExternalStore } from 'react'
const listeners = new Set()
let reports = []
export function reportProblem(stage, status = 0, code = '') {
  // Only static categories/codes. Never keep bodies, URLs, names or amounts.
  const allowed = ['login','data','save','restore','backup','screen']
  const entry = {stage:allowed.includes(stage)?stage:'data',status:Number(status)||0,
    code:['DB_SECURITY_NOT_READY','AUTH_REQUIRED','VALIDATION','NETWORK','SERVER'].includes(code)?code:
      status===401?'AUTH_REQUIRED':status>=500?'SERVER':status>=400?'VALIDATION':'NETWORK',
    time:new Date().toISOString()}
  reports = [entry,...reports].slice(0,5)
  listeners.forEach(fn => fn())
  return entry
}
export function useDiagnostics() {
  return useSyncExternalStore(fn => {listeners.add(fn);return()=>listeners.delete(fn)},()=>reports,()=>reports)
}
export function problemText(stage, status = 0) {
  if(status===401) return '로그인이 만료됐어요. 다시 로그인해주세요.'
  if(typeof navigator !== 'undefined' && navigator.onLine===false) return '인터넷 연결이 끊겼어요. 연결 후 다시 시도해주세요.'
  if(stage==='login') return '로그인 확인에 실패했어요. 잠시 후 다시 시도해주세요.'
  if(stage==='save') return '저장 결과를 확인하지 못했어요. 같은 요청으로 다시 확인할 수 있어요.'
  return '데이터 연결에 실패했어요. 잠시 후 다시 시도해주세요.'
}
