import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { CATEGORIES } from '../categories'
import { OWNERS } from '../assetMeta'

function formatAmount(n) {
  return Number(n).toLocaleString('ko-KR')
}

const UNDO_TIMEOUT = 8000

export default function RecurringTemplates({ onQuickAdd, onUndo, currentUser, assets = [] }) {
  const [templates, setTemplates] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState('expense')
  const [category, setCategory] = useState(CATEGORIES.expense[0])
  const [amount, setAmount] = useState('')
  const [memo, setMemo] = useState('')
  const [author, setAuthor] = useState(currentUser || OWNERS[0])
  const [adding, setAdding] = useState(null)
  const [lastAdded, setLastAdded] = useState({})
  const [ownerFilter, setOwnerFilter] = useState('전체')
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editType, setEditType] = useState('expense')
  const [editCategory, setEditCategory] = useState(CATEGORIES.expense[0])
  const [editAmount, setEditAmount] = useState('')
  const [editMemo, setEditMemo] = useState('')
  const [editAuthor, setEditAuthor] = useState(currentUser || OWNERS[0])
  const [linkedAssetId, setLinkedAssetId] = useState('')
  const [editLinkedAssetId, setEditLinkedAssetId] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data, error } = await supabase.from('recurring_templates').select('*').order('id')
      if (cancelled) return
      if (!error) setTemplates(data)
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

  async function handleCreate(e) {
    e.preventDefault()
    if (!name.trim() || !amount) return
    const { data, error } = await supabase
      .from('recurring_templates')
      .insert({
        name: name.trim(),
        type,
        category,
        amount: Number(amount),
        memo: memo.trim() || null,
        author,
        linked_asset_id: linkedAssetId || null,
      })
      .select()
      .single()
    if (!error) {
      setTemplates((prev) => [...prev, data])
      setName('')
      setAmount('')
      setMemo('')
      setLinkedAssetId('')
      setShowForm(false)
    }
  }

  async function handleDelete(id) {
    await supabase.from('recurring_templates').delete().eq('id', id)
    setTemplates((prev) => prev.filter((t) => t.id !== id))
  }

  function startEdit(t) {
    setEditingId(t.id)
    setEditName(t.name)
    setEditType(t.type)
    setEditCategory(t.category)
    setEditAmount(t.amount)
    setEditMemo(t.memo ?? '')
    setEditAuthor(t.author || OWNERS[0])
    setEditLinkedAssetId(t.linked_asset_id ? String(t.linked_asset_id) : '')
  }

  function handleEditTypeChange(newType) {
    setEditType(newType)
    setEditCategory(CATEGORIES[newType][0])
  }

  async function handleUpdate(id) {
    if (!editName.trim() || !editAmount) return
    const { data, error } = await supabase
      .from('recurring_templates')
      .update({
        name: editName.trim(),
        type: editType,
        category: editCategory,
        amount: Number(editAmount),
        memo: editMemo.trim() || null,
        author: editAuthor,
        linked_asset_id: editLinkedAssetId || null,
      })
      .eq('id', id)
      .select()
      .single()
    if (!error) {
      setTemplates((prev) => prev.map((t) => (t.id === id ? data : t)))
      setEditingId(null)
    }
  }

  async function handleQuickAdd(template) {
    setAdding(template.id)
    const added = await onQuickAdd(template)
    setAdding(null)
    if (added) {
      setLastAdded((prev) => ({ ...prev, [template.id]: added.id }))
      setTimeout(() => {
        setLastAdded((prev) => {
          const next = { ...prev }
          if (next[template.id] === added.id) delete next[template.id]
          return next
        })
      }, UNDO_TIMEOUT)
    }
  }

  async function handleUndo(templateId) {
    const txId = lastAdded[templateId]
    if (!txId) return
    await onUndo(txId)
    setLastAdded((prev) => {
      const next = { ...prev }
      delete next[templateId]
      return next
    })
  }

  const visibleTemplates =
    ownerFilter === '전체' ? templates : templates.filter((t) => t.author === ownerFilter)

  return (
    <div className="form">
      <h3>고정 지출/수입</h3>

      <div className="owner-tabs" style={{ padding: '0 0 12px', margin: 0 }}>
        {['전체', ...OWNERS].map((o) => (
          <button key={o} className={ownerFilter === o ? 'active' : ''} onClick={() => setOwnerFilter(o)}>
            {o}
          </button>
        ))}
      </div>

      {visibleTemplates.length === 0 && !showForm && <div className="empty">등록된 항목이 없습니다.</div>}

      {visibleTemplates.map((t) =>
        editingId === t.id ? (
          <div className="tx-item asset-edit" key={t.id}>
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
              <label>이름</label>
              <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} />
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
              <select value={editAuthor} onChange={(e) => setEditAuthor(e.target.value)}>
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
              <button onClick={() => handleUpdate(t.id)} className="submit-btn" style={{ flex: 1 }}>
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
          <div className="tx-item" key={t.id}>
            <div className="tx-info">
              <span className="category">{t.name}</span>
              <span className="meta">
                {t.category}
                {t.author ? ` · ${t.author}` : ''} ·{' '}
                <span className={t.type === 'income' ? 'amount income' : 'amount expense'}>
                  {t.type === 'income' ? '+' : '-'}
                  {formatAmount(t.amount)}원
                </span>
              </span>
            </div>
            <div className="tx-amount">
              {lastAdded[t.id] ? (
                <button
                  onClick={() => handleUndo(t.id)}
                  className="submit-btn"
                  style={{
                    width: 'auto',
                    padding: '6px 14px',
                    fontSize: 13,
                    margin: 0,
                    background: '#fdeef3',
                    color: '#ff8fab',
                    boxShadow: 'none',
                  }}
                >
                  되돌리기
                </button>
              ) : (
                <button
                  onClick={() => handleQuickAdd(t)}
                  disabled={adding === t.id}
                  className="submit-btn"
                  style={{ width: 'auto', padding: '6px 14px', fontSize: 13, margin: 0 }}
                >
                  {adding === t.id ? '추가 중...' : '오늘 추가'}
                </button>
              )}
              <button onClick={() => startEdit(t)} title="수정">
                ✎
              </button>
              <button
                onClick={() => {
                  if (window.confirm('이 항목을 삭제할까요?')) handleDelete(t.id)
                }}
                title="삭제"
              >
                ✕
              </button>
            </div>
          </div>
        ),
      )}

      {showForm ? (
        <div style={{ marginTop: 12 }}>
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
            <label>이름</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 월세" />
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
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="form-row">
            <label>구분</label>
            <select value={author} onChange={(e) => setAuthor(e.target.value)}>
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
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleCreate} className="submit-btn" style={{ flex: 1 }}>
              저장
            </button>
            <button
              onClick={() => setShowForm(false)}
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
        <button
          onClick={() => setShowForm(true)}
          className="submit-btn"
          style={{ marginTop: templates.length > 0 ? 8 : 0 }}
        >
          + 항목 추가
        </button>
      )}
    </div>
  )
}
