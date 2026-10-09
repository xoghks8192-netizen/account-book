import { useState } from 'react'
import Modal from './Modal'
import DetailRows from './DetailRows'

export default function ExpandableText({ text, title = '전체 내용', children, details }) {
  const [open, setOpen] = useState(false)
  if (!text) return null
  return <>
    <button type="button" className="expandable-text" title="전체 내용 보기" onClick={e => { e.stopPropagation(); setOpen(true) }}>
      <span className="clamp-two">{children || text}</span>
    </button>
    {open && <Modal title={title} onClose={() => setOpen(false)}>{details ? <DetailRows rows={details} /> : <p className="full-detail-text">{text}</p>}</Modal>}
  </>
}
