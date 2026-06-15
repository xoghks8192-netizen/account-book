import { useEffect, useMemo, useState } from 'react'
import { supabase } from './lib/supabase'
import TransactionForm from './components/TransactionForm'
import TransactionList from './components/TransactionList'
import Login from './components/Login'
import AnniversaryBanner from './components/AnniversaryBanner'
import AssetsPage from './components/AssetsPage'
import ExpenseChart from './components/ExpenseChart'
import RecurringTemplates from './components/RecurringTemplates'
import MonthComparison from './components/MonthComparison'
import ChangePassword from './components/ChangePassword'
import Collapsible from './components/Collapsible'
import TransactionInsight from './components/TransactionInsight'
import TransactionCalendar from './components/TransactionCalendar'
import { toCSV, downloadCSV } from './lib/csv'
import { loadSession, saveSession, clearSession } from './users'
import { STOCK_CATEGORIES } from './assetMeta'
import { DEFAULT_CATEGORIES, TRANSFER_CATEGORY } from './categories'

const PAGE_KEY = 'household-budget-page'
const THEME_KEY = 'household-budget-theme'

function formatAmount(n) {
  return n.toLocaleString('ko-KR')
}

function shortName(name) {
  return name.length >= 3 ? name.slice(1) : name
}

function monthRange(year, month) {
  const start = new Date(year, month, 1)
  const end = new Date(year, month + 1, 1)
  const toStr = (d) => d.toISOString().slice(0, 10)
  return { start: toStr(start), end: toStr(end) }
}

