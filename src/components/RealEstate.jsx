import { useState, useRef } from 'react'
import { REGIONS, searchRegions } from '../regionCodes'

const PROPERTY_TYPES = [{ id: 'apt', label: '🏢 아파트' }, { id: 'villa', label: '🏠 빌라' }]
const DEAL_TYPES = [{ id: 'trade', label: '매매' }, { id: 'jeonse', label: '전세' }, { id: 'monthly', label: '월세' }]

function formatManwon(n) {
  if (!n) return '-'
  if (n >= 10000) return `${(n / 10000).toFixed(1)}억`
  return `${n.toLocaleString('ko-KR')}만`
}

function TradeCard({ item, rank }) {
  const py = (item.area / 3.305).toFixed(0)
  return (
    <div className="re-card">
      <div className="re-rank">{rank}</div>
      <div className="re-info">
        <div className="re-name">{item.name || '(이름없음)'}</div>
        <div className="re-meta">{item.dong} · {py}평({item.area}㎡) · {item.floor}층 · {item.builtYear}년</div>
        <div className="re-date">{item.dealYear}.{String(item.dealMonth).padStart(2,'0')} 거래</div>
      </div>
      <div className="re-price trade">{formatManwon(item.price)}</div>
    </div>
  )
}

function RentCard({ item, rank, deal }) {
  const py = (item.area / 3.305).toFixed(0)
  return (
    <div className="re-card">
      <div className="re-rank">{rank}</div>
      <div className="re-info">
        <div className="re-name">{item.name || '(이름없음)'}</div>
        <div className="re-meta">{item.dong} · {py}평({item.area}㎡) · {item.floor}층 · {item.builtYear}년</div>
        <div className="re-date">{item.dealYear}.{String(item.dealMonth).padStart(2,'0')} 거래</div>
      </div>
      <div className="re-price rent">
        {deal === 'monthly'
          ? <><span className="re-deposit">{formatManwon(item.deposit)}</span><span className="re-monthly">월 {formatManwon(item.monthly)}</span></>
          : <span>{formatManwon(item.deposit)}</span>
        }
      </div>
    </div>
  )
}

