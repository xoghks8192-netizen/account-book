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
const BANK_FILTERS = [['all','전체'],['bank','은행'],['saving','저축은행']]
const JOIN_DENY = { '1': '제한없음', '2': '서민전용', '3': '일부제한' }

const FAV_KEY = 'hb-rate-favorites'
const PREV_KEY = 'hb-rate-prev'

function loadFavs() {
  try { return new Set(JSON.parse(localStorage.getItem(FAV_KEY) || '[]')) } catch { return new Set() }
}
function saveFavs(set) {
  localStorage.setItem(FAV_KEY, JSON.stringify([...set]))
}
function loadPrev() {
  try { return JSON.parse(localStorage.getItem(PREV_KEY) || 'null') } catch { return null }
}
function savePrev(data) {
  localStorage.setItem(PREV_KEY, JSON.stringify(data))
}
function productKey(item) {
  return `${item.bankName}__${item.productName}`
}

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

function RateDiff({ current, prev }) {
  if (prev == null) return null
  const diff = current - prev
  if (Math.abs(diff) < 0.01) return null
  const up = diff > 0
  return (
    <span className={`rate-diff ${up ? 'up' : 'down'}`}>
      {up ? '▲' : '▼'}{Math.abs(diff).toFixed(2)}%
    </span>
  )
}

function DetailModal({ item, onClose, onCalc, favs, toggleFav }) {
  if (!item) return null
  const isLoan = 'rateMin' in item
  const key = productKey(item)
  const isFav = favs.has(key)
  return (
    <div className="rate-modal-overlay" onClick={onClose}>
      <div className="rate-modal" onClick={(e) => e.stopPropagation()}>
        <div className="rate-modal-header">
          <div>
            <div className="rate-modal-bank">
              {item.bankName}
              <span className={`bank-badge ${item.bankType}`}>{item.bankType === 'bank' ? '은행' : '저축은행'}</span>
            </div>
            <div className="rate-modal-product">{item.productName}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="rate-fav-btn modal" onClick={() => toggleFav(key)} title={isFav ? '즐겨찾기 해제' : '즐겨찾기'}>
              {isFav ? '❤️' : '🤍'}
            </button>
            <button className="rate-modal-close" onClick={onClose}>✕</button>
          </div>
        </div>

        <div className="rate-modal-rate">
          {isLoan ? (
            <>
              <span className="rate-modal-num" style={{ color: 'var(--expense-color)' }}>{item.rateMin.toFixed(2)}</span>
              <span className="rate-modal-unit">~{item.rateMax.toFixed(2)}%</span>
              <div className="rate-modal-label">최저~최고 금리</div>
            </>
          ) : (
            <>
              <span className="rate-modal-num">{item.rate.toFixed(2)}</span>
              <span className="rate-modal-unit">%</span>
              <div className="rate-modal-label">최고우대금리 (기본 {item.baseRate?.toFixed(2)}%)</div>
            </>
          )}
        </div>

        <div className="rate-modal-rows">
          {item.joinWay && <div className="rate-modal-row"><span>가입 방법</span><span>{item.joinWay}</span></div>}
          {item.joinDeny && <div className="rate-modal-row"><span>가입 제한</span><span>{JOIN_DENY[item.joinDeny] ?? item.joinDeny}</span></div>}
          {item.maxLimit && <div className="rate-modal-row"><span>최고 한도</span><span>{Number(item.maxLimit).toLocaleString('ko-KR')}원</span></div>}
          {item.mtrtInt && <div className="rate-modal-row"><span>만기 후 이율</span><span>{item.mtrtInt}</span></div>}
        </div>

        {item.spclCnd && (
          <div className="rate-modal-section">
            <div className="rate-modal-section-title">우대조건</div>
            <div className="rate-modal-section-body">{item.spclCnd}</div>
          </div>
        )}
        {item.etcNote && (
          <div className="rate-modal-section">
            <div className="rate-modal-section-title">유의사항</div>
            <div className="rate-modal-section-body">{item.etcNote}</div>
          </div>
        )}

        {!isLoan && (
          <button className="calc-btn" style={{ marginTop: 16 }} onClick={() => { onCalc(item); onClose() }}>
            🧮 이 금리로 계산하기
          </button>
        )}
      </div>
    </div>
  )
}

