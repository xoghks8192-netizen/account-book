export function daysSince(dateStr) {
  const start = new Date(dateStr + 'T00:00:00')
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const diff = today - new Date(start.getFullYear(), start.getMonth(), start.getDate())
  return Math.floor(diff / (1000 * 60 * 60 * 24)) + 1
}
