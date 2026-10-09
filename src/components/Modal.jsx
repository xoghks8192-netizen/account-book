import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export default function Modal({ title, onClose, children, footer, dirty = false, busy = false }) {
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const ref=useRef(null)
  const close=useRef(onClose)
  function requestClose() {
    if (busy) return
    if (confirmDiscard) { setConfirmDiscard(false); return }
    if (dirty) { setConfirmDiscard(true); return }
    onClose()
  }
  close.current=requestClose
  useEffect(() => {
    if (!dirty) return
    const warn = e => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])
  useEffect(()=>{
    const previous=document.activeElement
    ref.current?.focus()
    function key(e) {
      if(e.key==='Escape'){e.stopPropagation();close.current()}
      if(e.key!=='Tab')return
      const items=[...ref.current.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]')].filter(el => el.getClientRects().length)
      if(!items.length){e.preventDefault();return}
      const first=items[0],last=items[items.length-1]
      if(e.shiftKey&&(document.activeElement===first||document.activeElement===ref.current)){e.preventDefault();last.focus()}
      else if(!e.shiftKey&&(document.activeElement===last||document.activeElement===ref.current)){e.preventDefault();first.focus()}
    }
    document.addEventListener('keydown',key)
    return()=>{document.removeEventListener('keydown',key);previous?.focus?.()}
  },[])
  return createPortal(
    <div className="modal-overlay" onClick={requestClose}>
      <div className={`modal-content${footer ? ' modal-with-footer' : ''}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref} onClick={(e) => e.stopPropagation()} onClickCapture={e => {
        if (e.target.closest('[data-modal-dismiss]')) { e.preventDefault(); e.stopPropagation(); requestClose() }
      }}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button type="button" className="modal-close" onClick={requestClose} disabled={busy} aria-label="닫기">
            ✕
          </button>
        </div>
        <div className="modal-body" hidden={confirmDiscard}>{children}</div>
        {footer && !confirmDiscard && <div className="modal-footer">{footer}</div>}
        {confirmDiscard && <div className="discard-confirm" role="alert">
          <p>변경 내용을 버릴까요?</p>
          <div className="confirm-actions">
            <button autoFocus className="confirm-btn cancel" onClick={() => setConfirmDiscard(false)}>계속 수정</button>
            <button className="confirm-btn delete" onClick={onClose}>변경 버리기</button>
          </div>
        </div>}
      </div>
    </div>, document.body
  )
}
