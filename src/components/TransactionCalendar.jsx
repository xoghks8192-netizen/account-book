import { useEffect, useMemo, useState } from 'react'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

function formatAmount(n) {
  return n.toLocaleString('ko-KR')
}

function pad(n) {
  return String(n).padStart(2, '0')
}

export default function TransactionCalendar({ transactions, year, month, onDeleteDate, onChangeMonth }) {
  const [selectedDate, setSelectedDate] = useState(null)

  useEffect(() => {
    setSelectedDate(null)
  }, [year, month])

  const byDate = useMemo(() => {
    const map = {}
    for (const t of transactions) {
      if (!map[t.date]) map[t.date] = { income: 0, expense: 0, items: [] }
      if (t.type === 'income') map[t.date].income += Number(t.amount)
      else map[t.date].expense += Number(t.amount)
      map[t.date].items.push(t)
    }
    return map
  }, [transactions])

  const firstDay = new Date(year, month, 1).getDay()
  const lastDate = new Date(year, month + 1, 0).getDate()

  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= lastDate; d++) cells.push(d)

  const selected = selectedDate ? byDate[selectedDate] : null

  return (
    <div>
      {onChangeMonth && (
        <div className="month-nav" style={{ padding: '0 0 12px' }}>
          <button onClick={() => onChangeMonth(-1)}>‹</button>
          <h2>
            {year}년 {month + 1}월
          </h2>
          <button onClick={() => onChangeMonth(1)}>›</button>
        </div>
      )}
      <div className="calendar">
        {WEEKDAYS.map((w) => (
          <div key={w} className="calendar-weekday">
            {w}
          </div>
        ))}
        {cells.map((d, i) => {
          if (d === null) return <div key={`empty-${i}`} className="calendar-cell empty-cell" />
          const dateStr = `${year}-${pad(month + 1)}-${pad(d)}`
          const info = byDate[dateStr]
          const isSelected = selectedDate === dateStr
          return (
            <button
              key={dateStr}
              type="button"
              className={`calendar-cell${isSelected ? ' selected' : ''}${info ? ' has-tx' : ''}`}
              onClick={() => setSelectedDate(isSelected ? null : dateStr)}
            >
              <span className="calendar-date">{d}</span>
              {info && (
                <span className="calendar-amounts">
                  {info.income > 0 && <span className="calendar-income">+{formatAmount(info.income)}</span>}
                  {info.expense > 0 && <span className="calendar-expense">-{formatAmount(info.expense)}</span>}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {selectedDate && (
        <div className="calendar-detail">
          <div className="calendar-detail-title">{selectedDate}</div>
          {selected ? (
            selected.items.map((t) => (
              <div key={t.id} className="tx-item">
                <div className="tx-info">
                  <span className="category">{t.category}</span>
                  <span className="meta">
                    {t.owner ?? ''} · {t.memo ?? ''}
                  </span>
                </div>
                <div className="tx-amount">
                  <span className={`amount ${t.type}`}>
                    {t.type === 'income' ? '+' : '-'}
                    {formatAmount(Number(t.amount))}
                  </span>
                  {onDeleteDate && (
                    <button type="button" onClick={() => onDeleteDate(t.id)} title="삭제">
                      ✕
                    </button>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="empty">내역이 없습니다.</div>
          )}
        </div>
      )}
    </div>
  )
}
