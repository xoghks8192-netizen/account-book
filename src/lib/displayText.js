export function joinDetails(...parts) {
  return parts.map(v => String(v ?? '').trim()).filter(Boolean).join(' · ')
}

export function koreanWon(value) {
  const raw = String(value ?? '').replaceAll(',', '').trim()
  if (!/^\d+$/.test(raw)) return ''
  const n = Number(raw)
  if (!Number.isSafeInteger(n)) return ''
  if (n === 0) return '0원'
  let remaining = n
  const parts = []
  for (const [unit, label] of [[1e12, '조'], [1e8, '억'], [1e4, '만'], [1, '']]) {
    const count = Math.floor(remaining / unit)
    if (count) parts.push(`${count.toLocaleString('ko-KR')}${label}`)
    remaining %= unit
  }
  return `${parts.join(' ')} 원`
}
