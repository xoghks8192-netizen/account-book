import { useState } from 'react'

export default function Collapsible({ title, children, defaultOpen = false, className = 'form', headerExtra }) {
  const [open, setOpen] = useState(defaultOpen)

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
