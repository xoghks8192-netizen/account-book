import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Collapsible from './Collapsible'
import { TRANSFER_CATEGORY } from '../categories'

function formatAmount(n) {
  return Number(n).toLocaleString('ko-KR')
}

export default function MonthlyTrendChart({ householdId, ownerFilter, owners }) {
  const [data, setData] = useState([])
  const [hovered, setHovered] = useState(null)

  useEffect(() => {
    if (!householdId) return
    async function load() {
      const months = []
      const now = new Date()
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const start = d.toISOString().slice(0, 7) + '-01'
        const end = new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString().slice(0, 10)
        months.push({ label: `${d.getMonth() + 1}월`, start, end })
      }

      const { data: rows } = await supabase
        .from('transactions')
        .select('date, type, amount, owner')
        .eq('household_id', householdId)
        .gte('date', months[0].start)
        .lt('date', months[months.length - 1].end)

      if (!rows) return

      const result = months.map(({ label, start, end }) => {
        const filtered = rows.filter((r) => {
          if (r.date < start || r.date >= end) return false
          if (ownerFilter !== '전체' && r.owner !== ownerFilter) return false
          return true
        })
        const expense = filtered.filter((r) => r.type === 'expense').reduce((s, r) => s + Number(r.amount), 0)
        const income = filtered.filter((r) => r.type === 'income' && r.category !== TRANSFER_CATEGORY).reduce((s, r) => s + Number(r.amount), 0)
        return { label, expense, income }
      })
      setData(result)
    }
    load()
  }, [householdId, ownerFilter])

  if (!data.length) return null
  const maxVal = Math.max(...data.map((d) => Math.max(d.expense, d.income)), 1)
  const h = hovered !== null ? data[hovered] : null

  return (
    <Collapsible title="월별 추이">
      <div className="trend-chart">
        {data.map(({ label, expense, income }, i) => (
          <div
            key={label}
            className={`trend-col${hovered === i ? ' trend-col-active' : ''}`}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            onTouchStart={() => setHovered(i)}
            onTouchEnd={() => setTimeout(() => setHovered(null), 1500)}
          >
            <div className="trend-bars">
              <div className="trend-bar income" style={{ height: `${(income / maxVal) * 100}%` }} />
              <div className="trend-bar expense" style={{ height: `${(expense / maxVal) * 100}%` }} />
            </div>
            <div className="trend-label">{label}</div>
          </div>
        ))}
      </div>

      <div className={`trend-tooltip${h ? ' visible' : ''}`}>
        {h ? (
          <>
            <span className="trend-tooltip-month">{h.label}</span>
            <span className="trend-tooltip-income">수입 {formatAmount(h.income)}원</span>
            <span className="trend-tooltip-expense">지출 {formatAmount(h.expense)}원</span>
          </>
        ) : <span>&nbsp;</span>}
      </div>

      <div className="trend-legend">
        <span className="trend-legend-item income">수입</span>
        <span className="trend-legend-item expense">지출</span>
      </div>
    </Collapsible>
  )
}
