import { useMoney, usePrivacy } from '../lib/privacy'
import { useEffect, useRef, useState } from 'react'
import { DEFAULT_CATEGORIES, getCategoryEmoji } from '../categories'
import CategorySelect from './CategorySelect'
import Modal from './Modal'
import EditActions from './EditActions'
import AmountHint from './AmountHint'
import ExpandableText from './ExpandableText'
import { joinDetails, formatLedgerDate } from '../lib/displayText'
import ConfirmDialog from './ConfirmDialog'
import TransferDetails from './TransferDetails'
import { summarizeResults } from '../lib/ledgerView'


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

const formatDate = formatLedgerDate

export default function TransactionList({ transactions, onDelete, onUpdate, onCopy, filtered = false, assets = [], owners, categories = DEFAULT_CATEGORIES, onAddCategory, onRemoveCategory, search = '', scrollToId = null, editOnClick = false }) {
  const moneyHidden=usePrivacy()
  const formatAmount = useMoney()
  const [editingId, setEditingId] = useState(null)
  const [transferDetails,setTransferDetails] = useState(null)
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
  const [collapsedDates, setCollapsedDates] = useState(new Set())
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
<EmptyState message={<>{filtered ? '조건에 맞는 내역이 없어요' : '아직 내역이 없어요'}</>} />
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

  function toggleDate(date) {
    setCollapsedDates((prev) => {
      const next = new Set(prev)
      next.has(date) ? next.delete(date) : next.add(date)
      return next
    })
  }

  return (
    <>
      {transferDetails&&<TransferDetails transaction={transferDetails} onClose={()=>setTransferDetails(null)}/>}
      {confirmDeleteId && (
        <ConfirmDialog
          message={transactions.find(t => t.id === confirmDeleteId)?.transfer_id
            ? '이체를 삭제하면 배우자 쪽 내역도 함께 삭제됩니다. 삭제할까요?'
            : '이 내역을 삭제할까요?'}
          onConfirm={() => { onDelete(confirmDeleteId); setConfirmDeleteId(null); setSwipedId(null) }}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
      {editingTx && (
<Modal title="내역 수정" onClose={() => setEditingId(null)} busy={saving} dirty={
          editDate !== editingTx.date || editType !== editingTx.type || editCategory !== editingTx.category ||
          Number(editAmount) !== Number(editingTx.amount) || editOwner !== editingTx.owner ||
          editMemo !== (editingTx.memo ?? '') || String(editLinkedAssetId) !== String(editingTx.linked_asset_id ?? '')
        } footer={
          <EditActions onSave={() => handleSave(editingId)} saving={saving} />
        }>
          {editingTx.transfer_id && <p style={{ color: 'var(--text-sub)', fontSize: 13 }}>연결된 이체입니다. 금액과 날짜는 배우자 내역에도 함께 반영됩니다. 구분·카테고리·소유자를 바꾸려면 삭제 후 다시 입력해주세요.</p>}
          {!editingTx.transfer_id && editingTx.category === '배우자 이체' && <p style={{ color: 'var(--text-sub)', fontSize: 13 }}>기존에 입력한 이체는 자동 연결되지 않습니다. 상대방 내역은 별도로 확인해주세요.</p>}
          <div className="type-toggle">
            <button type="button" className={`income ${editType === 'income' ? 'active' : ''}`} onClick={() => handleEditTypeChange('income')}>수입</button>
            <button type="button" className={`expense ${editType === 'expense' ? 'active' : ''}`} onClick={() => handleEditTypeChange('expense')}>지출</button>
          </div>
          <div className="form-row">
            <label>날짜</label>
            <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
            <div className="date-reading">{formatLedgerDate(editDate, true)}</div>
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
            <input type={moneyHidden ? "password" : "number"} inputMode="numeric" min="1" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} />
            <AmountHint value={editAmount} />
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

        </Modal>
      )}

      {groups.map(({ date, items }) => {
        const collapsed = collapsedDates.has(date)
        const daily = summarizeResults(items)
        const dayTotal = daily.income - daily.expense
        return (
        <div key={date} className="tx-date-group">
          <div className="tx-date-header" onClick={() => toggleDate(date)} style={{ cursor: 'pointer', userSelect: 'none' }}>
            <span>{formatDate(date)} <span className="date-count">· {items.length}건</span></span>
            <span className="tx-date-meta">
              <span className={`tx-date-total ${dayTotal >= 0 ? 'pos' : 'neg'}`}>{dayTotal >= 0 ? '+' : ''}{formatAmount(dayTotal)}원</span>
              <span className="tx-date-chevron">{collapsed ? '▸' : '▾'}</span>
            </span>
          </div>
          {!collapsed && items.map((tx) => (
            <div
              className={`tx-item${onCopy ? ' has-copy' : ''}${swipedId === tx.id ? ' swiped' : ''}`}
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
                  <span className="category">
                    <span className="cat-emoji" aria-hidden="true">{getCategoryEmoji(tx.category)}</span>
                    {editOnClick ? <button type="button" className="calendar-edit-entry" onClick={e => { e.stopPropagation(); startEdit(tx) }}>{tx.category} 수정</button> : <Highlight text={tx.category} query={search} />}
                    {(tx.transfer_id||tx.category==='배우자 이체')&&<button type="button" className="transfer-link" onClick={e=>{e.stopPropagation();setTransferDetails(tx)}}>연결 보기 ↗</button>}
                  </span>
                  <span className="meta">
                    <ExpandableText title="내역 상세" text={joinDetails(tx.owner, !moneyHidden && tx.memo ? tx.memo : '')}
                      details={[['날짜', formatLedgerDate(tx.date, true)], ['소유자', tx.owner], ['카테고리', tx.category], ['금액', formatAmount(tx.amount) + '원'], ['메모', !moneyHidden ? tx.memo : '']]}>
                      <Highlight text={joinDetails(tx.owner, !moneyHidden && tx.memo ? tx.memo : '')} query={search} />
                    </ExpandableText>
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
                {onCopy && <button className="swipe-btn copy" aria-label="내역 복사" title="내역 복사" onClick={e => { e.stopPropagation(); setSwipedId(null); onCopy(tx) }}>⧉</button>}
                <button className="swipe-btn edit" onClick={(e) => { e.stopPropagation(); setSwipedId(null); startEdit(tx) }}>✎</button>
                <button
                  className="swipe-btn delete"
                  onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(tx.id) }}
                >✕</button>
              </div>
            </div>
          ))}
        </div>
        )
      })}
    </>
  )
}
import EmptyState from './EmptyState'
