import { useState } from 'react'
import Modal from './Modal'
import CategoryManager from './CategoryManager'
import { getCategoryEmoji } from '../categories'

export default function CategoryPicker({ value, options, transactions = [], type, onChange, onAdd, onRemove, onMove }) {
  const [open, setOpen] = useState(false)
  const [manage, setManage] = useState(false)
  const choices = [...new Set([...options, value].filter(Boolean))]
  const counts = new Map()
  transactions.filter(t => t.type === type && choices.includes(t.category)).forEach(t => counts.set(t.category, (counts.get(t.category) || 0) + 1))
  const frequent = [...counts.keys()].sort((a, b) => counts.get(b) - counts.get(a)).slice(0, 5)
  function grid(items) {
    return <div className="category-picker-grid">{items.map(name => <button type="button" key={name}
      className={`category-picker-option${name === value ? ' selected' : ''}`} aria-pressed={name === value}
      onClick={() => { onChange(name); setOpen(false) }}>
      <span aria-hidden="true" className="category-picker-icon">{getCategoryEmoji(name)}</span>
      <span>{name}</span>
    </button>)}</div>
  }
  return <>
    <button type="button" className="category-picker-trigger" aria-haspopup="dialog" aria-expanded={open}
      onClick={() => { setManage(false); setOpen(true) }}>
      <span aria-hidden="true">{getCategoryEmoji(value)}</span><span>{value || '카테고리 선택'}</span><span aria-hidden="true">⌄</span>
    </button>
    {open && <Modal title={`${type === 'income' ? '수입' : '지출'} 카테고리`} onClose={() => setOpen(false)}>
      <div className="category-picker-toolbar"><span>항목을 누르면 선택돼요</span><button type="button" className="collapsible-toggle" onClick={() => setManage(v => !v)}>{manage ? '선택으로' : '관리'}</button></div>
      {manage ? <div className="category-picker-management"><CategoryManager options={options} onAdd={onAdd} onRemove={onRemove} onMove={onMove} /></div> : <>
        {frequent.length > 0 && <section><h4>자주 사용 · 조회 중인 달 기준</h4>{grid(frequent)}</section>}
        <section><h4>전체 카테고리</h4>{grid(choices)}</section>
      </>}
    </Modal>}
  </>
}
