import { useEffect, useState } from 'react'

const TABS = [
  { id: 'deposit12', label: '예금 12개월' },
  { id: 'deposit6',  label: '예금 6개월' },
  { id: 'saving12',  label: '적금 12개월' },
  { id: 'saving6',   label: '적금 6개월' },
]

function RateBar({ rate, max }) {
  return (
    <div className="rate-bar-bg">
      <div className="rate-bar-fill" style={{ width: `${Math.min((rate / max) * 100, 100)}%` }} />
    </div>
  )
}

export default function SavingsRates() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState('deposit12')

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/savings-rates')
      if (!res.ok) throw new Error('데이터를 불러오지 못했어요')
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setData(json)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const items = data?.[tab] ?? []
  const maxRate = items[0]?.rate ?? 5

  return (
    <div className="savings-rates">
      <div className="savings-header">
        <div>
          <div className="savings-title">예적금 금리 비교</div>
          {data?.updatedAt && (
            <div className="savings-updated">
              기준: {new Date(data.updatedAt).toLocaleDateString('ko-KR')} · 금융감독원
            </div>
          )}
        </div>
        <button className="savings-refresh" onClick={load} disabled={loading}>
          {loading ? '⏳' : '🔄'}
        </button>
      </div>

      <div className="savings-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`savings-tab${tab === t.id ? ' active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="savings-loading">
          <div className="savings-spinner" />
          <span>금리 정보 불러오는 중...</span>
        </div>
      )}

      {error && (
        <div className="savings-error">
          <div>⚠️ {error}</div>
          <button onClick={load}>다시 시도</button>
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">🏦</div>
          <div className="empty-state-title">데이터가 없어요</div>
        </div>
      )}

      {!loading && items.map((item, i) => (
        <div key={i} className="rate-card">
          <div className="rate-rank">{i + 1}</div>
          <div className="rate-info">
            <div className="rate-bank">{item.bankName}</div>
            <div className="rate-product">{item.productName}</div>
            <RateBar rate={item.rate} max={maxRate} />
            <div className="rate-meta">{item.joinWay}</div>
          </div>
          <div className="rate-value">
            <span className="rate-number">{item.rate.toFixed(2)}</span>
            <span className="rate-unit">%</span>
          </div>
        </div>
      ))}
    </div>
  )
}
