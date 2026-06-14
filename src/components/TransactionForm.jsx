import { useState } from 'react'
import { DEFAULT_CATEGORIES } from '../categories'
import CategoryManager from './CategoryManager'

function todayStr() {
  const d = new Date()
  return d.toISOString().slice(0, 10)
}

export default function TransactionForm({ onAdd, currentUser, owners, assets = [], categories = DEFAULT_CATEGORIES, onAddCategory, onRemoveCategory }) {
  const [type, setType] = useState('expense')
  const [date, setDate] = useState(todayStr())
  const [category, setCategory] = useState(categories.expense[0])
  const [amount, setAmount] = useState('')
  const [memo, setMemo] = useState('')
  const [owner, setOwner] = useState(currentUser || owners[0])
  const [saving, setSaving] = useState(false)
  const [linkedAssetId, setLinkedAssetId] = useState('')
  const [showCategoryManager, setShowCategoryManager] = useState(false)

  function handleTypeChange(newType) {
    setType(newType)
    setCategory(categories[newType][0])
  }

  function handleOwnerChange(newOwner) {
    setOwner(newOwner)
    setLinkedAssetId('')
  }

  const ownerAssets = assets.filter((a) => a.owner === owner)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!amount || Number(amount) <= 0) return
    setSaving(true)
    const result = await onAdd({
      type,
      date,
      category,
      amount: Number(amount),
      memo: memo.trim() || null,
      owner,
      linked_asset_id: linkedAssetId || null,
    })
    setAmount('')
    setMemo('')
    setLinkedAssetId('')
    setSaving(false)
    if (result) {
      alert('추가 완료되었습니다.')
      window.location.reload()
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="type-toggle">
        <button
          type="button"
          className={`income ${type === 'income' ? 'active' : ''}`}
          onClick={() => handleTypeChange('income')}
        >
          수입
        </button>
        <button
          type="button"
          className={`expense ${type === 'expense' ? 'active' : ''}`}
          onClick={() => handleTypeChange('expense')}
        >
          지출
        </button>
      </div>

      <div className="form-row">
        <label>날짜</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
      </div>

      <div className="form-row">
        <label>카테고리</label>
        <div style={{ display: 'flex', gap: 6 }}>
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ flex: 1 }}>
            {categories[type].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setShowCategoryManager((prev) => !prev)}
            style={{
              flexShrink: 0,
              border: '1.5px solid #e8e3f7',
              borderRadius: 12,
              background: showCategoryManager ? '#b896ff' : '#fdeef3',
              color: showCategoryManager ? '#fff' : '#b88a9c',
              fontWeight: 600,
              fontSize: 13,
              padding: '0 12px',
              cursor: 'pointer',
            }}
          >
            수정
          </button>
        </div>
        {showCategoryManager && (
          <CategoryManager
            options={categories[type]}
            onAdd={(name) => onAddCategory(type, name)}
            onRemove={(name) => {
              onRemoveCategory(type, name)
              if (name === category) {
                setCategory(categories[type].find((c) => c !== name))
              }
            }}
          />
        )}
      </div>

      <div className="form-row">
        <label>금액</label>
        <input
          type="number"
          inputMode="numeric"
          min="1"
          placeholder="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
      </div>

      <div className="form-row">
        <label>구분</label>
        <select value={owner} onChange={(e) => handleOwnerChange(e.target.value)}>
          {owners.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>

      <div className="form-row">
        <label>연동될 자산 (선택)</label>
        <select value={linkedAssetId} onChange={(e) => setLinkedAssetId(e.target.value)}>
          <option value="">선택 안함</option>
          {ownerAssets.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.category} · {a.owner})
            </option>
          ))}
        </select>
      </div>

      <div className="form-row">
        <label>메모 (선택)</label>
        <input type="text" value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="메모" />
      </div>

      <button type="submit" className="submit-btn" disabled={saving}>
        {saving ? '저장 중...' : '추가하기'}
      </button>
    </form>
  )
}
