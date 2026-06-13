import { useState } from 'react'
import { CATEGORIES } from '../categories'
import { OWNERS } from '../assetMeta'

function formatAmount(n) {
  return n.toLocaleString('ko-KR')
}

export default function TransactionList({ transactions, onDelete, onUpdate, assets = [] }) {
  const [editingId, setEditingId] = useState(null)
  const [editDate, setEditDate] = useState('')
  const [editType, setEditType] = useState('expense')
  const [editCategory, setEditCategory] = useState(CATEGORIES.expense[0])
  const [editAmount, setEditAmount] = useState('')
  const [editOwner, setEditOwner] = useState(OWNERS[0])
  const [editMemo, setEditMemo] = useState('')
  const [editLinkedAssetId, setEditLinkedAssetId] = useState('')
  const [saving, setSaving] = useState(false)

  function startEdit(tx) {
    setEditingId(tx.id)
    setEditDate(tx.date)
    setEditType(tx.type)
    setEditCategory(tx.category)
    setEditAmount(tx.amount)
    setEditOwner(tx.owner || OWNERS[0])
    setEditMemo(tx.memo ?? '')
    setEditLinkedAssetId(tx.linked_asset_id ? String(tx.linked_asset_id) : '')
  }

  function handleEditTypeChange(newType) {
    setEditType(newType)
    setEditCategory(CATEGORIES[newType][0])
  }

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
              <select value={editCategory} onChange={(e) => setEditCategory(e.target.value)}>
                {CATEGORIES[editType].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
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
              <select value={editOwner} onChange={(e) => setEditOwner(e.target.value)}>
                {OWNERS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label>연동될 자산 (선택)</label>
              <select value={editLinkedAssetId} onChange={(e) => setEditLinkedAssetId(e.target.value)}>
                <option value="">선택 안함</option>
                {assets.map((a) => (
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
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => handleSave(tx.id)} disabled={saving} className="submit-btn" style={{ flex: 1 }}>
                저장
              </button>
              <button
                onClick={() => setEditingId(null)}
                style={{
                  flex: 1,
                  border: 'none',
                  borderRadius: 999,
                  background: '#fdeef3',
                  color: '#b88a9c',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                취소
              </button>
            </div>
          </div>
        ) : (
          <div className="tx-item" key={tx.id}>
            <div className="tx-info">
              <span className="category">{tx.category}</span>
              <span className="meta">
                {tx.date}
                {tx.owner ? ` · ${tx.owner}` : ''}
                {tx.memo ? ` · ${tx.memo}` : ''}
              </span>
            </div>
            <div className="tx-amount">
              <span className={`amount ${tx.type}`}>
                {tx.type === 'income' ? '+' : '-'}
                {formatAmount(tx.amount)}원
              </span>
              <button onClick={() => startEdit(tx)} title="수정">
                ✎
              </button>
              <button
                onClick={() => {
                  if (window.confirm('이 내역을 삭제할까요?')) onDelete(tx.id)
                }}
                title="삭제"
              >
                ✕
              </button>
            </div>
          </div>
        ),
      )}
    </>
  )
}
