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
import { AUTH_KEY } from './users'
import { OWNERS } from './assetMeta'

const PAGE_KEY = 'household-budget-page'

function formatAmount(n) {
  return n.toLocaleString('ko-KR')
}

function monthRange(year, month) {
  const start = new Date(year, month, 1)
  const end = new Date(year, month + 1, 1)
  const toStr = (d) => d.toISOString().slice(0, 10)
  return { start: toStr(start), end: toStr(end) }
}

export default function App() {
  const [user, setUser] = useState(() => localStorage.getItem(AUTH_KEY))
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
  const [ownerFilter, setOwnerFilter] = useState('전체')
  const [showPasswordForm, setShowPasswordForm] = useState(false)

  const { start, end } = useMemo(() => monthRange(cursor.year, cursor.month), [cursor])
  const { start: prevStart, end: prevEnd } = useMemo(
    () => monthRange(cursor.year, cursor.month - 1),
    [cursor],
  )

  useEffect(() => {
    localStorage.setItem(PAGE_KEY, page)
  }, [page])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
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
  }, [start, end])

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .gte('date', prevStart)
        .lt('date', prevEnd)
      if (cancelled) return
      if (!error) setPrevTransactions(data)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [prevStart, prevEnd])

  async function handleAdd(tx) {
    const { data, error } = await supabase
      .from('transactions')
      .insert({ ...tx, author: tx.author || user })
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
    return data
  }

  async function handleDelete(id) {
    const { error } = await supabase.from('transactions').delete().eq('id', id)
    if (error) {
      setError(error.message)
      return
    }
    setTransactions((prev) => prev.filter((t) => t.id !== id))
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

  const totalIncome = ownedTransactions.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const totalExpense = ownedTransactions.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
  const balance = totalIncome - totalExpense

  const prevIncome = ownedPrevTransactions.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const prevExpense = ownedPrevTransactions.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
  const prevBalance = prevIncome - prevExpense

  const filteredTransactions = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return ownedTransactions
    return ownedTransactions.filter(
      (t) => t.category.toLowerCase().includes(q) || (t.memo && t.memo.toLowerCase().includes(q)),
    )
  }, [ownedTransactions, search])

  if (!user) {
    return <Login onLogin={setUser} />
  }

  function handleLogout() {
    localStorage.removeItem(AUTH_KEY)
    setUser(null)
  }

  return (
    <div>
      <div className="brand-header">
        <h1>태환 ❤️ 진주</h1>
        <span>가계부</span>
      </div>

      <AnniversaryBanner />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 16px', fontSize: 13, color: '#c0a3b0' }}>
        <span>{user}님 반가워요 🌸</span>
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={() => setShowPasswordForm((prev) => !prev)}
            style={{ border: 'none', background: 'none', color: '#b896ff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
          >
            비밀번호 변경
          </button>
          <button
            onClick={handleLogout}
            style={{ border: 'none', background: 'none', color: '#ff8fab', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
          >
            로그아웃
          </button>
        </div>
      </div>

      {showPasswordForm && <ChangePassword user={user} onClose={() => setShowPasswordForm(false)} />}

      <div className="page-tabs">
        <button className={page === 'transactions' ? 'active' : ''} onClick={() => setPage('transactions')}>
          내역
        </button>
        <button className={page === 'assets' ? 'active' : ''} onClick={() => setPage('assets')}>
          자산
        </button>
      </div>

      {page === 'assets' ? (
        <AssetsPage />
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
            {['전체', ...OWNERS].map((o) => (
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

          <MonthComparison
            current={{ income: totalIncome, expense: totalExpense, balance }}
            previous={{ income: prevIncome, expense: prevExpense, balance: prevBalance }}
          />

          <ExpenseChart transactions={ownedTransactions} />

          <RecurringTemplates
            currentUser={user}
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
              })
            }
          />

          <TransactionForm onAdd={handleAdd} currentUser={user} />

          <div className="search-bar">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="카테고리 또는 메모 검색"
            />
          </div>

          {error && <div className="container" style={{ color: '#e0524c' }}>오류: {error}</div>}

          {loading ? (
            <div className="container">불러오는 중...</div>
          ) : (
            <TransactionList transactions={filteredTransactions} onDelete={handleDelete} />
          )}
        </>
      )}
    </div>
  )
}
