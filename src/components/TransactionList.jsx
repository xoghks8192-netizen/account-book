import { useEffect, useRef, useState } from 'react'
import { DEFAULT_CATEGORIES } from '../categories'
import CategorySelect from './CategorySelect'
import Modal from './Modal'
import ConfirmDialog from './ConfirmDialog'

function formatAmount(n) {
  return n.toLocaleString('ko-KR')
}

function Highlight({ text, query }) {
  if (!query || !text) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark className="search-highlight">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  )
}

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토']
function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  const mm = d.getMonth() + 1
  const dd = d.getDate()
  return `${mm}/${dd} ${DAY_NAMES[d.getDay()]}`
}

export default function TransactionList({ transactions, onDelete, onUpdate, assets = [], owners, categories = DEFAULT_CATEGORIES, onAddCategory, onRemoveCategory, search = '', scrollToId = null }) {
  const [editingId, setEditingId] = useState(null)
  const [swipedId, setSwipedId] = useState(null)
  const touchStartX = { current: 0 }
  const [editDate, setEditDate] = useState('')
  const [editType, setEditType] = useState('expense')
  const [editCategory, setEditCategory] = useState(categories.expense[0])
  const [editAmount, setEditAmount] = useState('')
  const [editOwner, setEditOwner] = useState(owners[0])
  const [editMemo, setEditMemo] = useState('')
  const [editLinkedAssetId, setEditLinkedAssetId] = useState('')
  const [saving, setSaving] = useState(false)
  const [showMore, setShowMore] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const itemRefs = useRef({})

  useEffect(() => {
    if (!scrollToId) return
    const el = itemRefs.current[scrollToId]
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [scrollToId])


  function startEdit(tx) {
    setEditingId(tx.id)
    setEditDate(tx.date)
    setEditType(tx.type)
    setEditCategory(tx.category)
    setEditAmount(tx.amount)
    setEditOwner(tx.owner || owners[0])
    setEditMemo(tx.memo ?? '')
    setEditLinkedAssetId(tx.linked_asset_id ? String(tx.linked_asset_id) : '')
    setShowMore(false)
  }

  function handleEditTypeChange(newType) {
    setEditType(newType)
    setEditCategory(categories[newType][0])
  }

  function handleEditOwnerChange(newOwner) {
    setEditOwner(newOwner)
    setEditLinkedAssetId('')
  }

  const editOwnerAssets = assets.filter((a) => a.owner === editOwner)

  async function handleSave(id) {
    if (!editAmount || Number(editAmount) <= 0) return
    setSaving(true)
    const ok = await onUpdate(id, {
      date: editDate,
      type: editType,
      category: editCategory,
      amount: Number(editAmount),
      owner: editOwner,
      memo: editMemo.trim() || null,
      linked_asset_id: editLinkedAssetId || null,
    })
    setSaving(false)
    if (ok) setEditingId(null)
  }

  if (transactions.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🌿</div>
        <div className="empty-state-title">아직 내역이 없어요</div>
        <div className="empty-state-desc">이번 달 첫 번째 내역을 추가해볼까요?</div>
      </div>
    )
  }

  const editingTx = editingId ? transactions.find((t) => t.id === editingId) : null

  // Group transactions by date
  const groups = []
  let lastDate = null
  transactions.forEach((tx) => {
    if (tx.date !== lastDate) {
      groups.push({ date: tx.date, items: [] })
      lastDate = tx.date
    }
    groups[groups.length - 1].items.push(tx)
  })

  return (
    <>
      {confirmDeleteId && (
        <ConfirmDialog
          message="이 내역을 삭제할까요?"
          onConfirm={() => { onDelete(confirmDeleteId); setConfirmDeleteId(null); setSwipedId(null) }}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
      {editingTx && (
        <Modal title="내역 수정" onClose={() => setEditingId(null)}>
          <div className="type-toggle">
            <button type="button" className={`income ${editType === 'income' ? 'active' : ''}`} onClick={() => handleEditTypeChange('income')}>수입</button>
            <button type="button" className={`expense ${editType === 'expense' ? 'active' : ''}`} onClick={() => handleEditTypeChange('expense')}>지출</button>
          </div>
          <div className="form-row">
            <label>날짜</label>
            <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
          </div>
          <div className="form-row">
            <label>카테고리</label>
            <CategorySelect
              value={editCategory}
              onChange={setEditCategory}
              options={categories[editType]}
              onAdd={(name) => onAddCategory(editType, name)}
              onRemove={(name) => onRemoveCategory(editType, name)}
            />
          </div>
          <div className="form-row">
            <label>금액</label>
            <input type="number" inputMode="numeric" min="1" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} />
          </div>
          <div className="form-row">
            <label>구분</label>
            <select value={editOwner} onChange={(e) => handleEditOwnerChange(e.target.value)}>
              {owners.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <button type="button" className="collapsible-toggle" style={{ marginBottom: 12 }} onClick={() => setShowMore((p) => !p)}>
            {showMore ? '추가 옵션 접기 ▲' : '연동 자산 · 메모 ▼'}
          </button>
          {showMore && (
            <>
              <div className="form-row">
                <label>연동될 자산 (선택)</label>
                <select value={editLinkedAssetId} onChange={(e) => setEditLinkedAssetId(e.target.value)}>
                  <option value="">선택 안함</option>
                  {editOwnerAssets.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.category} · {a.owner})</option>)}
                </select>
              </div>
              <div className="form-row">
                <label>메모 (선택)</label>
                <input type="text" value={editMemo} onChange={(e) => setEditMemo(e.target.value)} placeholder="메모" />
              </div>
            </>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button onClick={() => handleSave(editingId)} disabled={saving} className="submit-btn" style={{ flex: 1 }}>저장</button>
            <button onClick={() => setEditingId(null)} style={{ flex: 1, padding: 13, border: 'none', borderRadius: 999, background: '#fdeef3', color: '#b88a9c', fontSize: 15, fontWeight: 700, fontFamily: '"Jua", sans-serif', cursor: 'pointer' }}>취소</button>
          </div>
        </Modal>
      )}

      {groups.map(({ date, items }) => (
        <div key={date}>
          <div className="tx-date-header">{formatDate(date)}</div>
          {items.map((tx) => (
            <div
              className={`tx-item${swipedId === tx.id ? ' swiped' : ''}`}
              key={tx.id}
              ref={(el) => { itemRefs.current[tx.id] = el }}
              onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX }}
              onTouchEnd={(e) => {
                const delta = e.changedTouches[0].clientX - touchStartX.current
                if (delta < -60) setSwipedId(tx.id)
                else if (delta > 20) setSwipedId(null)
              }}
              onClick={() => { if (swipedId !== null) setSwipedId(null) }}
            >
              <div className="tx-inner">
                <div className="tx-info">
                  <span className="category"><Highlight text={tx.category} query={search} /></span>
                  <span className="meta">
                    {tx.owner ? tx.owner : ''}
                    {tx.memo ? <>{tx.owner ? ' · ' : ''}<Highlight text={tx.memo} query={search} /></> : ''}
                  </span>
                </div>
                <div className="tx-amount">
                  <span className={`amount ${tx.type}`}>
                    {tx.type === 'income' ? '+' : '-'}
                    {formatAmount(tx.amount)}원
                  </span>
                </div>
              </div>
              <span className="swipe-hint"><span/><span/><span/></span>
              <div className="tx-swipe-actions">
                <button className="swipe-btn edit" onClick={(e) => { e.stopPropagation(); setSwipedId(null); startEdit(tx) }}>✎</button>
                <button
                  className="swipe-btn delete"
                  onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(tx.id) }}
                >✕</button>
              </div>
            </div>
          ))}
        </div>
      ))}
    </>
  )
}
