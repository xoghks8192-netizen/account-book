export function joinDetails(...parts) {
  return parts.map(v => String(v ?? '').trim()).filter(Boolean).join(' · ')
}

export function formatLedgerDate(value, includeYear = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return ''
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(`${value}T00:00:00Z`)
  if (!Number.isFinite(date.getTime()) || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) return ''
  return `${includeYear ? `${year}년 ` : ''}${month}월 ${day}일 (${'일월화수목금토'[date.getUTCDay()]})`
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
