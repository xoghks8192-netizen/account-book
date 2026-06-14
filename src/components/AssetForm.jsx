import { useState } from 'react'
import { ASSET_CATEGORIES, STOCK_CATEGORIES, LIQUIDITY_OPTIONS, defaultLiquidity } from '../assetMeta'
import CategorySelect from './CategorySelect'

export default function AssetForm({ onAdd, owners, categories = ASSET_CATEGORIES, onAddCategory, onRemoveCategory }) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState(categories[0])
  const [owner, setOwner] = useState(owners[0])
  const [liquidity, setLiquidity] = useState(defaultLiquidity(categories[0]))
  const [amount, setAmount] = useState('')
  const [shares, setShares] = useState('')
  const [avgPrice, setAvgPrice] = useState('')
  const [currentPrice, setCurrentPrice] = useState('')
  const [memo, setMemo] = useState('')
  const [saving, setSaving] = useState(false)

  const isStock = STOCK_CATEGORIES.includes(category)

  function handleCategoryChange(newCategory) {
    setCategory(newCategory)
    setLiquidity(defaultLiquidity(newCategory))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return

    let payload
    if (isStock) {
      if (shares === '' || avgPrice === '' || currentPrice === '') return
      payload = {
        name: name.trim(),
        category,
        owner,
        liquidity,
        amount: Number(shares) * Number(currentPrice),
        shares: Number(shares),
        avg_price: Number(avgPrice),
        current_price: Number(currentPrice),
        memo: memo.trim() || null,
      }
    } else {
      if (amount === '') return
      payload = {
        name: name.trim(),
        category,
        owner,
        liquidity,
        amount: Number(amount),
        memo: memo.trim() || null,
      }
    }

    setSaving(true)
    await onAdd(payload)
    setName('')
    setAmount('')
    setShares('')
    setAvgPrice('')
    setCurrentPrice('')
    setMemo('')
    setSaving(false)
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-row">
        <label>이름</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="예: 신한 적금"
          required
        />
      </div>

      <div className="form-row">
        <label>분류</label>
        <CategorySelect
          value={category}
          onChange={handleCategoryChange}
          options={categories}
          onAdd={onAddCategory}
          onRemove={onRemoveCategory}
        />
      </div>

      <div className="form-row">
        <label>유동성</label>
        <select value={liquidity} onChange={(e) => setLiquidity(e.target.value)}>
          {LIQUIDITY_OPTIONS.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </div>

      <div className="form-row">
        <label>소유자</label>
        <select value={owner} onChange={(e) => setOwner(e.target.value)}>
          {owners.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>

      {isStock ? (
        <>
          <div className="form-row">
            <label>보유 수량 (주)</label>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              placeholder="0"
              value={shares}
              onChange={(e) => setShares(e.target.value)}
              required
            />
          </div>
          <div className="form-row">
            <label>평단가 (원)</label>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              placeholder="0"
              value={avgPrice}
              onChange={(e) => setAvgPrice(e.target.value)}
              required
            />
          </div>
          <div className="form-row">
            <label>현재가 (원)</label>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              placeholder="0"
              value={currentPrice}
              onChange={(e) => setCurrentPrice(e.target.value)}
              required
            />
          </div>
        </>
      ) : (
        <div className="form-row">
          <label>금액</label>
          <input
            type="number"
            inputMode="numeric"
            min="0"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>
      )}

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
