import { useMoney, usePrivacy } from '../lib/privacy'
import { useState } from 'react'
import { STOCK_CATEGORIES, LIQUIDITY_OPTIONS, defaultLiquidity } from '../assetMeta'
import Modal from './Modal'
import EditActions from './EditActions'
import HeaderIcon from './HeaderIcon'
import AmountHint from './AmountHint'
import ExpandableText from './ExpandableText'
import { joinDetails } from '../lib/displayText'
import ConfirmDialog from './ConfirmDialog'


export default function AssetItem({ asset, owners, onUpdate, onDelete }) {
  const moneyHidden=usePrivacy()
  const formatAmount = useMoney()
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
  const [confirmDelete, setConfirmDelete] = useState(false)
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
    let ok
    if (isStock) {
      if (shares === '' || avgPrice === '' || currentPrice === '') { setSaving(false); return }
      ok = await onUpdate(asset.id, {
        name: name.trim(), owner, liquidity, memo: memo.trim() || null,
        amount: Number(shares) * Number(currentPrice),
        shares: Number(shares), avg_price: Number(avgPrice),
        current_price: Number(currentPrice), ticker: ticker.trim() || null,
      })
    } else {
      if (amount === '' || Number(amount) < 0) { setSaving(false); return }
      ok = await onUpdate(asset.id, { name: name.trim(), owner, liquidity, memo: memo.trim() || null, amount: Number(amount) })
    }
    setSaving(false)
    if (ok !== false) setEditing(false)
  }

  async function handleRefreshPrice() {
    if (!asset.ticker) return
    setRefreshing(true)
    setRefreshError('')
    try {
      const res = await fetch(`/api/stock-price?code=${encodeURIComponent(asset.ticker)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '시세 조회에 실패했습니다.')
      await onUpdate(asset.id, { current_price: data.price, amount: Number(asset.shares) * data.price })
    } catch (e) {
      setRefreshError(e.message)
    }
    setRefreshing(false)
  }

  const isStockItem = STOCK_CATEGORIES.includes(asset.category) && asset.shares != null
  const buyAmount = isStockItem ? asset.shares * asset.avg_price : 0
  const profit = isStockItem ? asset.amount - buyAmount : 0
  const profitRate = isStockItem && buyAmount > 0 ? (profit / buyAmount) * 100 : 0

  return (
    <>
      {confirmDelete && (
        <ConfirmDialog
          message="이 자산을 삭제할까요?"
          onConfirm={() => { onDelete(asset.id); setConfirmDelete(false) }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
      {editing && (
<Modal title="자산 수정" onClose={handleCancel} busy={saving} dirty={
          name !== asset.name || owner !== asset.owner || liquidity !== (asset.liquidity ?? defaultLiquidity(asset.category)) ||
          memo !== (asset.memo ?? '') || Number(amount) !== Number(asset.amount) ||
          String(shares) !== String(asset.shares ?? '') || String(avgPrice) !== String(asset.avg_price ?? '') ||
          String(currentPrice) !== String(asset.current_price ?? '') || ticker !== (asset.ticker ?? '')
        } footer={
          <EditActions onSave={handleSave} saving={saving} />
        }>
          <div className="form-row">
            <label>이름</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="form-row">
            <label>소유자</label>
            <select value={owner} onChange={(e) => setOwner(e.target.value)}>
              {owners.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div className="form-row">
            <label>유동성</label>
            <select value={liquidity} onChange={(e) => setLiquidity(e.target.value)}>
              {LIQUIDITY_OPTIONS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          {isStock ? (
            <>
              <div className="form-row">
                <label>보유 수량 (주)</label>
                <input type={moneyHidden ? "password" : "number"} value={shares} onChange={(e) => setShares(e.target.value)} />
              </div>
              <div className="form-row">
                <label>평단가 (원)</label>
                <input type={moneyHidden ? "password" : "number"} value={avgPrice} onChange={(e) => setAvgPrice(e.target.value)} />
              </div>
              <div className="form-row">
                <label>종목코드 (선택)</label>
                <input type="text" value={ticker} onChange={(e) => setTicker(e.target.value)} placeholder="예: 069500" />
              </div>
              <div className="form-row">
                <label>현재가 (원)</label>
                <input type={moneyHidden ? "password" : "number"} value={currentPrice} onChange={(e) => setCurrentPrice(e.target.value)} disabled={!!ticker.trim()} style={ticker.trim() ? { opacity: 0.6 } : {}} />
              </div>
            </>
          ) : (
            <>
              <div className="form-row">
                <label>금액</label>
                <input type={moneyHidden ? "password" : "number"} inputMode="numeric" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
                <AmountHint value={amount} />
              </div>
              {amount !== '' && Number(amount) !== asset.amount && (
                <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, color: Number(amount) > asset.amount ? '#ff5c5c' : '#6cb6ff', marginBottom: 8 }}>
                  {Number(amount) > asset.amount ? '+' : ''}{formatAmount(Number(amount) - asset.amount)}원
                </div>
              )}
            </>
          )}
          <div className="form-row">
            <label>메모 (선택)</label>
            <input type="text" value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="메모" />
          </div>

        </Modal>
      )}

      <div className={`tx-item${isStockItem ? ' stock-asset-item' : ''}`}>
        <div className="tx-info">
          <span className="category"><ExpandableText title="자산 상세" text={asset.name} details={[
            ['자산명', asset.name], ['소유자', asset.owner], ['분류', asset.category], ['평가금액', formatAmount(asset.amount) + '원'],
            ['보유 수량', isStockItem ? formatAmount(asset.shares) + '주' : ''],
            ['평균 매입가', isStockItem ? formatAmount(asset.avg_price) + '원' : ''],
            ['현재가', isStockItem ? formatAmount(asset.current_price) + '원' : ''],
            ['메모', !moneyHidden ? asset.memo : ''],
          ]} /></span>
          <span className="meta">
            {isStockItem ? <span className="stock-owner-line"><span>{asset.owner}</span><span>{formatAmount(asset.shares)}주</span></span>
              : <ExpandableText title="자산 상세" text={joinDetails(asset.owner, asset.memo && !moneyHidden ? asset.memo : '')} />}
          </span>
          {refreshError && <span className="meta" style={{ color: '#ff7aa2' }}>{refreshError}</span>}
        </div>
        <div className="tx-amount">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <span className="amount" data-zero={Number(asset.amount) === 0}>{formatAmount(asset.amount)}원</span>
            {isStockItem && (
              <span className={`profit-badge ${moneyHidden || profit === 0 ? 'flat' : profit > 0 ? 'gain' : 'loss'}`}>
                {moneyHidden ? '' : profit > 0 ? '▲ +' : profit < 0 ? '▼ ' : '— '}{formatAmount(profit)}원 · {moneyHidden ? '••••' : `${profitRate > 0 ? '+' : ''}${profitRate.toFixed(1)}`}%
              </span>
            )}
          </div>
          {isStockItem && asset.ticker && (
            <button className="asset-action" onClick={handleRefreshPrice} disabled={refreshing} title="시세 새로고침" aria-label={refreshing ? '시세 확인 중' : '시세 새로고침'}>
              <span className={refreshing ? 'icon-spinning' : ''}><HeaderIcon name="refresh" /></span>
            </button>
          )}
          <button className="asset-action" onClick={() => { handleCancel(); setEditing(true) }} title="수정" aria-label="자산 수정"><HeaderIcon name="edit" /></button>
          <button className="asset-action" onClick={() => setConfirmDelete(true)} title="삭제" aria-label="자산 삭제"><HeaderIcon name="delete" /></button>
        </div>
        {isStockItem && <div className="stock-price-details">
          <div><span>평균 매입가</span><strong>{formatAmount(asset.avg_price)}원</strong></div>
          <div><span>현재가</span><strong>{formatAmount(asset.current_price)}원</strong></div>
          {asset.memo && !moneyHidden && <div className="stock-memo"><ExpandableText title="자산 메모" text={asset.memo} /></div>}
        </div>}
      </div>
    </>
  )
}
