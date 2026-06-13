import { useState } from 'react'
import { CATEGORIES } from '../categories'
import { OWNERS } from '../assetMeta'

function todayStr() {
  const d = new Date()
  return d.toISOString().slice(0, 10)
}

export default function TransactionForm({ onAdd, currentUser }) {
  const [type, setType] = useState('expense')
  const [date, setDate] = useState(todayStr())
  const [category, setCategory] = useState(CATEGORIES.expense[0])
  const [amount, setAmount] = useState('')
  const [memo, setMemo] = useState('')
  const [owner, setOwner] = useState(currentUser || OWNERS[0])
  const [saving, setSaving] = useState(false)

  function handleTypeChange(newType) {
    setType(newType)
    setCategory(CATEGORIES[newType][0])
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!amount || Number(amount) <= 0) return
    setSaving(true)
    await onAdd({
      type,
      date,
      category,
      amount: Number(amount),
      memo: memo.trim() || null,
      owner,
    })
    setAmount('')
    setMemo('')
    setSaving(false)
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <h3>내역 추가</h3>
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
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORIES[type].map((c) => (
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
          placeholder="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
      </div>

      <div className="form-row">
        <label>구분</label>
        <select value={owner} onChange={(e) => setOwner(e.target.value)}>
          {OWNERS.map((o) => (
            <option key={o} value={o}>
              {o}
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
