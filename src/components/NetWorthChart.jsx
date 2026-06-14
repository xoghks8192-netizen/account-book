import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

function formatAmount(n) {
  return Number(n).toLocaleString('ko-KR')
}

function formatMonth(key) {
  const [, m] = key.split('-')
  return `${Number(m)}월`
}

export default function NetWorthChart({ householdId }) {
  const [snapshots, setSnapshots] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!householdId) return
    let cancelled = false
    async function load() {
      setLoading(true)
      const { data, error } = await supabase
        .from('net_worth_snapshots')
        .select('snapshot_date, total')
        .eq('household_id', householdId)
        .order('snapshot_date', { ascending: true })
      if (cancelled) return
      if (!error) setSnapshots(data || [])
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [householdId])

  if (loading) return null

  const byMonth = {}
  for (const s of snapshots) {
    byMonth[s.snapshot_date.slice(0, 7)] = Number(s.total)
  }
  const monthly = Object.keys(byMonth)
    .sort()
    .map((month) => ({ month, total: byMonth[month] }))

  if (monthly.length < 2) return null

  const values = monthly.map((m) => m.total)
  const max = Math.max(...values)
  const min = Math.min(...values)
  const range = max - min || 1

  const width = 300
  const height = 110
  const padding = 14

  const points = monthly.map((m, i) => {
    const x = padding + (i / (monthly.length - 1)) * (width - padding * 2)
    const y = padding + (1 - (m.total - min) / range) * (height - padding * 2)
    return { x, y, ...m }
  })

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

  return (
    <div className="form">
      <h3>📈 순자산 변화 (월별)</h3>
      <svg viewBox={`0 0 ${width} ${height + 22}`} style={{ width: '100%', height: 'auto' }}>
        <path d={path} fill="none" stroke="var(--balance-color)" strokeWidth="2" />
        {points.map((p) => (
          <g key={p.month}>
            <circle cx={p.x} cy={p.y} r="3" fill="var(--balance-color)" />
            <text x={p.x} y={height + 16} textAnchor="middle" fontSize="10" fill="var(--meta-text)">
              {formatMonth(p.month)}
            </text>
          </g>
        ))}
      </svg>
      <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--label-text)', marginTop: 4 }}>
        최근 순자산: {formatAmount(values[values.length - 1])}원
      </div>
    </div>
  )
}
