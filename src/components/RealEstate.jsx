import { useState, useEffect } from 'react'
import { searchRegions } from '../regionCodes'

const PROPERTY_TYPES = [{ id: 'apt', label: '🏢 아파트' }, { id: 'villa', label: '🏠 빌라' }]
const DEAL_TYPES = [{ id: 'trade', label: '매매' }, { id: 'jeonse', label: '전세' }, { id: 'monthly', label: '월세' }]
const SIZE_FILTERS = [{ id: 'all', label: '전체' }, { id: 's', label: '10평대' }, { id: 'm', label: '20평대' }, { id: 'l', label: '30평 이상' }]
const YEAR_FILTERS = [{ id: 'all', label: '전체' }, { id: 'new', label: '신축(2020~)' }, { id: 'mid', label: '준신축(2010~)' }, { id: 'old', label: '구축(~2009)' }]
const SORT_OPTIONS = [{ id: 'date', label: '최신순' }, { id: 'asc', label: '낮은순' }, { id: 'desc', label: '높은순' }]
const FAV_KEY = 'hb-re-favorites'

function formatManwon(n) {
  if (!n) return '-'
  if (n >= 10000) return `${(n / 10000).toFixed(1)}억`
  return `${n.toLocaleString('ko-KR')}만`
}

function toPy(area) { return (area / 3.305).toFixed(0) }

function pricePerPy(price, area) {
  if (!price || !area) return null
  return Math.round(price / (area / 3.305))
}

function filterItems(items, { sizeFilter, yearFilter, nameQuery }) {
  return items.filter(item => {
    const py = item.area / 3.305
    if (sizeFilter === 's' && !(py >= 10 && py < 20)) return false
    if (sizeFilter === 'm' && !(py >= 20 && py < 30)) return false
    if (sizeFilter === 'l' && !(py >= 30)) return false
    const yr = Number(item.builtYear)
    if (yearFilter === 'new' && !(yr >= 2020)) return false
    if (yearFilter === 'mid' && !(yr >= 2010 && yr < 2020)) return false
    if (yearFilter === 'old' && !(yr < 2010)) return false
    if (nameQuery.trim()) {
      const q = nameQuery.trim().replace(/\s/g, '')
      const name = (item.name || '').replace(/\s/g, '')
      if (!name.includes(q)) return false
    }
    return true
  })
}

function sortItems(items, sort, dealType) {
  if (sort === 'date') return items
  const getVal = (item) => dealType === 'trade' ? item.price : item.deposit
  return [...items].sort((a, b) => sort === 'asc' ? getVal(a) - getVal(b) : getVal(b) - getVal(a))
}

function PriceSummary({ items, dealType }) {
  if (!items.length) return null
  const vals = items.map(i => dealType === 'trade' ? i.price : i.deposit).filter(Boolean)
  if (!vals.length) return null
  const avg = Math.round(vals.reduce((s, v) => s + v, 0) / vals.length)
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  return (
    <div className="re-summary">
      <div className="re-summary-item"><span className="re-summary-label">평균</span><span className="re-summary-val avg">{formatManwon(avg)}</span></div>
      <div className="re-summary-divider" />
      <div className="re-summary-item"><span className="re-summary-label">최저</span><span className="re-summary-val low">{formatManwon(min)}</span></div>
      <div className="re-summary-divider" />
      <div className="re-summary-item"><span className="re-summary-label">최고</span><span className="re-summary-val high">{formatManwon(max)}</span></div>
    </div>
  )
}

