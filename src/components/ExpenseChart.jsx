import { EXPENSE_CATEGORY_COLORS } from '../categories'

function formatAmount(n) {
  return Number(n).toLocaleString('ko-KR')
}

export default function ExpenseChart({ transactions }) {
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
    const color = EXPENSE_CATEGORY_COLORS[category] || '#e0c3cf'
    return `${color} ${from}deg ${to}deg`
  })

  return (
    <div className="asset-chart">
      <div className="donut" style={{ background: `conic-gradient(${stops.join(', ')})` }}>
        <div className="donut-hole">
          <span className="donut-label">이번 달 지출</span>
          <span className="donut-value">{formatAmount(total)}원</span>
        </div>
      </div>
      <div className="legend">
        {data.map(([category, amount]) => (
          <div className="legend-item" key={category}>
            <span className="dot" style={{ background: EXPENSE_CATEGORY_COLORS[category] || '#e0c3cf' }} />
            <span className="legend-category">{category}</span>
            <span className="legend-percent">{((amount / total) * 100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}
