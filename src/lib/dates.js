// Ledger dates are Korean calendar dates, not UTC timestamps.
export function todayKst(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now)
  const value = (type) => parts.find((part) => part.type === type).value
  return `${value('year')}-${value('month')}-${value('day')}`
}

export function currentMonth(now = new Date()) {
  const [year, month] = todayKst(now).split('-').map(Number)
  return { year, month: month - 1 }
}

export function monthRange(year, month) {
  const monthStart = (offset) => {
    const date = new Date(Date.UTC(year, offset, 1))
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-01`
  }
  return { start: monthStart(month), end: monthStart(month + 1) }
}
