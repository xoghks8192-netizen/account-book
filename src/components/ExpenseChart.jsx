import { useState } from 'react'
import { getCategoryColor } from '../categories'
import Modal from './Modal'

const VISIBLE_COUNT = 5

function formatAmount(n) {
  return Number(n).toLocaleString('ko-KR')
}

export default function ExpenseChart({ transactions }) {
  const [showAll, setShowAll] = useState(false)
  const [showModal, setShowModal] = useState(false)

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
    <div className="asset-chart clickable" onClick={() => setShowModal(true)} style={{ cursor: 'pointer' }}>
      {showModal && (
        <Modal title="이번 달 지출 요약" onClose={(e) => { e?.stopPropagation?.(); setShowModal(false) }}>
          {data.map(([category, amount]) => (
            <div key={category} className="modal-row">
              <span className="modal-row-name" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: getCategoryColor(category), flexShrink: 0, display: 'inline-block' }} />
                {category}
              </span>
              <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
                <span className="modal-row-amount">-{formatAmount(amount)}원</span>
                <span style={{ fontSize: 11, color: 'var(--icon-muted)' }}>{((amount / total) * 100).toFixed(1)}%</span>
              </span>
            </div>
          ))}
          <div className="modal-total-row">
            <span>합계</span>
            <span className="modal-row-amount">-{formatAmount(total)}원</span>
          </div>
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
