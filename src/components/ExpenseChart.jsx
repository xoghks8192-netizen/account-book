import { useState } from 'react'
import { getCategoryColor } from '../categories'

const VISIBLE_COUNT = 5

function formatAmount(n) {
  return Number(n).toLocaleString('ko-KR')
}

export default function ExpenseChart({ transactions, onOpen }) {
  const [showAll, setShowAll] = useState(false)

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

  return (
    <div className="asset-chart clickable" onClick={onOpen} style={{ cursor: onOpen ? 'pointer' : 'default' }}>
      <div className="donut" style={{ background: `conic-gradient(${stops.join(', ')})` }}>
        <div className="donut-hole">
          <span className="donut-label">이번 달 지출</span>
          <span className="donut-value">{formatAmount(total)}원</span>
        </div>
      </div>
      <div className="legend">
        {visibleData.map(([category, amount]) => (
          <div className="legend-item" key={category}>
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
