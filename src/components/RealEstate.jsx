import { useState, useEffect } from 'react'
import { searchRegions } from '../regionCodes'

const PROPERTY_TYPES = [{ id: 'apt', label: '🏢 아파트' }, { id: 'villa', label: '🏠 빌라' }]
const DEAL_TYPES = [{ id: 'trade', label: '매매' }, { id: 'jeonse', label: '전세' }, { id: 'monthly', label: '월세' }]
const SIZE_FILTERS = [{ id: 'all', label: '전체' }, { id: 's', label: '10평대' }, { id: 'm', label: '20평대' }, { id: 'l', label: '30평 이상' }]
const YEAR_FILTERS = [{ id: 'all', label: '전체' }, { id: 'new', label: '신축(2020~)' }, { id: 'mid', label: '준신축(2010~)' }, { id: 'old', label: '구축(~2009)' }]
const SORT_OPTIONS = [{ id: 'date', label: '최신순' }, { id: 'asc', label: '낮은순' }, { id: 'desc', label: '높은순' }]
const FAV_KEY = 'hb-re-favorites'
const PROFILE_KEY = 'hb-re-profile'

const DEFAULT_PROFILE = {
  job: '직장인',
  monthlyIncome: 0,       // 만원
  hasHome: 'none',        // none / one / two
  isFirstBuyer: true,
  zone: 'normal',         // regulated(투기과열) / adjustment(조정) / normal(비규제)
  existingLoan: 0,        // 기존 대출 월상환액 만원
  targetMonths: 0,        // N개월 후 예상 자산 기준 (0=현재)
}

// 자산: 원 단위 → 만원
function wonToManwon(won) { return Math.floor(won / 10000) }

function formatManwon(n) {
  if (!n) return '-'
  if (n >= 10000) {
    const uk = Math.floor(n / 10000)
    const man = n % 10000
    return man > 0 ? `${uk}억 ${man.toLocaleString('ko-KR')}만` : `${uk}억`
  }
  return `${n.toLocaleString('ko-KR')}만`
}

function toPy(area) { return (area / 3.305).toFixed(0) }

function pricePerPy(price, area) {
  if (!price || !area) return null
  return Math.round(price / (area / 3.305))
}

// LTV 계산 (비율)
function getLTV(hasHome, isFirstBuyer, zone) {
  if (hasHome === 'two') return 0  // 2주택 이상 원칙적 불가
  if (hasHome === 'one') {
    if (zone === 'regulated') return 0
    if (zone === 'adjustment') return 0.5
    return 0.6
  }
  // 무주택
  if (isFirstBuyer) return 0.8
  if (zone === 'regulated') return 0.5
  if (zone === 'adjustment') return 0.7
  return 0.8
}

// DSR 40% 기준 최대 대출액 계산 (만원)
function calcMaxLoan(monthlyIncome, existingLoan, rate = 0.035, years = 30) {
  const maxPayment = monthlyIncome * 0.4 - existingLoan
  if (maxPayment <= 0) return 0
  const r = rate / 12
  const n = years * 12
  return Math.floor(maxPayment * (1 - Math.pow(1 + r, -n)) / r)
}