export default function App() {
  const [user, setUser] = useState(() => loadSession())
  const [page, setPage] = useState(() => localStorage.getItem(PAGE_KEY) || 'transactions')
  const [cursor, setCursor] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })
  const [transactions, setTransactions] = useState([])
  const [prevTransactions, setPrevTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [amountMin, setAmountMin] = useState('')
  const [amountMax, setAmountMax] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [ownerFilter, setOwnerFilter] = useState('전체')
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [linkableAssets, setLinkableAssets] = useState([])
  const [exporting, setExporting] = useState(false)
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || 'light')
  const [showMoreMenu, setShowMoreMenu] = useState(false)

  const householdId = user?.householdId
  const myName = user?.displayName
  const owners = [...(user?.members ?? []), '공동']
  const categories = { ...DEFAULT_CATEGORIES, ...(user?.categories ?? {}) }

  const { start, end } = useMemo(() => monthRange(cursor.year, cursor.month), [cursor])
  const { start: prevStart, end: prevEnd } = useMemo(
    () => monthRange(cursor.year, cursor.month - 1),
    [cursor],
  )

  useEffect(() => {
    localStorage.setItem(PAGE_KEY, page)
  }, [page])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  useEffect(() => {
    if (!householdId) return
    let cancelled = false
    async function load() {
      const { data, error } = await supabase
        .from('assets')
        .select('*')
        .eq('household_id', householdId)
        .order('id', { ascending: true })
      if (!cancelled && !error) {
        setLinkableAssets(data.filter((a) => !STOCK_CATEGORIES.includes(a.category)))
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [page, householdId])

  useEffect(() => {
    if (!householdId) return
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('household_id', householdId)
        .gte('date', start)
        .lt('date', end)
        .order('date', { ascending: false })
        .order('id', { ascending: false })
      if (cancelled) return
      if (error) {
        setError(error.message)
      } else {
        setTransactions(data)
      }
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [start, end, householdId])

  useEffect(() => {
    if (!householdId) return
    let cancelled = false
    async function load() {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('household_id', householdId)
        .gte('date', prevStart)
        .lt('date', prevEnd)
      if (cancelled) return
      if (!error) setPrevTransactions(data)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [prevStart, prevEnd, householdId])

  async function adjustAssetAmount(assetId, delta) {
    if (!assetId || !delta) return
    const { data } = await supabase.from('assets').select('amount').eq('id', assetId).single()
    if (!data) return
    await supabase
      .from('assets')
      .update({ amount: Number(data.amount) + delta, updated_at: new Date().toISOString() })
      .eq('id', assetId)
  }

  async function handleAdd(tx) {
    const { data, error } = await supabase
      .from('transactions')
      .insert({ ...tx, author: tx.author || myName, household_id: householdId })
      .select()
      .single()
    if (error) {
      setError(error.message)
      return null
    }
    if (tx.date >= start && tx.date < end) {
      setTransactions((prev) =>
        [...prev, data].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id)),
      )
    }
    if (data.linked_asset_id) {
      await adjustAssetAmount(data.linked_asset_id, Number(data.amount))
    }
    return data
  }

  async function handleDelete(id) {
    const target = transactions.find((t) => t.id === id)
    const { error } = await supabase.from('transactions').delete().eq('id', id)
    if (error) {
      setError(error.message)
      return
    }
    setTransactions((prev) => prev.filter((t) => t.id !== id))
    if (target?.linked_asset_id) {
      await adjustAssetAmount(target.linked_asset_id, -Number(target.amount))
    }
  }

  async function handleUpdateTransaction(id, fields) {
    const old = transactions.find((t) => t.id === id)
    const { data, error } = await supabase.from('transactions').update(fields).eq('id', id).select().single()
    if (error) {
      setError(error.message)
      return false
    }
    setTransactions((prev) =>
      prev
        .map((t) => (t.id === id ? data : t))
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id)),
    )
    if (old?.linked_asset_id) {
      await adjustAssetAmount(old.linked_asset_id, -Number(old.amount))
    }
    if (data.linked_asset_id) {
      await adjustAssetAmount(data.linked_asset_id, Number(data.amount))
    }
    return true
  }

  function changeMonth(delta) {
    setCursor((prev) => {
      const d = new Date(prev.year, prev.month + delta, 1)
      return { year: d.getFullYear(), month: d.getMonth() }
    })
  }

  const ownedTransactions =
    ownerFilter === '전체' ? transactions : transactions.filter((t) => t.owner === ownerFilter)
  const ownedPrevTransactions =
    ownerFilter === '전체' ? prevTransactions : prevTransactions.filter((t) => t.owner === ownerFilter)

  const totalIncome = ownedTransactions
    .filter((t) => t.type === 'income' && t.category !== TRANSFER_CATEGORY)
    .reduce((s, t) => s + Number(t.amount), 0)
  const totalExpense = ownedTransactions.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
  const balance = totalIncome - totalExpense
  const transferReceived = ownedTransactions
    .filter((t) => t.type === 'income' && t.category === TRANSFER_CATEGORY)
    .reduce((s, t) => s + Number(t.amount), 0)

  const prevIncome = ownedPrevTransactions
    .filter((t) => t.type === 'income' && t.category !== TRANSFER_CATEGORY)
    .reduce((s, t) => s + Number(t.amount), 0)
  const prevExpense = ownedPrevTransactions.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
  const prevBalance = prevIncome - prevExpense

  const filteredTransactions = useMemo(() => {
    const q = search.trim().toLowerCase()
    const min = amountMin ? Number(amountMin) : null
    const max = amountMax ? Number(amountMax) : null
    return ownedTransactions.filter((t) => {
      if (q && !(t.category.toLowerCase().includes(q) || (t.memo && t.memo.toLowerCase().includes(q)))) return false
      if (min !== null && Number(t.amount) < min) return false
      if (max !== null && Number(t.amount) > max) return false
      if (dateFrom && t.date < dateFrom) return false
      if (dateTo && t.date > dateTo) return false
      return true
    })
  }, [ownedTransactions, search, amountMin, amountMax, dateFrom, dateTo])

  const hasActiveFilters = amountMin || amountMax || dateFrom || dateTo

  function clearFilters() {
    setAmountMin('')
    setAmountMax('')
    setDateFrom('')
    setDateTo('')
  }

  async function handleExportAll() {
    setExporting(true)
    const date = new Date().toISOString().slice(0, 10)

    try {
      const { data: txData } = await supabase
        .from('transactions')
        .select('*')
        .eq('household_id', householdId)
        .order('date', { ascending: false })
        .order('id', { ascending: false })
      if (txData) {
        const csv = toCSV(
          ['날짜', '구분', '유형', '카테고리', '금액', '메모', '작성자', '연동자산ID'],
          txData.map((t) => [
            t.date,
            t.owner ?? '',
            t.type === 'income' ? '수입' : '지출',
            t.category,
            t.amount,
            t.memo ?? '',
            t.author ?? '',
            t.linked_asset_id ?? '',
          ]),
        )
        downloadCSV(`거래내역_${date}.csv`, csv)
      }

      const { data: assetData } = await supabase
        .from('assets')
        .select('*')
        .eq('household_id', householdId)
        .order('category', { ascending: true })
        .order('id', { ascending: true })
      if (assetData) {
        const csv = toCSV(
          ['이름', '카테고리', '유동성', '구분', '금액'],
          assetData.map((a) => [
            a.name,
            a.category,
            a.liquidity ?? '',
            a.owner ?? '',
            a.amount,
          ]),
        )
        downloadCSV(`자산_${date}.csv`, csv)
      }

      const { data: recurringData } = await supabase
        .from('recurring_templates')
        .select('*')
        .eq('household_id', householdId)
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('id', { ascending: true })
      if (recurringData) {
        const csv = toCSV(
          ['이름', '유형', '카테고리', '금액', '메모', '구분', '연동자산ID'],
          recurringData.map((t) => [
            t.name,
            t.type === 'income' ? '수입' : '지출',
            t.category,
            t.amount,
            t.memo ?? '',
            t.author ?? '',
            t.linked_asset_id ?? '',
          ]),
        )
        downloadCSV(`고정지출수입_${date}.csv`, csv)
      }
    } finally {
      setExporting(false)
    }
  }

  if (!user) {
    return <Login onLogin={setUser} />
  }

  function handleLogout() {
    if (!window.confirm('로그아웃 하시겠습니까?')) return
    clearSession()
    setUser(null)
  }

  async function updateCategoryList(type, nextList) {
    const nextCategories = { ...categories, [type]: nextList }
    const { error } = await supabase.from('households').update({ categories: nextCategories }).eq('id', householdId)
    if (error) {
      setError(error.message)
      return
    }
    const next = { ...user, categories: nextCategories }
    saveSession(next)
    setUser(next)
  }

  function handleAddCategory(type, name) {
    if (categories[type].includes(name)) return
    updateCategoryList(type, [...categories[type], name])
  }

  function handleRemoveCategory(type, name) {
    updateCategoryList(type, categories[type].filter((c) => c !== name))
  }

  function handleMoveCategory(type, name, direction) {
    const list = categories[type]
    const index = list.indexOf(name)
    const targetIndex = index + direction
    if (index < 0 || targetIndex < 0 || targetIndex >= list.length) return
    const next = [...list]
    ;[next[index], next[targetIndex]] = [next[targetIndex], next[index]]
    updateCategoryList(type, next)
  }

  return (
    <div>
      <div className="brand-header">
        <h1>{user.members.length === 2 ? `${shortName(user.members[0])} ❤️ ${shortName(user.members[1])}` : shortName(user.members[0])}</h1>
        <span>가계부</span>
      </div>

      <AnniversaryBanner datingStart={user.datingStart} weddingDate={user.weddingDate} />

      <div style={{ textAlign: 'center', padding: '8px 16px 0', fontSize: 13, color: '#c0a3b0' }}>
        {myName}님 반가워요 🌸
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '8px 16px', fontSize: 13, color: '#c0a3b0', position: 'relative' }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            onClick={() => window.location.reload()}
            style={{ border: 'none', background: 'none', color: '#a89cc4', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: '"Jua", sans-serif' }}
          >
            🔄 새로고침
          </button>
          <button
            onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
            style={{ border: 'none', background: 'none', color: '#a89cc4', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: '"Jua", sans-serif' }}
          >
            {theme === 'dark' ? '☀️ 라이트모드' : '🌙 다크모드'}
          </button>
          <button
            onClick={() => setShowMoreMenu((prev) => !prev)}
            style={{ border: 'none', background: 'none', color: '#a89cc4', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: '"Jua", sans-serif' }}
          >
            ⋯ 더보기
          </button>
        </div>
        {showMoreMenu && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              marginTop: 4,
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              background: 'var(--card-bg)',
              borderRadius: 12,
              boxShadow: '0 2px 8px var(--card-shadow)',
              padding: 8,
              zIndex: 10,
            }}
          >
            <button
              onClick={() => {
                setShowMoreMenu(false)
                handleExportAll()
              }}
              disabled={exporting}
              style={{ border: 'none', background: 'none', color: '#7ec8a0', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: '"Jua", sans-serif', padding: '4px 12px', textAlign: 'left' }}
            >
              {exporting ? '내보내는 중...' : '데이터 백업'}
            </button>
            <button
              onClick={() => {
                setShowMoreMenu(false)
                setShowPasswordForm((prev) => !prev)
              }}
              style={{ border: 'none', background: 'none', color: '#b896ff', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: '"Jua", sans-serif', padding: '4px 12px', textAlign: 'left' }}
            >
              내 정보 변경
            </button>
            <button
              onClick={handleLogout}
              style={{ border: 'none', background: 'none', color: '#ff8fab', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: '"Jua", sans-serif', padding: '4px 12px', textAlign: 'left' }}
            >
              로그아웃
            </button>
          </div>
        )}
      </div>

      {showPasswordForm && (
        <ChangePassword
          user={user}
          onClose={() => setShowPasswordForm(false)}
          onUpdateSession={(fields) => {
            const next = { ...user, ...fields }
            saveSession(next)
            setUser(next)
          }}
        />
      )}

      <div className="page-tabs">
        <button className={page === 'transactions' ? 'active' : ''} onClick={() => setPage('transactions')}>
          내역
        </button>
        <button className={page === 'assets' ? 'active' : ''} onClick={() => setPage('assets')}>
          자산
        </button>
      </div>

      {page === 'assets' ? (
        <AssetsPage
          currentUser={myName}
          owners={owners}
          householdId={householdId}
          categories={categories.asset}
          onAddCategory={(name) => handleAddCategory('asset', name)}
          onRemoveCategory={(name) => handleRemoveCategory('asset', name)}
          onMoveCategory={(name, direction) => handleMoveCategory('asset', name, direction)}
        />
      ) : (
        <>
          <div className="month-nav">
            <button onClick={() => changeMonth(-1)}>‹</button>
            <h2>
              {cursor.year}년 {cursor.month + 1}월
            </h2>
            <button onClick={() => changeMonth(1)}>›</button>
          </div>

          <div className="owner-tabs">
            {['전체', ...owners].map((o) => (
              <button key={o} className={ownerFilter === o ? 'active' : ''} onClick={() => setOwnerFilter(o)}>
                {o}
              </button>
            ))}
          </div>

          <div className="summary">
            <div className="summary-item income">
              <div className="label">수입</div>
              <div className="value">{formatAmount(totalIncome)}</div>
            </div>
            <div className="summary-item expense">
              <div className="label">지출</div>
              <div className="value">{formatAmount(totalExpense)}</div>
            </div>
            <div className="summary-item balance">
              <div className="label">합계</div>
              <div className="value">{formatAmount(balance)}</div>
            </div>
          </div>

          {transferReceived > 0 && (
            <div className="summary">
              <div className="summary-item income">
                <div className="label">💸 받은 이체</div>
                <div className="value">{formatAmount(transferReceived)}</div>
              </div>
            </div>
          )}

          <ExpenseChart transactions={ownedTransactions} />

          <MonthComparison
            current={{ income: totalIncome, expense: totalExpense, balance }}
            previous={{ income: prevIncome, expense: prevExpense, balance: prevBalance }}
          />

          {ownerFilter === '전체' || ownerFilter === '공동' || ownerFilter === myName ? (
            <Collapsible title="내역 추가">
              <TransactionForm
                onAdd={handleAdd}
                currentUser={myName}
                owners={owners}
                assets={linkableAssets}
                categories={categories}
                onAddCategory={handleAddCategory}
                onRemoveCategory={handleRemoveCategory}
                onMoveCategory={handleMoveCategory}
              />
            </Collapsible>
          ) : null}

          {error && <div className="container" style={{ color: '#e0524c' }}>오류: {error}</div>}

          {loading ? (
            <div className="container">불러오는 중...</div>
          ) : (
            <Collapsible
              title="내역"
              headerExtra={
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    type="text"
                    className="inline-search"
                    style={{ flex: 1 }}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="카테고리 또는 메모 검색"
                  />
                  <button
                    type="button"
                    onClick={() => setShowFilters((prev) => !prev)}
                    className="filter-toggle-btn"
                    style={hasActiveFilters ? { background: 'var(--active-gradient)', color: '#fff' } : undefined}
                  >
                    필터
                  </button>
                </div>
              }
            >
              {showFilters && (
                <div className="filter-panel">
                  <div className="filter-row">
                    <input
                      type="date"
                      className="inline-search"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                    />
                    <span className="filter-sep">~</span>
                    <input
                      type="date"
                      className="inline-search"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                    />
                  </div>
                  <div className="filter-row">
                    <input
                      type="number"
                      inputMode="numeric"
                      className="inline-search"
                      placeholder="최소 금액"
                      value={amountMin}
                      onChange={(e) => setAmountMin(e.target.value)}
                    />
                    <span className="filter-sep">~</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      className="inline-search"
                      placeholder="최대 금액"
                      value={amountMax}
                      onChange={(e) => setAmountMax(e.target.value)}
                    />
                  </div>
                  {hasActiveFilters && (
                    <button type="button" className="filter-clear-btn" onClick={clearFilters}>
                      필터 초기화
                    </button>
                  )}
                </div>
              )}
              <TransactionList
                transactions={filteredTransactions}
                onDelete={handleDelete}
                onUpdate={handleUpdateTransaction}
                assets={linkableAssets}
                owners={owners}
                categories={categories}
                onAddCategory={handleAddCategory}
                onRemoveCategory={handleRemoveCategory}
              />
            </Collapsible>
          )}

          <RecurringTemplates
            currentUser={myName}
            owners={owners}
            householdId={householdId}
            assets={linkableAssets}
            categories={categories}
            onAddCategory={handleAddCategory}
            onRemoveCategory={handleRemoveCategory}
            onUndo={handleDelete}
            onQuickAdd={(t) =>
              handleAdd({
                type: t.type,
                category: t.category,
                amount: t.amount,
                memo: t.memo,
                author: t.author,
                owner: t.author,
                date: new Date().toISOString().slice(0, 10),
                linked_asset_id: t.linked_asset_id ?? null,
              })
            }
          />

          <Collapsible title="거래 캘린더">
            <TransactionCalendar
              transactions={ownedTransactions}
              year={cursor.year}
              month={cursor.month}
              onDeleteDate={handleDelete}
              onChangeMonth={changeMonth}
            />
          </Collapsible>

          <TransactionInsight
            transactions={ownedTransactions}
            totalIncome={totalIncome}
            totalExpense={totalExpense}
            balance={balance}
            monthLabel={`${cursor.year}년 ${cursor.month + 1}월`}
          />
        </>
      )}
    </div>
  )
}
