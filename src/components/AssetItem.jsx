import { useState } from 'react'
import { STOCK_CATEGORIES, LIQUIDITY_OPTIONS, defaultLiquidity } from '../assetMeta'

function formatAmount(n) {
  return Number(n).toLocaleString('ko-KR')
}

export default function AssetItem({ asset, owners, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(asset.name)
  const [owner, setOwner] = useState(asset.owner)
  const [liquidity, setLiquidity] = useState(asset.liquidity ?? defaultLiquidity(asset.category))
  const [memo, setMemo] = useState(asset.memo ?? '')
  const [amount, setAmount] = useState(asset.amount)
  const [shares, setShares] = useState(asset.shares ?? '')
  const [avgPrice, setAvgPrice] = useState(asset.avg_price ?? '')
  const [currentPrice, setCurrentPrice] = useState(asset.current_price ?? '')
  const [ticker, setTicker] = useState(asset.ticker ?? '')
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState('')

  const isStock = STOCK_CATEGORIES.includes(asset.category) && asset.shares != null

  function handleCancel() {
    setName(asset.name)
    setOwner(asset.owner)
    setLiquidity(asset.liquidity ?? defaultLiquidity(asset.category))
    setMemo(asset.memo ?? '')
    setAmount(asset.amount)
    setShares(asset.shares ?? '')
    setAvgPrice(asset.avg_price ?? '')
    setCurrentPrice(asset.current_price ?? '')
    setTicker(asset.ticker ?? '')
    setEditing(false)
  }

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    if (isStock) {
      if (shares === '' || avgPrice === '' || currentPrice === '') {
        setSaving(false)
        return
      }
      await onUpdate(asset.id, {
        name: name.trim(),
        owner,
        liquidity,
        memo: memo.trim() || null,
        amount: Number(shares) * Number(currentPrice),
        shares: Number(shares),
        avg_price: Number(avgPrice),
        current_price: Number(currentPrice),
        ticker: ticker.trim() || null,
      })
    } else {
      if (amount === '' || Number(amount) < 0) {
        setSaving(false)
        return
      }
      await onUpdate(asset.id, {
        name: name.trim(),
        owner,
        liquidity,
        memo: memo.trim() || null,
        amount: Number(amount),
      })
    }
    setSaving(false)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="tx-item asset-edit">
        <div className="form-row">
          <label>이름</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
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
        {isStock ? (
          <>
            <div className="form-row">
              <label>보유 수량 (주)</label>
              <input type="number" value={shares} onChange={(e) => setShares(e.target.value)} />
            </div>
            <div className="form-row">
              <label>평단가 (원)</label>
              <input type="number" value={avgPrice} onChange={(e) => setAvgPrice(e.target.value)} />
            </div>
            <div className="form-row">
              <label>종목코드 (선택, 시세 자동조회용)</label>
              <input
                type="text"
                value={ticker}
                onChange={(e) => setTicker(e.target.value)}
                placeholder="예: 069500"
              />
            </div>
            {ticker.trim() ? (
              <div className="form-row">
                <label>현재가 (원) · 🔄 새로고침으로 자동 갱신됩니다</label>
                <input type="number" value={currentPrice} disabled style={{ opacity: 0.6 }} />
              </div>
            ) : (
              <div className="form-row">
                <label>현재가 (원)</label>
                <input type="number" value={currentPrice} onChange={(e) => setCurrentPrice(e.target.value)} />
              </div>
            )}
          </>
        ) : (
          <div className="form-row">
            <label>금액</label>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
        )}
        <div className="form-row">
          <label>메모 (선택)</label>
          <input type="text" value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="메모" />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleSave} disabled={saving} className="submit-btn" style={{ flex: 1 }}>
            저장
          </button>
          <button
            onClick={handleCancel}
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
    )
  }

  if (isStock) {
    const buyAmount = asset.shares * asset.avg_price
    const profit = asset.amount - buyAmount
    const profitRate = buyAmount > 0 ? (profit / buyAmount) * 100 : 0

    async function handleRefreshPrice() {
      if (!asset.ticker) return
      setRefreshing(true)
      setRefreshError('')
      try {
        const res = await fetch(`/api/stock-price?code=${encodeURIComponent(asset.ticker)}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || '시세 조회에 실패했습니다.')
        await onUpdate(asset.id, {
          current_price: data.price,
          amount: Number(asset.shares) * data.price,
        })
      } catch (e) {
        setRefreshError(e.message)
      }
      setRefreshing(false)
    }

    return (
      <div className="tx-item">
        <div className="tx-info">
          <span className="category">{asset.name}</span>
          <span className="meta">
            {asset.owner} · {formatAmount(asset.shares)}주 · 평단 {formatAmount(asset.avg_price)} · 현재{' '}
            {formatAmount(asset.current_price)}
          </span>
          {refreshError && <span className="meta" style={{ color: '#ff7aa2' }}>{refreshError}</span>}
        </div>
        <div className="tx-amount">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <span className="amount">{formatAmount(asset.amount)}원</span>
            <span style={{ fontSize: 11, color: profit >= 0 ? '#ff5c5c' : '#6cb6ff', fontWeight: 700 }}>
              {profit >= 0 ? '+' : ''}
              {formatAmount(profit)} ({profitRate.toFixed(1)}%)
            </span>
          </div>
          {asset.ticker && (
            <button onClick={handleRefreshPrice} disabled={refreshing} title="시세 새로고침">
              {refreshing ? '⏳' : '🔄'}
            </button>
          )}
          <button onClick={() => setEditing(true)} title="수정">
            ✎
          </button>
          <button
            onClick={() => {
              if (window.confirm('이 자산을 삭제할까요?')) onDelete(asset.id)
            }}
            title="삭제"
          >
            ✕
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="tx-item">
      <div className="tx-info">
        <span className="category">{asset.name}</span>
        <span className="meta">
          {asset.owner}
          {asset.memo ? ` · ${asset.memo}` : ''}
        </span>
      </div>
      <div className="tx-amount">
        <span className="amount">{formatAmount(asset.amount)}원</span>
        <button onClick={() => setEditing(true)} title="수정">
          ✎
        </button>
        <button
          onClick={() => {
            if (window.confirm('이 자산을 삭제할까요?')) onDelete(asset.id)
          }}
          title="삭제"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
