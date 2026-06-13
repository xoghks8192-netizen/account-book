import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { CATEGORIES } from '../categories'
import { OWNERS, STOCK_CATEGORIES } from '../assetMeta'

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
  const [assets, setAssets] = useState([])
  const [linkedAssetId, setLinkedAssetId] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data, error } = await supabase.from('assets').select('*').order('id', { ascending: true })
      if (!cancelled && !error) {
        setAssets(data.filter((a) => !STOCK_CATEGORIES.includes(a.category)))
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  function handleTypeChange(newType) {
    setType(newType)
    setCategory(CATEGORIES[newType][0])
  }

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
    })
    if (result && linkedAssetId) {
      const asset = assets.find((a) => String(a.id) === linkedAssetId)
      if (asset) {
        await supabase
          .from('assets')
          .update({ amount: Number(asset.amount) + Number(amount), updated_at: new Date().toISOString() })
          .eq('id', asset.id)
      }
    }
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
        <label>연동될 자산 (선택)</label>
        <select value={linkedAssetId} onChange={(e) => setLinkedAssetId(e.target.value)}>
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
        <input type="text" value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="메모" />
      </div>

      <button type="submit" className="submit-btn" disabled={saving}>
        {saving ? '저장 중...' : '추가하기'}
      </button>
    </form>
  )
}
