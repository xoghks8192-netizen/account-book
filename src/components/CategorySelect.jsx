const btnStyle = {
  flexShrink: 0,
  width: 36,
  border: '1.5px solid #e8e3f7',
  borderRadius: 12,
  background: '#fdeef3',
  color: '#b88a9c',
  fontWeight: 700,
  cursor: 'pointer',
  fontSize: 16,
}

export default function CategorySelect({ value, onChange, options, onAdd, onRemove }) {
  function handleAdd() {
    const input = window.prompt('추가할 카테고리 이름을 입력하세요')
    if (!input) return
    const name = input.trim()
    if (!name) return
    if (options.includes(name)) {
      onChange(name)
      return
    }
    onAdd(name)
    onChange(name)
  }

  function handleRemove() {
    if (options.length <= 1) {
      window.alert('카테고리가 최소 1개는 있어야 합니다.')
      return
    }
    if (!window.confirm(`'${value}' 카테고리를 삭제할까요?`)) return
    const remaining = options.filter((c) => c !== value)
    onRemove(value)
    onChange(remaining[0])
  }

  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={{ flex: 1 }}>
        {options.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <button type="button" onClick={handleAdd} title="카테고리 추가" style={btnStyle}>
        +
      </button>
      <button type="button" onClick={handleRemove} title="카테고리 삭제" style={btnStyle}>
        ✕
      </button>
    </div>
  )
}