// 최대 매입 가능 금액 계산 (만원)
function calcMaxPrice(equity, maxLoan, ltv) {
  if (ltv === 0) return equity  // 대출 불가면 자기자본만
  const maxByLTV = Math.floor(equity / (1 - ltv))
  const maxByDSR = equity + maxLoan
  return Math.min(maxByLTV, maxByDSR)
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

// 구매력 계산기 패널
function AffordabilityPanel({ assets, profile, onProfileChange }) {
  const [open, setOpen] = useState(false)
  const [local, setLocal] = useState(profile)

  function set(key, val) { setLocal(p => ({ ...p, [key]: val })) }

  function save() {
    onProfileChange(local)
    setOpen(false)
  }

  const activeAssets = assets.filter(a => !a.deleted_at)
  const totalWon = activeAssets.reduce((s, a) => s + Number(a.amount), 0)
  const emergencyWon = activeAssets.filter(a => a.category === '비상금').reduce((s, a) => s + Number(a.amount), 0)

  // 월 저축액 추정 (총자산 기준 단순 계산은 어려우므로 소득-지출로)
  const equityNow = wonToManwon(totalWon - emergencyWon)
  const monthlySaving = profile.monthlyIncome - (profile.monthlyIncome * 0.6) // 대략 소득의 40%
  const equityFuture = equityNow + Math.max(0, Math.floor(monthlySaving * profile.targetMonths))

  const equity = profile.targetMonths > 0 ? equityFuture : equityNow
  const ltv = getLTV(profile.hasHome, profile.isFirstBuyer, profile.zone)
  const maxLoan = calcMaxLoan(profile.monthlyIncome, profile.existingLoan)
  const maxPrice = calcMaxPrice(equity, maxLoan, ltv)

  return (
    <div className="re-afford-wrap">
      <button className="re-afford-toggle" onClick={() => setOpen(o => !o)}>
        🏠 구매력 계산기 {open ? '▲' : '▼'}
      </button>

      {open && (
        <div className="re-afford-form">
          <div className="re-afford-row">
            <label>직업</label>
            <select value={local.job} onChange={e => set('job', e.target.value)}>
              {['직장인','공무원','자영업자','기타'].map(v => <option key={v}>{v}</option>)}
            </select>
          </div>
          <div className="re-afford-row">
            <label>부부 합산 월소득</label>
            <div className="re-afford-input-wrap">
              <input type="number" value={local.monthlyIncome} onChange={e => set('monthlyIncome', Number(e.target.value))} />
              <span>만원</span>
            </div>
          </div>
          <div className="re-afford-row">
            <label>주택 소유</label>
            <select value={local.hasHome} onChange={e => set('hasHome', e.target.value)}>
              <option value="none">무주택</option>
              <option value="one">1주택</option>
              <option value="two">2주택 이상</option>
            </select>
          </div>
          {local.hasHome === 'none' && (
            <div className="re-afford-row">
              <label>생애최초 여부</label>
              <select value={local.isFirstBuyer ? 'yes' : 'no'} onChange={e => set('isFirstBuyer', e.target.value === 'yes')}>
                <option value="yes">예</option>
                <option value="no">아니오</option>
              </select>
            </div>
          )}
          <div className="re-afford-row">
            <label>지역 규제</label>
            <select value={local.zone} onChange={e => set('zone', e.target.value)}>
              <option value="normal">비규제</option>
              <option value="adjustment">조정대상</option>
              <option value="regulated">투기과열</option>
            </select>
          </div>
          <div className="re-afford-row">
            <label>기존 대출 월상환액</label>
            <div className="re-afford-input-wrap">
              <input type="number" value={local.existingLoan} onChange={e => set('existingLoan', Number(e.target.value))} />
              <span>만원</span>
            </div>
          </div>
          <div className="re-afford-row">
            <label>자산 기준 시점</label>
            <div className="re-afford-input-wrap">
              <select value={local.targetMonths} onChange={e => set('targetMonths', Number(e.target.value))}>
                <option value={0}>현재</option>
                <option value={6}>6개월 후</option>
                <option value={12}>1년 후</option>
                <option value={24}>2년 후</option>
                <option value={36}>3년 후</option>
              </select>
            </div>
          </div>
          <button className="re-afford-save" onClick={save}>적용하기</button>
        </div>
      )}

      {/* 결과 요약 */}
      {profile.monthlyIncome > 0 && (
        <div className="re-afford-result">
          <div className="re-afford-result-row">
            <span className="re-afford-label">자기자본{profile.targetMonths > 0 ? ` (${profile.targetMonths}개월 후)` : ''}</span>
            <span className="re-afford-val">{formatManwon(equity)}</span>
          </div>
          <div className="re-afford-result-row">
            <span className="re-afford-label">최대 대출 (DSR 40%, 금리 3.5%, 30년)</span>
            <span className="re-afford-val">{ltv === 0 ? '불가' : formatManwon(maxLoan)}</span>
          </div>
          <div className="re-afford-result-row">
            <span className="re-afford-label">LTV {Math.round(ltv * 100)}%</span>
            <span className="re-afford-val">적용</span>
          </div>
          <div className="re-afford-result-total">
            <span>최대 매입 가능</span>
            <span className="re-afford-total-val">{formatManwon(maxPrice)}</span>
          </div>
        </div>
      )}
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

function TradeCard({ item, onClick, maxPrice }) {
  const perPy = pricePerPy(item.price, item.area)
  const affordable = maxPrice > 0 && item.price <= maxPrice
  const tooExpensive = maxPrice > 0 && item.price > maxPrice
  return (
    <div className={`re-card${affordable ? ' re-card-ok' : tooExpensive ? ' re-card-over' : ''}`} onClick={onClick} style={{ cursor: 'pointer' }}>
      <div className="re-info">
        <div className="re-name">{item.name || '(이름없음)'}{affordable && <span className="re-budget-badge">✓ 가능</span>}</div>
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

function RentCard({ item, onClick, maxPrice }) {
  const affordable = maxPrice > 0 && item.deposit <= maxPrice
  const tooExpensive = maxPrice > 0 && item.deposit > maxPrice
  return (
    <div className={`re-card${affordable ? ' re-card-ok' : tooExpensive ? ' re-card-over' : ''}`} onClick={onClick} style={{ cursor: 'pointer' }}>
      <div className="re-info">
        <div className="re-name">{item.name || '(이름없음)'}{affordable && <span className="re-budget-badge">✓ 가능</span>}</div>
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
      {paragraphs.map((p, i) => {
        // **볼드** 파싱
        const parts = p.split(/(\*\*[^*]+\*\*)/)
        return (
          <p key={i} style={{ margin: '0 0 10px' }}>
            {parts.map((part, j) =>
              part.startsWith('**') && part.endsWith('**')
                ? <strong key={j}>{part.slice(2, -2)}</strong>
                : part
            )}
          </p>
        )
      })}
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
  const [modalApt, setModalApt] = useState(null)
  const [favorites, setFavorites] = useState(() => {
    try { return JSON.parse(localStorage.getItem(FAV_KEY) || '[]') } catch { return [] }
  })
  const [profile, setProfile] = useState(() => {
    try { return { ...DEFAULT_PROFILE, ...JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}') } } catch { return DEFAULT_PROFILE }
  })

  useEffect(() => { localStorage.setItem(FAV_KEY, JSON.stringify(favorites)) }, [favorites])
  useEffect(() => { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)) }, [profile])

  function toggleFav(region) {
    setFavorites(prev => {
      const exists = prev.some(f => f.code === region.code)
      return exists ? prev.filter(f => f.code !== region.code) : [...prev, region]
    })
  }

  function isFav(region) { return region && favorites.some(f => f.code === region.code) }

  function handleQueryChange(e) {
    const val = e.target.value
    setQuery(val); setSuggestions(searchRegions(val))
    setSelected(null); setData(null); setAiText(null); setNameQuery('')
  }

  function selectRegion(region) {
    setSelected(region); setQuery(region.name); setSuggestions([]); setAiText(null)
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
    const all = data?.[`${propType}-${dealType}`] ?? []
    setModalApt({ name, items: all.filter(i => i.name === name) })
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
          regionName: selected.name, deal: dealType, type: propType,
          transactions: displayItems,
          financials: { totalAssets, monthlyIncome, monthlyExpense, emergencyFund },
          profile,
        }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setAiText(json.analysis)
    } catch (e) { setAiText(`분석 실패: ${e.message}`) }
    finally { setAiLoading(false) }
  }

  // 구매력 계산
  const activeAssets = assets.filter(a => !a.deleted_at)
  const totalWon = activeAssets.reduce((s, a) => s + Number(a.amount), 0)
  const emergencyWon = activeAssets.filter(a => a.category === '비상금').reduce((s, a) => s + Number(a.amount), 0)
  const equityNow = wonToManwon(totalWon - emergencyWon)
  const monthlySavingEst = Math.max(0, profile.monthlyIncome - profile.existingLoan - Math.floor(profile.monthlyIncome * 0.5))
  const equityFuture = equityNow + Math.floor(monthlySavingEst * profile.targetMonths)
  const equity = profile.targetMonths > 0 ? equityFuture : equityNow
  const ltv = getLTV(profile.hasHome, profile.isFirstBuyer, profile.zone)
  const maxLoan = profile.monthlyIncome > 0 ? calcMaxLoan(profile.monthlyIncome, profile.existingLoan) : 0
  const maxPrice = profile.monthlyIncome > 0 ? calcMaxPrice(equity, maxLoan, ltv) : wonToManwon(totalWon - emergencyWon)

  const currentKey = `${propType}-${dealType}`
  const currentItems = data?.[currentKey] ?? []
  const filtered = filterItems(currentItems, { sizeFilter, yearFilter, nameQuery })
  const displayItems = sortItems(filtered, sortBy, dealType)
  const dealLabel = DEAL_TYPES.find(d => d.id === dealType)?.label
  const totalCount = data ? Object.values(data).filter(v => Array.isArray(v)).reduce((s, arr) => s + arr.length, 0) : 0
  const affordableCount = maxPrice > 0
    ? displayItems.filter(i => (dealType === 'trade' ? i.price : i.deposit) <= maxPrice).length
    : 0

  return (
    <div className="re-wrap">
      <div className="re-header">
        <div className="re-title">🏡 부동산 실거래가</div>
        <div className="re-subtitle">국토교통부 실거래가 기준</div>
      </div>

      {/* 구매력 계산기 */}
      <AffordabilityPanel assets={assets} profile={profile} onProfileChange={setProfile} />

      {/* 즐겨찾기 */}
      {favorites.length > 0 && (
        <div className="re-favs">
          {favorites.map(f => (
            <button key={f.code} className={`re-fav-chip${selected?.code === f.code ? ' active' : ''}`}
              onClick={() => { selectRegion(f); search(f) }}>{f.name}</button>
          ))}
        </div>
      )}

      {/* 지역 검색 */}
      <div className="re-search-wrap">
        <div className="re-search-row">
          <input className="re-search-input" placeholder="지역 검색 (예: 마포구, 강남구)"
            value={query} onChange={handleQueryChange}
            onFocus={() => query && setSuggestions(searchRegions(query))} />
          <button className="re-search-btn" onClick={() => search()} disabled={!selected || loading}>
            {loading ? '⏳' : '검색'}
          </button>
        </div>
        {selected && (
          <button className={`re-fav-row-btn${isFav(selected) ? ' active' : ''}`} onClick={() => toggleFav(selected)}>
            {isFav(selected) ? '★ 즐겨찾기 해제' : '☆ 즐겨찾기 추가'}
          </button>
        )}
        {suggestions.length > 0 && (
          <div className="re-suggestions">
            {suggestions.map(r => (
              <button key={r.code} className="re-suggestion-item" onClick={() => selectRegion(r)}>{r.name}</button>
            ))}
          </div>
        )}
      </div>

      {/* 아파트/빌라·거래유형 필터 */}
      <div className="re-filters">
        <div className="re-filter-row">
          {PROPERTY_TYPES.map(t => {
            const cnt = data?.[`${t.id}-${dealType}`]?.length ?? 0
            return (
              <button key={t.id} className={`re-filter-btn${propType === t.id ? ' active' : ''}`}
                onClick={() => { setPropType(t.id); setAiText(null); setNameQuery('') }}>
                {t.label} {data && cnt > 0 && <span className="re-filter-count">{cnt}</span>}
              </button>
            )
          })}
        </div>
        <div className="re-filter-row">
          {DEAL_TYPES.map(t => {
            const cnt = data?.[`${propType}-${t.id}`]?.length ?? 0
            return (
              <button key={t.id} className={`re-filter-btn${dealType === t.id ? ' active' : ''}`}
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

      {data && (
        <>
          <div className="re-result-header">
            <span>{selected?.name} · {dealLabel} {displayItems.length}건</span>
            <span className="re-result-sub">최근 5개월 실거래 (전체 {totalCount}건)</span>
          </div>

          {/* 예산 배너 */}
          {maxPrice > 0 && (
            <div className="re-budget-banner">
              <span className="re-budget-banner-text">
                💰 최대 매입 {formatManwon(maxPrice)}{profile.targetMonths > 0 ? ` (${profile.targetMonths}개월 후)` : ''}
              </span>
              <span className="re-budget-banner-count">
                {affordableCount}건 가능 · {displayItems.length - affordableCount}건 초과
              </span>
            </div>
          )}

          <PriceSummary items={filtered} dealType={dealType} />

          {/* 단지명 검색 + 서브 필터 */}
          {currentItems.length > 0 && (
            <div className="re-sub-filters">
              <input className="re-name-search" placeholder="단지명으로 검색 (예: 메가트리아)"
                value={nameQuery} onChange={e => setNameQuery(e.target.value)} />
              <div className="re-sub-filter-row">
                {SIZE_FILTERS.map(s => (
                  <button key={s.id} className={`re-sub-btn${sizeFilter === s.id ? ' active' : ''}`}
                    onClick={() => setSizeFilter(s.id)}>{s.label}</button>
                ))}
              </div>
              <div className="re-sub-filter-row">
                {YEAR_FILTERS.map(s => (
                  <button key={s.id} className={`re-sub-btn${yearFilter === s.id ? ' active' : ''}`}
                    onClick={() => setYearFilter(s.id)}>{s.label}</button>
                ))}
              </div>
              <div className="re-sub-filter-row">
                {SORT_OPTIONS.map(s => (
                  <button key={s.id} className={`re-sub-btn${sortBy === s.id ? ' active' : ''}`}
                    onClick={() => setSortBy(s.id)}>{s.label}</button>
                ))}
              </div>

              {/* AI 버튼 — 정렬 필터 바로 아래 */}
              <div className="re-ai-section" style={{ marginTop: 10 }}>
                {!aiText && (
                  <button className="re-ai-btn" onClick={analyzeAI} disabled={aiLoading}>
                    {aiLoading ? '🤖 AI 분석 중...' : '🤖 내 상황에서 AI 분석하기'}
                  </button>
                )}
                {aiLoading && (
                  <div className="savings-loading" style={{ padding: '12px 0' }}>
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
                ? <TradeCard key={i} item={item} onClick={() => openAptModal(item.name)} maxPrice={maxPrice} />
                : <RentCard key={i} item={item} onClick={() => openAptModal(item.name)} maxPrice={maxPrice} />
            )
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

      {modalApt && (
        <AptDetailModal name={modalApt.name} items={modalApt.items} dealType={dealType} onClose={() => setModalApt(null)} />
      )}
    </div>
  )
}
