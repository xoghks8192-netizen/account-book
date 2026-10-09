import { useState, useEffect, useId } from 'react'
import HeaderIcon from './HeaderIcon'

export default function Collapsible({ title, children, defaultOpen = false, className = 'form', headerExtra, forceClose, forceOpen, embedded = false }) {
  const [open, setOpen] = useState(defaultOpen)
  const bodyId = useId()

  useEffect(() => {
    if (forceClose) setOpen(false)
  }, [forceClose])

  useEffect(() => {
    if (forceOpen) setOpen(true)
  }, [forceOpen])

  if (embedded) return <div className="embedded-section">{headerExtra && <div className="section-header-extra">{headerExtra}</div>}{children}</div>

  return (
    <div className={className}>
      <div className="collapsible-header section-heading">
        <h3><button type="button" className="section-trigger" aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen(o => !o)}>
          <span>{title}</span><span className={`section-chevron${open ? ' is-open' : ''}`}><HeaderIcon name="chevron" /></span>
        </button></h3>
      </div>
      {open && headerExtra && <div className="section-header-extra">{headerExtra}</div>}
      <div id={bodyId} hidden={!open}>{open && <div className="collapsible-body">{children}</div>}</div>
    </div>
  )
}
