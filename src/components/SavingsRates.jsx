import { useEffect, useState } from 'react'

const SAVING_TABS = [
  { id: 'deposit12', label: '예금 12개월' },
  { id: 'deposit6',  label: '예금 6개월' },
  { id: 'saving12',  label: '적금 12개월' },
  { id: 'saving6',   label: '적금 6개월' },
]

const LOAN_TABS = [
  { id: 'mortgage', label: '주택담보' },
  { id: 'rent',     label: '전세자금' },
  { id: 'credit',   label: '신용대출' },
]

function Spinner() {
  return (
    <div className="savings-loading">
      <div className="savings-spinner" />
      <span>금리 정보 불러오는 중...</span>
    </div>
  )
}

function RateBar({ rate, max }) {
  return (
    <div className="rate-bar-bg">
      <div className="rate-bar-fill" style={{ width: `${Math.min((rate / (max || 1)) * 100, 100)}%` }} />
    </div>
  )
}

function SavingList({ items }) {
  if (!items.length) return <div className="empty-state"><div className="empty-state-icon">🏦</div><div className="empty-state-title">데이터가 없어요</div></div>
  const maxRate = items[0]?.rate ?? 5
  return items.map((item, i) => (
    <div key={i} className="rate-card">
      <div className="rate-rank" style={i === 0 ? { color: '#f5c518' } : i === 1 ? { color: '#aaa' } : i === 2 ? { color: '#cd7f32' } : {}}>{i + 1}</div>
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
  ))
}

function LoanList({ items }) {
  if (!items.length) return <div className="empty-state"><div className="empty-state-icon">🏦</div><div className="empty-state-title">데이터가 없어요</div></div>
  const maxRate = Math.max(...items.map((i) => i.rateMax))
  return items.map((item, i) => (
    <div key={i} className="rate-card">
      <div className="rate-rank" style={i === 0 ? { color: '#56c97a' } : {}}>{i + 1}</div>
      <div className="rate-info">
        <div className="rate-bank">{item.bankName}</div>
        <div className="rate-product">{item.productName}</div>
        <RateBar rate={item.rateMin} max={maxRate} />
        <div className="rate-meta">{item.joinWay}</div>
      </div>
      <div className="rate-value" style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 11, color: 'var(--text-sub)', marginBottom: 2 }}>최저~최고</div>
        <span className="rate-number" style={{ fontSize: 16, color: 'var(--expense-color)' }}>{item.rateMin.toFixed(2)}</span>
        <span className="rate-unit">~{item.rateMax.toFixed(2)}%</span>
      </div>
    </div>
  ))
}

function Calculator({ savingData }) {
  const [amount, setAmount] = useState('')
  const [months, setMonths] = useState('12')
  const [rate, setRate] = useState('')
  const [result, setResult] = useState(null)

  // 현재 탭 최고금리 자동 입력
  useEffect(() => {
    const top = savingData?.saving12?.[0]?.rate ?? savingData?.deposit12?.[0]?.rate
    if (top) setRate(top.toFixed(2))
  }, [savingData])

  function calc() {
    const p = Number(amount.replace(/,/g, ''))
    const r = Number(rate) / 100 / 12
    const n = Number(months)
    if (!p || !r || !n) return
    // 적금: 매월 납입 복리
    const total = p * n
    const maturity = Math.round(p * (((1 + r) ** n - 1) / r) * (1 + r))
    const interest = maturity - total
    setResult({ total, maturity, interest })
  }

  return (
    <div className="calc-box">
      <div className="calc-title">💰 적금 계산기</div>
      <div className="calc-row">
        <label>월 납입액</label>
        <div className="calc-input-wrap">
          <input
            type="text"
            inputMode="numeric"
            placeholder="300,000"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ','))}
          />
          <span className="calc-unit">원</span>
        </div>
      </div>
      <div className="calc-row">
        <label>기간</label>
        <div className="calc-input-wrap">
          <select value={months} onChange={(e) => setMonths(e.target.value)}>
            {[6,12,24,36,48,60].map((m) => <option key={m} value={m}>{m}개월</option>)}
          </select>
        </div>
      </div>
      <div className="calc-row">
        <label>연 금리</label>
        <div className="calc-input-wrap">
          <input
            type="number"
            step="0.01"
            placeholder="3.50"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
          />
          <span className="calc-unit">%</span>
        </div>
      </div>
      <button className="calc-btn" onClick={calc}>계산하기</button>
      {result && (
        <div className="calc-result">
          <div className="calc-result-row">
            <span>총 납입액</span>
            <span>{result.total.toLocaleString('ko-KR')}원</span>
          </div>
          <div className="calc-result-row">
            <span>예상 이자</span>
            <span style={{ color: 'var(--income-color)' }}>+{result.interest.toLocaleString('ko-KR')}원</span>
          </div>
          <div className="calc-result-row total">
            <span>만기 수령액</span>
            <span>{result.maturity.toLocaleString('ko-KR')}원</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default function SavingsRates() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [mode, setMode] = useState('saving') // 'saving' | 'loan' | 'calc'
  const [savingTab, setSavingTab] = useState('deposit12')
  const [loanTab, setLoanTab] = useState('mortgage')

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

  return (
    <div className="savings-rates">
      <div className="savings-header">
        <div>
          <div className="savings-title">금융상품 비교</div>
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

      {/* 메인 모드 탭 */}
      <div className="savings-mode-tabs">
        <button className={mode === 'saving' ? 'active' : ''} onClick={() => setMode('saving')}>📈 예적금</button>
        <button className={mode === 'loan'   ? 'active' : ''} onClick={() => setMode('loan')}>🏠 대출</button>
        <button className={mode === 'calc'   ? 'active' : ''} onClick={() => setMode('calc')}>🧮 계산기</button>
      </div>

      {loading && <Spinner />}
      {error && (
        <div className="savings-error">
          <div>⚠️ {error}</div>
          <button onClick={load}>다시 시도</button>
        </div>
      )}

      {!loading && !error && mode === 'saving' && (
        <>
          <div className="savings-tabs">
            {SAVING_TABS.map((t) => (
              <button key={t.id} className={`savings-tab${savingTab === t.id ? ' active' : ''}`} onClick={() => setSavingTab(t.id)}>
                {t.label}
              </button>
            ))}
          </div>
          <SavingList items={data?.[savingTab] ?? []} />
        </>
      )}

      {!loading && !error && mode === 'loan' && (
        <>
          <div className="savings-tabs">
            {LOAN_TABS.map((t) => (
              <button key={t.id} className={`savings-tab${loanTab === t.id ? ' active' : ''}`} onClick={() => setLoanTab(t.id)}>
                {t.label}
              </button>
            ))}
          </div>
          <LoanList items={data?.[loanTab] ?? []} />
        </>
      )}

      {mode === 'calc' && <Calculator savingData={data} />}
    </div>
  )
}
