export function isTransfer(row) { return !!row.transfer_id || row.category === '배우자 이체' }

export function summarizeResults(rows) {
  return rows.reduce((sum, row) => {
    const amount = Number(row.amount) || 0
    const transfer = isTransfer(row)
    const key = transfer ? (row.type === 'income' ? 'received' : 'sent') : (row.type === 'income' ? 'income' : 'expense')
    sum[key] += amount
    sum.count++
    return sum
  }, { count: 0, income: 0, expense: 0, received: 0, sent: 0 })
}

export function copyTransaction(row, owners, assets) {
  if ((row.transfer_id || row.category === '배우자 이체') && row.type === 'income') {
    throw new Error('받은 이체 대신 보낸 사람의 이체 내역에서 복사해주세요.')
  }
  if (!owners.includes(row.owner)) throw new Error('현재 가구의 소유자를 확인해주세요.')
  return {
    type: row.type, date: row.date, category: row.category, amount: String(row.amount),
    memo: row.memo || '', owner: row.owner,
    linked_asset_id: assets.some(a => String(a.id) === String(row.linked_asset_id) && a.owner === row.owner && !a.deleted_at) ? String(row.linked_asset_id) : '',
  }
}

export function backupStorageKey(household, username) {
  return `hb-last-export:${household}:${username}`
}

export function formatExportTime(value) {
  if (!value || !Number.isFinite(Date.parse(value))) return '기록 없음'
  return new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value))
}
