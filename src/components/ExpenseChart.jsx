import { useState } from 'react'
import { getCategoryColor } from '../categories'
import Modal from './Modal'

const VISIBLE_COUNT = 5
const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토']

function formatAmount(n) {
  return Number(n).toLocaleString('ko-KR')
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${mm}.${dd} (${DAY_NAMES[d.getDay()]})`
}

export default function ExpenseChart({ transactions }) {
  const [showAll, setShowAll] = useState(false)
  const [detailCategory, setDetailCategory] = useState(null)

  const expenseByCategory = transactions
    .filter((t) => t.type === 'expense')
    .reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + Number(t.amount)
      return acc
    }, {})

  const total = Object.values(expenseByCategory).reduce((s, v) => s + v, 0)
  const data = Object.entries(expenseByCategory).sort((a, b) => b[1] - a[1])

  if (total <= 0) return null

  let acc = 0
  const stops = data.map(([category, amount]) => {
    const from = (acc / total) * 360
    acc += amount
    const to = (acc / total) * 360
    return `${getCategoryColor(category)} ${from}deg ${to}deg`
  })

  const visibleData = showAll ? data : data.slice(0, VISIBLE_COUNT)
  const hiddenCount = data.length - visibleData.length

  const detailTxs = detailCategory
    ? transactions.filter((t) => t.type === 'expense' && t.category === detailCategory).sort((a, b) => b.date.localeCompare(a.date))
    : []
  const detailTotal = detailTxs.reduce((s, t) => s + Number(t.amount), 0)

  return (
    <div className="asset-chart">
      {detailCategory && (
        <Modal title={`${detailCategory} 상세`} onClose={() => setDetailCategory(null)}>
          <div className="modal-section-title" style={{ marginBottom: 8 }}>
            총 {formatAmount(detailTotal)}원 · {((detailTotal / total) * 100).toFixed(1)}%
          </div>
          {detailTxs.map((t) => (
            <div key={t.id} className="modal-row">
              <span className="modal-row-name">
                {t.memo || t.category}
                <span className="modal-row-meta">{formatDate(t.date)}{t.owner ? ` · ${t.owner}` : ''}</span>
              </span>
              <span className="modal-row-amount">-{formatAmount(t.amount)}원</span>
            </div>
          ))}
        </Modal>
      )}
      <div className="donut" style={{ background: `conic-gradient(${stops.join(', ')})` }}>
        <div className="donut-hole">
          <span className="donut-label">이번 달 지출</span>
          <span className="donut-value">{formatAmount(total)}원</span>
        </div>
      </div>
      <div className="legend">
        {visibleData.map(([category, amount]) => (
          <div className="legend-item clickable" key={category} onClick={() => setDetailCategory(category)}>
            <span className="dot" style={{ background: getCategoryColor(category) }} />
            <span className="legend-category">{category}</span>
            <span className="legend-percent">{((amount / total) * 100).toFixed(1)}%</span>
          </div>
        ))}
        {hiddenCount > 0 && (
          <button type="button" className="collapsible-toggle" style={{ alignSelf: 'flex-start' }} onClick={() => setShowAll(true)}>
            +{hiddenCount}개 더보기 ▼
          </button>
        )}
        {showAll && data.length > VISIBLE_COUNT && (
          <button type="button" className="collapsible-toggle" style={{ alignSelf: 'flex-start' }} onClick={() => setShowAll(false)}>
            접기 ▲
          </button>
        )}
      </div>
    </div>
  )
}
