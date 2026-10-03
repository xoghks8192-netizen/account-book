import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

export default function Modal({ title, onClose, children }) {
  const ref=useRef(null)
  const close=useRef(onClose)
  close.current=onClose
  useEffect(()=>{
    const previous=document.activeElement
    ref.current?.focus()
    function key(e) {
      if(e.key==='Escape'){e.stopPropagation();close.current()}
      if(e.key!=='Tab')return
      const items=[...ref.current.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href],[tabindex="0"]')]
      if(!items.length){e.preventDefault();return}
      const first=items[0],last=items[items.length-1]
      if(e.shiftKey&&(document.activeElement===first||document.activeElement===ref.current)){e.preventDefault();last.focus()}
      else if(!e.shiftKey&&(document.activeElement===last||document.activeElement===ref.current)){e.preventDefault();first.focus()}
    }
    document.addEventListener('keydown',key)
    return()=>{document.removeEventListener('keydown',key);previous?.focus?.()}
  },[])
  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button type="button" className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>, document.body
  )
}
