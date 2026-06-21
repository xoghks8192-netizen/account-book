import { useState } from 'react'
import { getCategoryColor, TRANSFER_CATEGORY } from '../categories'

const VISIBLE_COUNT = 5

function formatAmount(n) {
  return Number(n).toLocaleString('ko-KR')
}

export default function ExpenseChart({ transactions }) {
  const [showAll, setShowAll] = useState(false)
  const [mode, setMode] = useState('expense')

  const filtered = mode === 'expense'
    ? transactions.filter((t) => t.type === 'expense')
    : transactions.filter((t) => t.type === 'income' && t.category !== TRANSFER_CATEGORY)

  const byCategory = filtered.reduce((acc, t) => {
    acc[t.category] = (acc[t.category] || 0) + Number(t.amount)
    return acc
  }, {})

  const total = Object.values(byCategory).reduce((s, v) => s + v, 0)
  const data = Object.entries(byCategory).sort((a, b) => b[1] - a[1])

  if (total <= 0 && mode === 'expense') return null

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
    <div className="asset-chart">
      <div className="chart-mode-tabs">
        <button className={mode === 'expense' ? 'active' : ''} onClick={() => { setMode('expense'); setShowAll(false) }}>지출</button>
        <button className={mode === 'income' ? 'active' : ''} onClick={() => { setMode('income'); setShowAll(false) }}>수입</button>
      </div>
      {total <= 0 ? (
        <div className="empty-state" style={{ padding: '20px 0' }}>
          <div className="empty-state-icon">📊</div>
          <div className="empty-state-title">{mode === 'income' ? '수입' : '지출'} 내역이 없어요</div>
        </div>
      ) : (
        <>
          <div className="donut" style={{ background: `conic-gradient(${stops.join(', ')})` }}>
            <div className="donut-hole">
              <span className="donut-label">이번 달 {mode === 'income' ? '수입' : '지출'}</span>
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
        </>
      )}
    </div>
  )
}
