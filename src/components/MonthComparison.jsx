import { useMoney } from '../lib/privacy'

function DiffValue({ diff, invert }) {
  const formatAmount=useMoney()
  let cls = 'flat'
  if (diff > 0) cls = invert ? 'down' : 'up'
  if (diff < 0) cls = invert ? 'up' : 'down'
  const sign = diff > 0 ? '+' : diff < 0 ? '-' : '±'
  return (
    <div className={`diff ${cls}`}>
      {sign}
      {formatAmount(Math.abs(diff))}원
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
        <div className="label">수입</div>
        <DiffValue diff={incomeDiff} invert />
      </div>
      <div className="comparison-item">
        <div className="label">지출</div>
        <DiffValue diff={expenseDiff} />
      </div>
      <div className="comparison-item">
        <div className="label">합계</div>
        <DiffValue diff={balanceDiff} invert />
      </div>
    </div>
  )
}
