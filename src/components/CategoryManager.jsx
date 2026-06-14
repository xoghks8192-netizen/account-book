import { useState } from 'react'

export default function CategoryManager({ options, onAdd, onRemove }) {
  const [newCategory, setNewCategory] = useState('')
  const [error, setError] = useState('')

  function handleAdd() {
    const name = newCategory.trim()
    if (!name) return
    if (options.includes(name)) {
      setError('이미 있는 카테고리입니다.')
      return
    }
    setError('')
    onAdd(name)
    setNewCategory('')
  }

  function handleRemove(name) {
    if (options.length <= 1) {
      window.alert('카테고리가 최소 1개는 있어야 합니다.')
      return
    }
    if (!window.confirm(`'${name}' 카테고리를 삭제할까요?`)) return
    setError('')
    onRemove(name)
  }

  return (
    <div style={{ marginTop: 8, padding: 12, borderRadius: 12, background: '#fbfaff', border: '1.5px solid #e8e3f7' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        {options.map((c) => (
          <span
            key={c}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              background: '#fdeef3',
              color: '#b88a9c',
              borderRadius: 999,
              padding: '4px 10px',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {c}
            <button
              type="button"
              onClick={() => handleRemove(c)}
              style={{ border: 'none', background: 'none', color: '#ff8fab', cursor: 'pointer', fontSize: 13, padding: 0, lineHeight: 1 }}
            >
              ✕
            </button>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          type="text"
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
          placeholder="새 카테고리"
          style={{ flex: 1 }}
        />
        <button type="button" onClick={handleAdd} className="submit-btn" style={{ width: 'auto', margin: 0, padding: '0 16px' }}>
          추가
        </button>
      </div>
      {error && <div style={{ color: '#ff8fab', fontSize: 13, marginTop: 6 }}>{error}</div>}
    </div>
  )
}
