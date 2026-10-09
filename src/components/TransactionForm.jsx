import { usePrivacy } from '../lib/privacy'
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { DEFAULT_CATEGORIES, TRANSFER_CATEGORY } from '../categories'
import CategoryPicker from './CategoryPicker'
import { todayKst } from '../lib/dates'

function todayStr() {
  return todayKst()
}

const TransactionForm = forwardRef(function TransactionForm({ onAdd, onSuccess, currentUser, owners, assets = [], categories = DEFAULT_CATEGORIES, onAddCategory, onRemoveCategory, onMoveCategory, mutationState, onRetrySave, copyDraft, transactions = [] }, ref) {
  const moneyHidden=usePrivacy()
  const [type, setType] = useState('expense')
  const [date, setDate] = useState(todayStr())
  const [category, setCategory] = useState(categories.expense[0])
  const [amount, setAmount] = useState('')
  const [memo, setMemo] = useState('')
  const [owner, setOwner] = useState(currentUser || owners[0])
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const [saveError, setSaveError] = useState('')
  const [linkedAssetId, setLinkedAssetId] = useState('')
  const [showMore, setShowMore] = useState(false)
  const amountRef = useRef(null)
  useImperativeHandle(ref, () => ({
    focusAmount() {
      amountRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      amountRef.current?.focus()
    }
  }))
  const [transferToSpouse, setTransferToSpouse] = useState(false)
  useEffect(() => {
    if (!copyDraft) return
    setType(copyDraft.type); setDate(copyDraft.date); setCategory(copyDraft.category)
    setAmount(copyDraft.amount); setMemo(copyDraft.memo); setOwner(copyDraft.owner)
    setLinkedAssetId(copyDraft.linked_asset_id)
    setTransferToSpouse(copyDraft.category === TRANSFER_CATEGORY)
    setShowMore(!!copyDraft.memo || !!copyDraft.linked_asset_id)
    const timer = setTimeout(() => { amountRef.current?.scrollIntoView({ behavior:'smooth', block:'center' }); amountRef.current?.focus() }, 100)
    return () => clearTimeout(timer)
  }, [copyDraft])

  const partner = owners.find((o) => o !== '공동' && o !== owner)

  function handleTypeChange(newType) {
    setType(newType)
    setCategory(categories[newType][0])
    if (newType !== 'expense') setTransferToSpouse(false)
  }

  function handleOwnerChange(newOwner) {
    setOwner(newOwner)
    setLinkedAssetId('')
  }

  const ownerAssets = assets.filter((a) => a.owner === owner)

  async function handleSubmit(e) {
    e.preventDefault()
    if (savingRef.current) return
    if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) return
    savingRef.current = true
    setSaving(true)
    setSaveError('')
    try {
      const result = await onAdd({
      type,
      date,
      category,
      amount: Number(amount),
      memo: memo.trim() || null,
      owner,
      linked_asset_id: linkedAssetId || null,
    })
      if (!result) {
        setSaveError('')
        return
      }
      setAmount('')
      setMemo('')
      setLinkedAssetId('')
      setTransferToSpouse(false)
      onSuccess?.()
    } catch {
      setSaveError('저장 결과를 확인하지 못했어요. 내역에 추가되었는지 먼저 확인해주세요. 입력 내용은 유지돼요.')
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <fieldset className="transaction-fields" disabled={saving||['uncertain','checking','saving'].includes(mutationState?.status)}>
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
        <CategoryPicker value={category} options={categories[type]} type={type} transactions={transactions}
          onChange={setCategory}
          onAdd={(name) => onAddCategory(type, name)}
          onRemove={(name) => {
            onRemoveCategory(type, name)
            if (name === category) setCategory(categories[type].find(c => c !== name))
          }}
          onMove={(name, direction) => onMoveCategory(type, name, direction)}
        />
      </div>

      <div className="form-row">
        <label>금액</label>
        <input
          type="text"
          inputMode="numeric"
          placeholder="0"
          value={amount ? Number(amount).toLocaleString('ko-KR') : ''}
          onChange={(e) => {
            const raw = e.target.value.replace(/[^0-9]/g, '')
            setAmount(raw)
          }}
          required
          ref={amountRef}
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

      {type === 'expense' && partner && (
        <div className="form-row">
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, cursor: 'pointer', fontWeight: 600 }}>
            <input
              type="checkbox"
              checked={transferToSpouse}
              onChange={(e) => setTransferToSpouse(e.target.checked)}
              style={{ width: 'auto', flexShrink: 0, padding: 0 }}
            />
            <span>💸 {partner}님에게 보낸 돈</span>
          </label>
        </div>
      )}

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
        </>
      )}

      </fieldset>
      {saveError && <p role="alert" style={{ color: 'var(--expense-color)', fontSize: 13 }}>{saveError}</p>}
      {mutationState?.status==='failed'&&<p role="alert" className="utility-error">{mutationState.message} 입력 내용은 유지돼요.</p>}
      {mutationState?.status==='uncertain'&&<div className="problem-notice" role="status"><p>저장 결과를 확인하지 못했어요. 입력 내용은 유지돼요.</p><button type="button" onClick={onRetrySave}>같은 요청으로 다시 확인</button></div>}
      <button type="submit" className="submit-btn" disabled={saving||['uncertain','checking','saving'].includes(mutationState?.status)}>
        {saving ? '저장 중...' : '추가하기'}
      </button>
    </form>
  )
})

export default TransactionForm
