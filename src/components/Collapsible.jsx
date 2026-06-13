import { useState } from 'react'

export default function Collapsible({ title, children, defaultOpen = false, className = 'form' }) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className={className}>
      <button type="button" className="collapsible-header" onClick={() => setOpen((o) => !o)}>
        <h3>{title}</h3>
        <span className="collapsible-toggle">{open ? '접기 ▲' : '보기 ▼'}</span>
      </button>
      {open && <div className="collapsible-body">{children}</div>}
    </div>
  )
}
