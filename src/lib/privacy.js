import { useSyncExternalStore } from 'react'
let hidden = false
try { hidden = localStorage.getItem('hb-hide-money') === '1' } catch {}
const listeners = new Set()
export function setMoneyHidden(value) {
  hidden = !!value
  try { localStorage.setItem('hb-hide-money', hidden ? '1' : '0') } catch {}
  listeners.forEach(fn => fn())
}
export function usePrivacy() {
  return useSyncExternalStore(fn => { listeners.add(fn); return () => listeners.delete(fn) }, () => hidden, () => false)
}
export function useMoney() {
  const hide = usePrivacy()
  return n => hide ? '••••' : Number(n).toLocaleString('ko-KR')
}