// 단지 상세 모달
function AptDetailModal({ name, items, dealType, onClose }) {
  const sorted = [...items].sort((a, b) => {
    const da = `${a.dealYear}${String(a.dealMonth).padStart(2,'0')}`
    const db = `${b.dealYear}${String(b.dealMonth).padStart(2,'0')}`
    return db.localeCompare(da)
  })
  return (
    <div className="re-modal-overlay" onClick={onClose}>
      <div className="re-modal" onClick={e => e.stopPropagation()}>
        <div className="re-modal-header">
          <div className="re-modal-title">{name}</div>
          <button className="re-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="re-modal-sub">{items.length}건 · 최근 5개월</div>
        <div className="re-modal-list">
          {sorted.map((item, i) => (
            <div key={i} className="re-modal-row">
              <div className="re-modal-row-left">
                <span className="re-modal-floor">{item.floor}층</span>
                <span className="re-modal-area">{toPy(item.area)}평 ({item.area}㎡)</span>
                <span className="re-modal-date">{item.dealYear}.{String(item.dealMonth).padStart(2,'0')}</span>
              </div>
              <div className="re-modal-row-right">
                {dealType === 'trade' ? (
                  <>
                    <span className="re-modal-price">{formatManwon(item.price)}</span>
                    <span className="re-modal-per">평당 {formatManwon(pricePerPy(item.price, item.area))}</span>
                  </>
                ) : (
                  <span className="re-modal-price">
                    {item.dealType === 'monthly'
                      ? `${formatManwon(item.deposit)} / 월 ${formatManwon(item.monthly)}`
                      : formatManwon(item.deposit)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function TradeCard({ item, onClick }) {
  const perPy = pricePerPy(item.price, item.area)
  return (
    <div className="re-card" onClick={onClick} style={{ cursor: 'pointer' }}>
      <div className="re-info">
        <div className="re-name">{item.name || '(이름없음)'}</div>
        <div className="re-meta">{item.dong} · {toPy(item.area)}평({item.area}㎡) · {item.floor}층 · {item.builtYear}년</div>
        <div className="re-date">{item.dealYear}.{String(item.dealMonth).padStart(2,'0')} 거래</div>
      </div>
      <div className="re-price-col">
        <div className="re-price trade">{formatManwon(item.price)}</div>
        {perPy && <div className="re-per-py">평당 {formatManwon(perPy)}</div>}
      </div>
    </div>
  )
}

function RentCard({ item, onClick }) {
  return (
    <div className="re-card" onClick={onClick} style={{ cursor: 'pointer' }}>
      <div className="re-info">
        <div className="re-name">{item.name || '(이름없음)'}</div>
        <div className="re-meta">{item.dong} · {toPy(item.area)}평({item.area}㎡) · {item.floor}층 · {item.builtYear}년</div>
        <div className="re-date">{item.dealYear}.{String(item.dealMonth).padStart(2,'0')} 거래</div>
      </div>
      <div className="re-price-col">
        <div className="re-price rent">
          {item.dealType === 'monthly'
            ? <><span className="re-deposit">{formatManwon(item.deposit)}</span><span className="re-monthly">월 {formatManwon(item.monthly)}</span></>
            : <span className="re-deposit">{formatManwon(item.deposit)}</span>
          }
        </div>
      </div>
    </div>
  )
}

function AiResultBody({ text }) {
  const paragraphs = text.split(/\n+/).filter(Boolean)
  return (
    <div className="re-ai-result-body">
      {paragraphs.map((p, i) => <p key={i} style={{ margin: '0 0 8px' }}>{p}</p>)}
    </div>
  )
}

export default function RealEstate({ user, transactions = [], assets = [] }) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [selected, setSelected] = useState(null)
  const [propType, setPropType] = useState('apt')
  const [dealType, setDealType] = useState('trade')
  const [sizeFilter, setSizeFilter] = useState('all')
  const [yearFilter, setYearFilter] = useState('all')
  const [sortBy, setSortBy] = useState('date')
  const [nameQuery, setNameQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiText, setAiText] = useState(null)
  const [modalApt, setModalApt] = useState(null) // { name, items }
  const [favorites, setFavorites] = useState(() => {
    try { return JSON.parse(localStorage.getItem(FAV_KEY) || '[]') } catch { return [] }
  })

  useEffect(() => {
    localStorage.setItem(FAV_KEY, JSON.stringify(favorites))
  }, [favorites])

  function toggleFav(region) {
    setFavorites(prev => {
      const exists = prev.some(f => f.code === region.code)
      return exists ? prev.filter(f => f.code !== region.code) : [...prev, region]
    })
  }

  function isFav(region) {
    return region && favorites.some(f => f.code === region.code)
  }

  function handleQueryChange(e) {
    const val = e.target.value
    setQuery(val)
    setSuggestions(searchRegions(val))
    setSelected(null)
    setData(null)
    setAiText(null)
    setNameQuery('')
  }

  function selectRegion(region) {
    setSelected(region)
    setQuery(region.name)
    setSuggestions([])
    setAiText(null)
  }

  async function search(region) {
    const target = region || selected
    if (!target) return
    setLoading(true); setError(null); setData(null); setAiText(null); setNameQuery('')
    setSizeFilter('all'); setYearFilter('all'); setSortBy('date')
    try {
      const res = await fetch(`/api/realestate?code=${target.code}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setData(json)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  function openAptModal(name) {
    const currentKey = `${propType}-${dealType}`
    const all = data?.[currentKey] ?? []
    const items = all.filter(i => i.name === name)
    setModalApt({ name, items })
  }

  async function analyzeAI() {
    if (!displayItems.length) return
    setAiLoading(true); setAiText(null)

    const now = new Date()
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2,'0')}`
    const monthTx = (transactions || []).filter(t => t.date?.startsWith(thisMonth))
    const monthlyIncome = monthTx.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
    const monthlyExpense = monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
    const activeAssets = assets.filter(a => !a.deleted_at)
    const totalAssets = activeAssets.reduce((s, a) => s + Number(a.amount), 0)
    const emergencyFund = activeAssets.filter(a => a.category === '비상금').reduce((s, a) => s + Number(a.amount), 0)

    try {
      const res = await fetch('/api/realestate-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          regionName: selected.name,
          deal: dealType,
          type: propType,
          transactions: displayItems,
          financials: { totalAssets, monthlyIncome, monthlyExpense, emergencyFund },
        }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setAiText(json.analysis)
    } catch (e) { setAiText(`분석 실패: ${e.message}`) }
    finally { setAiLoading(false) }
  }

  const currentKey = `${propType}-${dealType}`
  const currentItems = data?.[currentKey] ?? []
  const filtered = filterItems(currentItems, { sizeFilter, yearFilter, nameQuery })
  const displayItems = sortItems(filtered, sortBy, dealType)
  const dealLabel = DEAL_TYPES.find(d => d.id === dealType)?.label

  const totalCount = data
    ? Object.values(data).filter(v => Array.isArray(v)).reduce((s, arr) => s + arr.length, 0)
    : 0

  return (
    <div className="re-wrap">
      <div className="re-header">
        <div className="re-title">🏡 부동산 실거래가</div>
        <div className="re-subtitle">국토교통부 실거래가 기준</div>
      </div>

      {/* 즐겨찾기 지역 */}
      {favorites.length > 0 && (
        <div className="re-favs">
          {favorites.map(f => (
            <button key={f.code} className={`re-fav-chip${selected?.code === f.code ? ' active' : ''}`}
              onClick={() => { selectRegion(f); search(f) }}>
              {f.name}
            </button>
          ))}
        </div>
      )}

      {/* 지역 검색 */}
      <div className="re-search-wrap">
        <div className="re-search-row">
          <input
            className="re-search-input"
            placeholder="지역 검색 (예: 마포구, 강남구)"
            value={query}
            onChange={handleQueryChange}
            onFocus={() => query && setSuggestions(searchRegions(query))}
          />
          <button className="re-search-btn" onClick={() => search()} disabled={!selected || loading}>
            {loading ? '⏳' : '검색'}
          </button>
        </div>
        {selected && (
          <button
            className={`re-fav-row-btn${isFav(selected) ? ' active' : ''}`}
            onClick={() => toggleFav(selected)}
          >
            {isFav(selected) ? '★ 즐겨찾기 해제' : '☆ 즐겨찾기 추가'}
          </button>
        )}
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

      {/* 아파트/빌라·거래유형 필터 */}
      <div className="re-filters">
        <div className="re-filter-row">
          {PROPERTY_TYPES.map((t) => {
            const cnt = data?.[`${t.id}-${dealType}`]?.length ?? 0
            return (
              <button key={t.id}
                className={`re-filter-btn${propType === t.id ? ' active' : ''}`}
                onClick={() => { setPropType(t.id); setAiText(null); setNameQuery('') }}>
                {t.label} {data && cnt > 0 && <span className="re-filter-count">{cnt}</span>}
              </button>
            )
          })}
        </div>
        <div className="re-filter-row">
          {DEAL_TYPES.map((t) => {
            const cnt = data?.[`${propType}-${t.id}`]?.length ?? 0
            return (
              <button key={t.id}
                className={`re-filter-btn${dealType === t.id ? ' active' : ''}`}
                onClick={() => { setDealType(t.id); setAiText(null) }}>
                {t.label} {data && cnt > 0 && <span className="re-filter-count">{cnt}</span>}
              </button>
            )
          })}
        </div>
      </div>

      {error && <div className="savings-error"><div>⚠️ {error}</div></div>}
      {loading && (
        <div className="savings-loading" style={{ padding: '32px 0' }}>
          <div className="savings-spinner" />
          <span>아파트·빌라 매매·전세·월세 전체 조회 중...</span>
        </div>
      )}

      {/* 결과 */}
      {data && (
        <>
          <div className="re-result-header">
            <span>{selected?.name} · {dealLabel} {displayItems.length}건</span>
            <span className="re-result-sub">최근 5개월 실거래 (전체 {totalCount}건)</span>
          </div>

          {/* 평균/최저/최고 요약 */}
          <PriceSummary items={filtered} dealType={dealType} />

          {/* 단지명 검색 + 필터들 */}
          {currentItems.length > 0 && (
            <div className="re-sub-filters">
              {/* 단지명 검색 */}
              <input
                className="re-name-search"
                placeholder="단지명으로 검색 (예: 메가트리아)"
                value={nameQuery}
                onChange={e => setNameQuery(e.target.value)}
              />
              {/* 평수 필터 */}
              <div className="re-sub-filter-row">
                {SIZE_FILTERS.map(s => (
                  <button key={s.id}
                    className={`re-sub-btn${sizeFilter === s.id ? ' active' : ''}`}
                    onClick={() => setSizeFilter(s.id)}>
                    {s.label}
                  </button>
                ))}
              </div>
              {/* 건축연도 필터 */}
              <div className="re-sub-filter-row">
                {YEAR_FILTERS.map(s => (
                  <button key={s.id}
                    className={`re-sub-btn${yearFilter === s.id ? ' active' : ''}`}
                    onClick={() => setYearFilter(s.id)}>
                    {s.label}
                  </button>
                ))}
              </div>
              {/* 정렬 */}
              <div className="re-sub-filter-row">
                {SORT_OPTIONS.map(s => (
                  <button key={s.id}
                    className={`re-sub-btn${sortBy === s.id ? ' active' : ''}`}
                    onClick={() => setSortBy(s.id)}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {displayItems.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🏚️</div>
              <div className="empty-state-title">거래 내역이 없어요</div>
              <div className="empty-state-sub">다른 조건을 선택해보세요</div>
            </div>
          ) : (
            displayItems.map((item, i) =>
              item.dealType === 'trade'
                ? <TradeCard key={i} item={item} onClick={() => openAptModal(item.name)} />
                : <RentCard key={i} item={item} onClick={() => openAptModal(item.name)} />
            )
          )}

          {/* AI 분석 */}
          {displayItems.length > 0 && (
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
                  <AiResultBody text={aiText} />
                  <button className="re-ai-refresh" onClick={() => setAiText(null)}>다시 분석</button>
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
            검색 한 번으로 아파트·빌라의<br/>매매·전세·월세를 한꺼번에 불러와요
          </div>
        </div>
      )}

      {/* 단지 상세 모달 */}
      {modalApt && (
        <AptDetailModal
          name={modalApt.name}
          items={modalApt.items}
          dealType={dealType}
          onClose={() => setModalApt(null)}
        />
      )}
    </div>
  )
}