function BankFilterRow({ value, onChange }) {
  return (
    <div className="bank-filter-row">
      {BANK_FILTERS.map(([id, label]) => (
        <button key={id} className={`bank-filter-btn${value === id ? ' active' : ''}`} onClick={() => onChange(id)}>
          {label}
        </button>
      ))}
    </div>
  )
}

function FavSection({ items, allItems, favs, toggleFav, onSelect }) {
  const favItems = allItems.filter((p) => favs.has(productKey(p)))
  if (!favItems.length) return null
  const maxRate = Math.max(...favItems.map((p) => p.rate ?? p.rateMin ?? 0))
  return (
    <div className="fav-section">
      <div className="fav-section-title">⭐ 즐겨찾기</div>
      {favItems.map((item, i) => {
        const isLoan = 'rateMin' in item
        return (
          <div key={i} className="rate-card fav" onClick={() => onSelect(item)} style={{ cursor: 'pointer' }}>
            <div className="rate-info">
              <div className="rate-bank">
                {item.bankName}
                <span className={`bank-badge ${item.bankType}`}>{item.bankType === 'bank' ? '은행' : '저축은행'}</span>
              </div>
              <div className="rate-product">{item.productName}</div>
            </div>
            <div className="rate-value" style={{ textAlign: 'right' }}>
              {isLoan ? (
                <>
                  <span className="rate-number" style={{ fontSize: 16, color: 'var(--expense-color)' }}>{item.rateMin.toFixed(2)}</span>
                  <span className="rate-unit">~{item.rateMax.toFixed(2)}%</span>
                </>
              ) : (
                <>
                  <span className="rate-number">{item.rate.toFixed(2)}</span>
                  <span className="rate-unit">%</span>
                </>
              )}
              <button className="rate-fav-btn" onClick={(e) => { e.stopPropagation(); toggleFav(productKey(item)) }}>❤️</button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function SavingList({ items, bankFilter, onSelect, prevData, favs, toggleFav, tabId }) {
  const filtered = items.filter((p) => bankFilter === 'all' || p.bankType === bankFilter)
  if (!filtered.length) return <div className="empty-state"><div className="empty-state-icon">🏦</div><div className="empty-state-title">데이터가 없어요</div></div>
  const maxRate = filtered[0]?.rate ?? 5
  const prevMap = {}
  if (prevData?.[tabId]) {
    prevData[tabId].forEach((p) => { prevMap[productKey(p)] = p.rate })
  }
  return filtered.map((item, i) => {
    const key = productKey(item)
    const isFav = favs.has(key)
    return (
      <div key={i} className="rate-card" onClick={() => onSelect(item)} style={{ cursor: 'pointer' }}>
        <div className="rate-rank" style={i === 0 ? { color: '#f5c518' } : i === 1 ? { color: '#aaa' } : i === 2 ? { color: '#cd7f32' } : {}}>{i + 1}</div>
        <div className="rate-info">
          <div className="rate-bank">
            {item.bankName}
            <span className={`bank-badge ${item.bankType}`}>{item.bankType === 'bank' ? '은행' : '저축은행'}</span>
          </div>
          <div className="rate-product">{item.productName}</div>
          <RateBar rate={item.rate} max={maxRate} />
          <div className="rate-meta">{item.joinWay}</div>
        </div>
        <div className="rate-value">
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
            <span className="rate-number">{item.rate.toFixed(2)}</span>
            <span className="rate-unit">%</span>
          </div>
          <RateDiff current={item.rate} prev={prevMap[key]} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4, gap: 6 }}>
            <button className="rate-fav-btn" onClick={(e) => { e.stopPropagation(); toggleFav(key) }}>{isFav ? '❤️' : '🤍'}</button>
            <span style={{ fontSize: 10, color: 'var(--text-sub)' }}>자세히 ›</span>
          </div>
        </div>
      </div>
    )
  })
}

function LoanList({ items, bankFilter, onSelect, prevData, favs, toggleFav, tabId }) {
  const filtered = items.filter((p) => bankFilter === 'all' || p.bankType === bankFilter)
  if (!filtered.length) return <div className="empty-state"><div className="empty-state-icon">🏦</div><div className="empty-state-title">데이터가 없어요</div></div>
  const maxRate = Math.max(...filtered.map((i) => i.rateMax))
  const prevMap = {}
  if (prevData?.[tabId]) {
    prevData[tabId].forEach((p) => { prevMap[productKey(p)] = p.rateMin })
  }
  return filtered.map((item, i) => {
    const key = productKey(item)
    const isFav = favs.has(key)
    return (
      <div key={i} className="rate-card" onClick={() => onSelect(item)} style={{ cursor: 'pointer' }}>
        <div className="rate-rank" style={i === 0 ? { color: '#56c97a' } : {}}>{i + 1}</div>
        <div className="rate-info">
          <div className="rate-bank">
            {item.bankName}
            <span className={`bank-badge ${item.bankType}`}>{item.bankType === 'bank' ? '은행' : '저축은행'}</span>
          </div>
          <div className="rate-product">{item.productName}</div>
          <RateBar rate={item.rateMin} max={maxRate} />
          <div className="rate-meta">{item.joinWay}</div>
        </div>
        <div className="rate-value" style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: 'var(--text-sub)', marginBottom: 2 }}>최저~최고</div>
          <span className="rate-number" style={{ fontSize: 16, color: 'var(--expense-color)' }}>{item.rateMin.toFixed(2)}</span>
          <span className="rate-unit">~{item.rateMax.toFixed(2)}%</span>
          <RateDiff current={item.rateMin} prev={prevMap[key]} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4, gap: 6 }}>
            <button className="rate-fav-btn" onClick={(e) => { e.stopPropagation(); toggleFav(key) }}>{isFav ? '❤️' : '🤍'}</button>
            <span style={{ fontSize: 10, color: 'var(--text-sub)' }}>자세히 ›</span>
          </div>
        </div>
      </div>
    )
  })
}

