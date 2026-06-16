import { useState, useEffect } from 'react'

export default function Collapsible({ title, children, defaultOpen = false, className = 'form', headerExtra, forceClose }) {
  const [open, setOpen] = useState(defaultOpen)

  useEffect(() => {
    if (forceClose) setOpen(false)
  }, [forceClose])

  return (
    <div className={className}>
      <div className="collapsible-header">
        <h3>{title}</h3>
        {open && headerExtra && <div className="collapsible-extra">{headerExtra}</div>}
        <button type="button" className="collapsible-toggle" onClick={() => setOpen((o) => !o)}>
          {open ? '접기 ▲' : '보기 ▼'}
        </button>
      </div>
      {open && <div className="collapsible-body">{children}</div>}
    </div>
  )
}