export default function RealEstate({ user, assets, transactions }) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [selected, setSelected] = useState(null)
  const [propType, setPropType] = useState('apt')
  const [dealType, setDealType] = useState('trade')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiText, setAiText] = useState(null)
  const inputRef = useRef(null)

  function handleQueryChange(e) {
    const val = e.target.value
    setQuery(val)
    setSuggestions(searchRegions(val))
    setSelected(null)
    setData(null)
    setAiText(null)
  }

  function selectRegion(region) {
    setSelected(region)
    setQuery(region.name)
    setSuggestions([])
    setData(null)
    setAiText(null)
  }

  async function search() {
    if (!selected) return
    setLoading(true); setError(null); setData(null); setAiText(null)
    try {
      const res = await fetch(`/api/realestate?code=${selected.code}&type=${propType}&deal=${dealType}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setData(json)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  async function analyzeAI() {
    if (!data?.transactions?.length) return
    setAiLoading(true); setAiText(null)

    // 재무 요약 계산
    const totalAssets = assets?.filter(a => !a.deleted_at).reduce((s, a) => s + Number(a.amount), 0) || 0
    const now = new Date()
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2,'0')}`
    const monthTx = transactions?.filter(t => t.date?.startsWith(thisMonth)) || []
    const monthlyIncome = monthTx.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
    const monthlyExpense = monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
    const emergencyFund = assets?.filter(a => !a.deleted_at && a.category === '비상금').reduce((s, a) => s + Number(a.amount), 0) || 0

    try {
      const res = await fetch('/api/realestate-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          regionName: selected.name,
          deal: dealType,
          type: propType,
          transactions: data.transactions,
          financials: { totalAssets, monthlyIncome, monthlyExpense, emergencyFund },
        }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setAiText(json.analysis)
    } catch (e) { setAiText(`분석 실패: ${e.message}`) }
    finally { setAiLoading(false) }
  }

  const dealLabel = DEAL_TYPES.find(d => d.id === dealType)?.label

  return (
    <div className="re-wrap">
      <div className="re-header">
        <div className="re-title">🏡 부동산 실거래가</div>
        <div className="re-subtitle">국토교통부 실거래가 기준</div>
      </div>

      {/* 지역 검색 */}
      <div className="re-search-wrap">
        <div className="re-search-row">
          <input
            ref={inputRef}
            className="re-search-input"
            placeholder="지역 검색 (예: 마포구, 강남구)"
            value={query}
            onChange={handleQueryChange}
            onFocus={() => query && setSuggestions(searchRegions(query))}
          />
          <button className="re-search-btn" onClick={search} disabled={!selected || loading}>
            {loading ? '⏳' : '검색'}
          </button>
        </div>
        {suggestions.length > 0 && (
          <div className="re-suggestions">
            {suggestions.map((r) => (
              <button key={r.code} className="re-suggestion-item" onClick={() => selectRegion(r)}>
                {r.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 필터 */}
      <div className="re-filters">
        <div className="re-filter-row">
          {PROPERTY_TYPES.map((t) => (
            <button key={t.id} className={`re-filter-btn${propType === t.id ? ' active' : ''}`}
              onClick={() => { setPropType(t.id); setData(null) }}>{t.label}</button>
          ))}
        </div>
        <div className="re-filter-row">
          {DEAL_TYPES.map((t) => (
            <button key={t.id} className={`re-filter-btn${dealType === t.id ? ' active' : ''}`}
              onClick={() => { setDealType(t.id); setData(null) }}>{t.label}</button>
          ))}
        </div>
      </div>

      {error && <div className="savings-error"><div>⚠️ {error}</div></div>}

      {/* 결과 */}
      {data && (
        <>
          <div className="re-result-header">
            <span>{selected?.name} · {dealLabel} {data.transactions.length}건</span>
            <span className="re-result-sub">최근 3개월 실거래</span>
          </div>

          {data.transactions.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🏚️</div>
              <div className="empty-state-title">거래 내역이 없어요</div>
              <div className="empty-state-sub">다른 지역이나 유형을 선택해보세요</div>
            </div>
          ) : (
            <>
              {data.transactions.map((item, i) =>
                dealType === 'trade'
                  ? <TradeCard key={i} item={item} rank={i + 1} />
                  : <RentCard key={i} item={item} rank={i + 1} deal={dealType} />
              )}
            </>
          )}

          {/* AI 분석 */}
          {data.transactions.length > 0 && (
            <div className="re-ai-section">
              {!aiText && (
                <button className="re-ai-btn" onClick={analyzeAI} disabled={aiLoading}>
                  {aiLoading ? '🤖 AI 분석 중...' : '🤖 내 상황에서 AI 분석하기'}
                </button>
              )}
              {aiLoading && (
                <div className="savings-loading" style={{ padding: '16px 0' }}>
                  <div className="savings-spinner" />
                  <span>AI가 재무 상황을 분석하고 있어요...</span>
                </div>
              )}
              {aiText && (
                <div className="re-ai-result">
                  <div className="re-ai-result-title">🤖 AI 분석 결과</div>
                  <div className="re-ai-result-body">{aiText}</div>
                  <button className="re-ai-refresh" onClick={() => { setAiText(null) }}>다시 분석</button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {!data && !loading && !error && (
        <div className="re-empty-guide">
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-heading)', marginBottom: 8 }}>지역을 검색해보세요</div>
          <div style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.6 }}>
            원하는 지역의 아파트/빌라 실거래가를 확인하고<br/>AI가 우리 부부 재무상황에 맞는지 분석해드려요
          </div>
        </div>
      )}
    </div>
  )
}
