function formatAmount(n) {
  return Math.abs(n).toLocaleString('ko-KR')
}

function DiffValue({ diff, invert }) {
  let cls = 'flat'
  if (diff > 0) cls = invert ? 'down' : 'up'
  if (diff < 0) cls = invert ? 'up' : 'down'
  const sign = diff > 0 ? '+' : diff < 0 ? '-' : '±'
  return (
    <div className={`diff ${cls}`}>
      {sign}
      {formatAmount(diff)}원
    </div>
  )
}

export default function MonthComparison({ current, previous }) {
  const incomeDiff = current.income - previous.income
  const expenseDiff = current.expense - previous.expense
  const balanceDiff = current.balance - previous.balance

  return (
    <div className="comparison">
      <div className="comparison-item">
        <div className="label">수입 (전월 대비)</div>
        <DiffValue diff={incomeDiff} />
      </div>
      <div className="comparison-item">
        <div className="label">지출 (전월 대비)</div>
        <DiffValue diff={expenseDiff} invert />
      </div>
      <div className="comparison-item">
        <div className="label">합계 (전월 대비)</div>
        <DiffValue diff={balanceDiff} />
      </div>
    </div>
  )
}
