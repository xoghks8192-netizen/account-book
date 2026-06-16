import { useState } from 'react'
import { DEFAULT_CATEGORIES } from '../categories'
import CategorySelect from './CategorySelect'

function formatAmount(n) {
  return n.toLocaleString('ko-KR')
}

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토']
function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${mm}.${dd} (${DAY_NAMES[d.getDay()]})`
}

export default function TransactionList({ transactions, onDelete, onUpdate, assets = [], owners, categories = DEFAULT_CATEGORIES, onAddCategory, onRemoveCategory }) {
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
    return <div className="empty">이번 달 내역이 없습니다.</div>
  }

  return (
    <>
      {transactions.map((tx) =>
        editingId === tx.id ? (
          <div className="tx-item asset-edit" key={tx.id}>
            <div className="type-toggle">
              <button
                type="button"
                className={`income ${editType === 'income' ? 'active' : ''}`}
                onClick={() => handleEditTypeChange('income')}
              >
                수입
              </button>
              <button
                type="button"
                className={`expense ${editType === 'expense' ? 'active' : ''}`}
                onClick={() => handleEditTypeChange('expense')}
              >
                지출
              </button>
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
              <input
                type="number"
                inputMode="numeric"
                min="1"
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
              />
            </div>
            <div className="form-row">
              <label>구분</label>
              <select value={editOwner} onChange={(e) => handleEditOwnerChange(e.target.value)}>
                {owners.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className="collapsible-toggle"
              style={{ marginBottom: 12 }}
              onClick={() => setShowMore((prev) => !prev)}
            >
              {showMore ? '추가 옵션 접기 ▲' : '연동 자산 · 메모 ▼'}
            </button>

            {showMore && (
              <>
                <div className="form-row">
                  <label>연동될 자산 (선택)</label>
                  <select value={editLinkedAssetId} onChange={(e) => setEditLinkedAssetId(e.target.value)}>
                    <option value="">선택 안함</option>
                    {editOwnerAssets.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.category} · {a.owner})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-row">
                  <label>메모 (선택)</label>
                  <input type="text" value={editMemo} onChange={(e) => setEditMemo(e.target.value)} placeholder="메모" />
                </div>
              </>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => handleSave(tx.id)} disabled={saving} className="submit-btn" style={{ flex: 1 }}>
                저장
              </button>
              <button
                onClick={() => setEditingId(null)}
                style={{
                  flex: 1,
                  padding: 13,
                  border: 'none',
                  borderRadius: 999,
                  background: '#fdeef3',
                  color: '#b88a9c',
                  fontSize: 15,
                  fontWeight: 700,
                  fontFamily: '"Jua", sans-serif',
                  cursor: 'pointer',
                }}
              >
                취소
              </button>
            </div>
          </div>
        ) : (
          <div
            className={`tx-item${swipedId === tx.id ? ' swiped' : ''}`}
            key={tx.id}
            onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX }}
            onTouchEnd={(e) => {
              const delta = e.changedTouches[0].clientX - touchStartX.current
              if (delta < -60) setSwipedId(tx.id)
              else if (delta > 20) setSwipedId(null)
            }}
            onClick={() => { if (swipedId === tx.id) setSwipedId(null) }}
          >
            <div className="tx-inner">
              <div className="tx-info">
                <span className="category">{tx.category}</span>
                <span className="meta">
                  {formatDate(tx.date)}
                  {tx.owner ? ` · ${tx.owner}` : ''}
                  {tx.memo ? ` · ${tx.memo}` : ''}
                </span>
              </div>
              <div className="tx-amount">
                <span className={`amount ${tx.type}`}>
                  {tx.type === 'income' ? '+' : '-'}
                  {formatAmount(tx.amount)}원
                </span>
              </div>
            </div>
            <div className="tx-swipe-actions">
              <button className="swipe-btn edit" onClick={(e) => { e.stopPropagation(); setSwipedId(null); startEdit(tx) }}>✎</button>
              <button className="swipe-btn delete" onClick={(e) => { e.stopPropagation(); setSwipedId(null); if (window.confirm('이 내역을 삭제할까요?')) onDelete(tx.id) }}>✕</button>
            </div>
          </div>
        ),
      )}
    </>
  )
}