function Calculator({ savingData, presetRate, presetProduct }) {
  const [amount, setAmount] = useState('')
  const [months, setMonths] = useState('12')
  const [rate, setRate] = useState('')
  const [result, setResult] = useState(null)
  // Loan limit calc
  const [income, setIncome] = useState('')
  const [loanRate, setLoanRate] = useState('')
  const [loanMonths, setLoanMonths] = useState('360')
  const [loanResult, setLoanResult] = useState(null)

  useEffect(() => {
    if (presetRate) { setRate(presetRate); setResult(null) }
  }, [presetRate])

  useEffect(() => {
    if (!presetRate) {
      const top = savingData?.saving12?.[0]?.rate ?? savingData?.deposit12?.[0]?.rate
      if (top) setRate(top.toFixed(2))
    }
  }, [savingData])

  useEffect(() => {
    if (savingData?.mortgage?.[0]?.rateMin) {
      setLoanRate(savingData.mortgage[0].rateMin.toFixed(2))
    }
  }, [savingData])

  function calc() {
    const p = Number(amount.replace(/,/g, ''))
    const r = Number(rate) / 100 / 12
    const n = Number(months)
    if (!p || !r || !n) return
    const total = p * n
    const maturity = Math.round(p * (((1 + r) ** n - 1) / r) * (1 + r))
    const interest = maturity - total
    setResult({ total, maturity, interest })
  }

  function calcLoan() {
    const monthlyIncome = Number(income.replace(/,/g, ''))
    const r = Number(loanRate) / 100 / 12
    const n = Number(loanMonths)
    if (!monthlyIncome || !r || !n) return
    // DSR 40%: 월 상환액 = 연소득 × 40% / 12
    const maxPayment = monthlyIncome * 0.4
    // 원리금균등상환 역산: PV = PMT × (1-(1+r)^-n) / r
    const maxLoan = Math.round(maxPayment * (1 - (1 + r) ** -n) / r)
    setLoanResult({ maxPayment: Math.round(maxPayment), maxLoan })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="calc-box">
        <div className="calc-title">💰 적금 계산기</div>
        {presetProduct && (
          <div className="calc-preset-badge">
            📌 {presetProduct.bankName} · {presetProduct.productName}
          </div>
        )}
        <div className="calc-row">
          <label>월 납입액</label>
          <div className="calc-input-wrap">
            <input type="text" inputMode="numeric" placeholder="300,000"
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
            <input type="number" step="0.01" placeholder="3.50" value={rate}
              onChange={(e) => setRate(e.target.value)}
            />
            <span className="calc-unit">%</span>
          </div>
        </div>
        <button className="calc-btn" onClick={calc}>계산하기</button>
        {result && (
          <div className="calc-result">
            <div className="calc-result-row"><span>총 납입액</span><span>{result.total.toLocaleString('ko-KR')}원</span></div>
            <div className="calc-result-row"><span>예상 이자</span><span style={{ color: 'var(--income-color)' }}>+{result.interest.toLocaleString('ko-KR')}원</span></div>
            <div className="calc-result-row total"><span>만기 수령액</span><span>{result.maturity.toLocaleString('ko-KR')}원</span></div>
          </div>
        )}
      </div>

      <div className="calc-box">
        <div className="calc-title">🏠 대출 한도 계산기</div>
        <div className="calc-note">DSR 40% 기준 원리금균등상환</div>
        <div className="calc-row">
          <label>월 소득</label>
          <div className="calc-input-wrap">
            <input type="text" inputMode="numeric" placeholder="4,000,000"
              value={income}
              onChange={(e) => setIncome(e.target.value.replace(/[^0-9]/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ','))}
            />
            <span className="calc-unit">원</span>
          </div>
        </div>
        <div className="calc-row">
          <label>연 금리</label>
          <div className="calc-input-wrap">
            <input type="number" step="0.01" placeholder="4.50" value={loanRate}
              onChange={(e) => setLoanRate(e.target.value)}
            />
            <span className="calc-unit">%</span>
          </div>
        </div>
        <div className="calc-row">
          <label>대출 기간</label>
          <div className="calc-input-wrap">
            <select value={loanMonths} onChange={(e) => setLoanMonths(e.target.value)}>
              {[[120,'10년'],[180,'15년'],[240,'20년'],[300,'25년'],[360,'30년']].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>
        <button className="calc-btn" onClick={calcLoan}>한도 계산하기</button>
        {loanResult && (
          <div className="calc-result">
            <div className="calc-result-row"><span>월 최대 상환 가능액</span><span style={{ color: 'var(--income-color)' }}>{loanResult.maxPayment.toLocaleString('ko-KR')}원</span></div>
            <div className="calc-result-row total"><span>예상 최대 대출 한도</span><span style={{ color: 'var(--expense-color)' }}>{loanResult.maxLoan.toLocaleString('ko-KR')}원</span></div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function SavingsRates() {
  const [data, setData] = useState(null)
  const [prevData, setPrevData] = useState(() => loadPrev())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [mode, setMode] = useState('saving')
  const [savingTab, setSavingTab] = useState('deposit12')
  const [loanTab, setLoanTab] = useState('mortgage')
  const [bankFilter, setBankFilter] = useState('all')
  const [selected, setSelected] = useState(null)
  const [calcPreset, setCalcPreset] = useState(null)
  const [favs, setFavs] = useState(() => loadFavs())
  const [alerts, setAlerts] = useState([])

  function toggleFav(key) {
    setFavs((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      saveFavs(next)
      return next
    })
  }

  function detectAlerts(newData, prev) {
    if (!prev) return []
    const msgs = []
    const tabs = ['deposit12','deposit6','saving12','saving6','mortgage','rent','credit']
    tabs.forEach((tab) => {
      const newItems = newData[tab] ?? []
      const prevItems = prev[tab] ?? []
      const prevMap = {}
      prevItems.forEach((p) => { prevMap[productKey(p)] = p.rate ?? p.rateMin })
      newItems.slice(0, 10).forEach((item) => {
        const key = productKey(item)
        const curRate = item.rate ?? item.rateMin
        const prevRate = prevMap[key]
        if (prevRate != null && Math.abs(curRate - prevRate) >= 0.05) {
          const up = curRate > prevRate
          msgs.push(`${item.bankName} ${item.productName} ${up ? '▲' : '▼'}${Math.abs(curRate - prevRate).toFixed(2)}%`)
        }
      })
    })
    return msgs.slice(0, 5)
  }

  async function load() {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/savings-rates')
      if (!res.ok) throw new Error('데이터를 불러오지 못했어요')
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      const prev = loadPrev()
      const newAlerts = detectAlerts(json, prev)
      setAlerts(newAlerts)
      setPrevData(prev)
      savePrev(json)
      setData(json)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  function handleCalc(item) {
    setCalcPreset(item)
    setMode('calc')
  }

  const allItems = data ? [
    ...(data.deposit12 ?? []),
    ...(data.deposit6 ?? []),
    ...(data.saving12 ?? []),
    ...(data.saving6 ?? []),
    ...(data.mortgage ?? []),
    ...(data.rent ?? []),
    ...(data.credit ?? []),
  ] : []

  return (
    <div className="savings-rates">
      {selected && <DetailModal item={selected} onClose={() => setSelected(null)} onCalc={handleCalc} favs={favs} toggleFav={toggleFav} />}

      <div className="savings-header">
        <div>
          <div className="savings-title">금융상품 비교</div>
          {data?.updatedAt && (
            <div className="savings-updated">기준: {new Date(data.updatedAt).toLocaleDateString('ko-KR')} · 금융감독원</div>
          )}
        </div>
        <button className="savings-refresh" onClick={load} disabled={loading}>{loading ? '⏳' : '🔄'}</button>
      </div>

      {alerts.length > 0 && (
        <div className="rate-alerts">
          <div className="rate-alerts-title">📢 금리 변동 감지</div>
          {alerts.map((msg, i) => <div key={i} className="rate-alert-item">{msg}</div>)}
        </div>
      )}

      <div className="savings-mode-tabs">
        <button className={mode === 'saving' ? 'active' : ''} onClick={() => setMode('saving')}>📈 예적금</button>
        <button className={mode === 'loan'   ? 'active' : ''} onClick={() => setMode('loan')}>🏠 대출</button>
        <button className={mode === 'calc'   ? 'active' : ''} onClick={() => setMode('calc')}>🧮 계산기</button>
      </div>

      {loading && <Spinner />}
      {error && <div className="savings-error"><div>⚠️ {error}</div><button onClick={load}>다시 시도</button></div>}

      {!loading && !error && mode === 'saving' && (
        <>
          <div className="savings-tabs">
            {SAVING_TABS.map((t) => (
              <button key={t.id} className={`savings-tab${savingTab === t.id ? ' active' : ''}`} onClick={() => setSavingTab(t.id)}>{t.label}</button>
            ))}
          </div>
          <BankFilterRow value={bankFilter} onChange={setBankFilter} />
          <FavSection allItems={allItems} favs={favs} toggleFav={toggleFav} onSelect={setSelected} />
          <SavingList items={data?.[savingTab] ?? []} bankFilter={bankFilter} onSelect={setSelected} prevData={prevData} favs={favs} toggleFav={toggleFav} tabId={savingTab} />
        </>
      )}

      {!loading && !error && mode === 'loan' && (
        <>
          <div className="savings-tabs">
            {LOAN_TABS.map((t) => (
              <button key={t.id} className={`savings-tab${loanTab === t.id ? ' active' : ''}`} onClick={() => setLoanTab(t.id)}>{t.label}</button>
            ))}
          </div>
          <BankFilterRow value={bankFilter} onChange={setBankFilter} />
          <FavSection allItems={allItems} favs={favs} toggleFav={toggleFav} onSelect={setSelected} />
          <LoanList items={data?.[loanTab] ?? []} bankFilter={bankFilter} onSelect={setSelected} prevData={prevData} favs={favs} toggleFav={toggleFav} tabId={loanTab} />
        </>
      )}

      {mode === 'calc' && (
        <Calculator
          savingData={data}
          presetRate={calcPreset?.rate?.toFixed(2)}
          presetProduct={calcPreset}
        />
      )}
    </div>
  )
}
