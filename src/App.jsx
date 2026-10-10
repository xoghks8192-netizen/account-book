import { useMoney, usePrivacy, setMoneyHidden } from './lib/privacy'
import BackupRestore from './components/BackupRestore'
import { exportLegacyCsv } from './lib/backupExport'
import ProblemNotice from './components/ProblemNotice'
import { reportProblem } from './lib/diagnostics'
import { todayKst, currentMonth, monthRange } from './lib/dates'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from './lib/supabase'
import TransactionForm from './components/TransactionForm'
import TransactionList from './components/TransactionList'
import Login from './components/Login'
import AnniversaryBanner from './components/AnniversaryBanner'
import AssetsPage from './components/AssetsPage'
import ExpenseChart from './components/ExpenseChart'
import RecurringTemplates from './components/RecurringTemplates'
import ChangePassword from './components/ChangePassword'
import Collapsible from './components/Collapsible'
import TransactionInsight from './components/TransactionInsight'
import TransactionCalendar from './components/TransactionCalendar'
import Modal from './components/Modal'
import MonthlyTrendChart from './components/MonthlyTrendChart'

import { saveSession, clearSession } from './users'
import { STOCK_CATEGORIES } from './assetMeta'
import { DEFAULT_CATEGORIES, TRANSFER_CATEGORY } from './categories'
import PinLock from './components/PinLock'
import ConfirmDialog from './components/ConfirmDialog'
import { useCountUp } from './hooks/useCountUp'
import { useTransactions } from './hooks/useTransactions'
import { isTransfer, summarizeResults, copyTransaction, backupStorageKey, formatExportTime } from './lib/ledgerView'
import TransferSummary from './components/TransferSummary'
import AppSplash from './components/AppSplash'
import HeaderIcon from './components/HeaderIcon'

const PAGE_KEY = 'household-budget-page'
const THEME_KEY = 'household-budget-theme'
const COLOR_KEY = 'household-budget-color'


function shortName(name) {
  return name.length >= 3 ? name.slice(1) : name
}


export default function App() {
  const formatAmount = useMoney()
  const moneyHidden = usePrivacy()
  const [showRestore,setShowRestore] = useState(false)
  const [showDiagnostics,setShowDiagnostics] = useState(false)
  const [dataVersion,setDataVersion] = useState(0)
  useEffect(()=>{document.documentElement.dataset.moneyHidden=moneyHidden?'true':'false'},[moneyHidden])
  const [pinLocked, setPinLocked] = useState(() =>
    !!localStorage.getItem('app_pin') && !sessionStorage.getItem('pin_unlocked'),
  )
  const hiddenAt = useRef(null)

  function unlockPin() {
    sessionStorage.setItem('pin_unlocked', '1')
    setPinLocked(false)
  }

  useEffect(() => {
    function handleVisibility() {
      if (document.hidden) {
        hiddenAt.current = Date.now()
      } else {
        if (localStorage.getItem('app_pin') && hiddenAt.current && Date.now() - hiddenAt.current > 30000) {
          sessionStorage.removeItem('pin_unlocked')
          setPinLocked(true)
        }
        hiddenAt.current = null
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  const [user, setUser] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [authError, setAuthError] = useState('')
  useEffect(() => {
    let cancelled = false
    fetch('/api/login', { credentials:'same-origin', cache:'no-store' })
      .then(async res => {
        if (res.status === 401) { clearSession(); return null }
        const data = await res.json()
        if (!res.ok) { reportProblem('login',res.status,data.code); throw new Error(data.error || '로그인 상태를 확인하지 못했습니다.') }
        return data
      })
      .then(data => { if (!cancelled && data) { saveSession(data); setUser(data) } })
      .catch(() => { reportProblem('login'); if (!cancelled) setAuthError('서버에 연결하지 못했어요. 연결 상태를 확인한 뒤 다시 시도해주세요.') })
      .finally(() => { if (!cancelled) setAuthReady(true) })
    const expired = () => { clearSession(); setUser(null); setShowPasswordForm(false) }
    window.addEventListener('hb-session-expired', expired)
    return () => { cancelled = true; window.removeEventListener('hb-session-expired', expired) }
  }, [])
  const isReload = performance.getEntriesByType('navigation')[0]?.type === 'reload'
  const [splashDone, setSplashDone] = useState(isReload)

  useEffect(() => {
    if (isReload) return
    const t = setTimeout(() => setSplashDone(true), 400)
    return () => clearTimeout(t)
  }, [])
  const [page, setPage] = useState(() => localStorage.getItem(PAGE_KEY) === 'assets' ? 'assets' : 'transactions')
  const [slideDir, setSlideDir] = useState(null)
  const PAGE_ORDER = ['transactions', 'assets']
  function navigateTo(next) {
    if (next === page) return
    const dir = PAGE_ORDER.indexOf(next) > PAGE_ORDER.indexOf(page) ? 'left' : 'right'
    setSlideDir(dir)
    setPage(next)
    setTimeout(() => setSlideDir(null), 350)
  }
  const [cursor, setCursor] = useState(() => {
    return currentMonth()
  })
  const [lastAddedTxId, setLastAddedTxId] = useState(null)
  const [showPinSetup, setShowPinSetup] = useState(false)
  const [hasPin, setHasPin] = useState(!!localStorage.getItem('app_pin'))
  const [formOpenToken, setFormOpenToken] = useState(0)
  const [entryPanel, setEntryPanel] = useState(null)
  const [ledgerView, setLedgerView] = useState('list')
  useEffect(() => { if (formOpenToken) setEntryPanel('add') }, [formOpenToken])
  const formRef = useRef(null)
  const assetsPageRef = useRef(null)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  useEffect(() => {
    const on = () => setIsOnline(true)
    const off = () => setIsOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])
  const [search, setSearch] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [amountMin, setAmountMin] = useState('')
  const [amountMax, setAmountMax] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [ownerFilter, setOwnerFilter] = useState('전체')
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [assetSnapshot, setAssetSnapshot] = useState(null)
  const [exporting, setExporting] = useState(false)
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || 'light')
  const [colorTheme, setColorTheme] = useState(() => localStorage.getItem(COLOR_KEY) || 'purple')
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const moreMenuRef = useRef(null)
  const [showMonthPicker, setShowMonthPicker] = useState(false)

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [summaryModal, setSummaryModal] = useState(null)
  const [showTransfers, setShowTransfers] = useState(false)
  const [copyCandidate, setCopyCandidate] = useState(null)
  const [copyDraft, setCopyDraft] = useState(null)
  const [lastExport, setLastExport] = useState(null)
  const [expandedCategory, setExpandedCategory] = useState(null)

  function toggleCategory(cat) {
    setExpandedCategory((prev) => (prev === cat ? null : cat))
  }
  const [toast, setToast] = useState('')
  const [toastAction, setToastAction] = useState(null)
  const [toastBusy, setToastBusy] = useState(false)
  const toastTimer = useRef(null)
  const actionBusy = useRef(false)
  useEffect(() => () => clearTimeout(toastTimer.current), [])
  const [duplicatePrompt, setDuplicatePrompt] = useState(false)
  const duplicateAnswer = useRef(null)
  const checkingDuplicate = useRef(false)
  function answerDuplicate(yes) {
    setDuplicatePrompt(false)
    duplicateAnswer.current?.(yes)
    duplicateAnswer.current = null
  }
  useEffect(() => () => duplicateAnswer.current?.(false), [])
  const [formCloseToken, setFormCloseToken] = useState(0)
  useEffect(() => { if (formCloseToken) setEntryPanel(null) }, [formCloseToken])

  useEffect(() => {
    if (!showMoreMenu) return
    function handleOutside(e) {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target)) {
        setShowMoreMenu(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('touchstart', handleOutside)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('touchstart', handleOutside)
    }
  }, [showMoreMenu])

  function showToast(msg, action = null) {
    clearTimeout(toastTimer.current)
    setToast(msg)
    setToastAction(action ? { run: action } : null)
    navigator.vibrate?.(40)
    toastTimer.current = setTimeout(() => { setToast(''); setToastAction(null) }, action ? 10000 : 2500)
  }
  async function runToastAction() {
    if (actionBusy.current || !toastAction) return
    actionBusy.current = true; setToastBusy(true)
    clearTimeout(toastTimer.current)
    try { await toastAction.run() }
    finally { actionBusy.current = false; setToastBusy(false) }
  }

  function handleAddSuccess() {
    setCopyDraft(null)
    setFormCloseToken((n) => n + 1)
    showToast('✓ 내역이 추가되었습니다')
  }

  const householdId = user?.householdId
  const myName = user?.displayName
  const owners = [...(user?.members ?? []), '공동']
  // Memory only, scoped to the verified account and restore generation.
  const assetScope = JSON.stringify([householdId, user?.username, dataVersion])
  const activeAssetScope = useRef(assetScope)
  activeAssetScope.current = assetScope
  const cachedAssets = assetSnapshot?.scope === assetScope ? assetSnapshot.rows : null
  const linkableAssets = (cachedAssets || []).filter(a => !a.deleted_at && !STOCK_CATEGORIES.includes(a.category))
  const receiveAssets = useCallback(rows => {
    if (activeAssetScope.current === assetScope) setAssetSnapshot({ scope: assetScope, rows })
  }, [assetScope])
  useEffect(() => { if (!householdId) setAssetSnapshot(null) }, [householdId])
  const exportKey = backupStorageKey(householdId, user?.username)
  useEffect(() => {
    try { setLastExport(localStorage.getItem(exportKey)) } catch { setLastExport(null) }
    setCopyCandidate(null); setCopyDraft(null); setShowTransfers(false)
  }, [exportKey])
  function recordExport() {
    const value = new Date().toISOString()
    try { localStorage.setItem(exportKey, value) } catch {}
    setLastExport(value)
  }
  function requestCopy(tx) {
    if (['saving','checking','uncertain'].includes(mutationState.status)) { showToast('앞선 저장 요청을 먼저 확인해주세요.'); return }
    try { setCopyCandidate(copyTransaction(tx, owners, linkableAssets)) }
    catch(e) { showToast(e.message) }
  }
  function confirmCopy() {
    setCopyDraft({ ...copyCandidate, token:crypto.randomUUID() })
    setCopyCandidate(null)
    setOwnerFilter('전체')
    setFormOpenToken(n => n + 1)
    showToast('추가 폼에 복사했어요. 날짜를 확인한 뒤 저장해주세요.')
  }
  const { start, end } = useMemo(() => monthRange(cursor.year, cursor.month), [cursor])
  const { start: prevStart, end: prevEnd } = useMemo(() => monthRange(cursor.year, cursor.month - 1), [cursor])
  const rawCategories = { ...DEFAULT_CATEGORIES, ...(user?.categories ?? {}) }
  const categories = {
    ...rawCategories,
    income: rawCategories.income.includes(TRANSFER_CATEGORY)
      ? rawCategories.income
      : [...rawCategories.income, TRANSFER_CATEGORY],
  }

  const {
    transactions, prevTransactions, loading, error, setError,
    handleAdd: _handleAdd, handleDelete, handleUpdate: handleUpdateTransaction,
    mutationState, retryMutation, refresh:refreshTransactions,
    lastDelete, undoDelete,
  } = useTransactions({ householdId, start, end, prevStart, prevEnd, owners, myName })
  useEffect(() => {
    if (!lastDelete) return
    showToast('내역을 삭제했어요', async () => {
      const ok = await undoDelete(lastDelete.requestId)
      showToast(ok ? '삭제를 취소했어요. 연결된 이체도 복구됐어요.' : '취소 결과를 확인해주세요. 상단 안내에서 다시 확인할 수 있어요.')
    })
  }, [lastDelete])

  useEffect(() => {
    localStorage.setItem(PAGE_KEY, page)
  }, [page])

  // Session verification already returns fresh categories and anniversary dates.

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  useEffect(() => {
    if (colorTheme === 'purple') {
      document.documentElement.removeAttribute('data-color')
    } else {
      document.documentElement.setAttribute('data-color', colorTheme)
    }
    localStorage.setItem(COLOR_KEY, colorTheme)
  }, [colorTheme])

  useEffect(() => {
    if (!householdId || page !== 'transactions') return
    let cancelled = false
    async function load() {
      const { data, error } = await supabase
        .from('assets')
        .select('*')
        .eq('household_id', householdId)
        .order('id', { ascending: true })
      if (!cancelled && !error) {
        receiveAssets(data)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [page, householdId, receiveAssets])

  async function handleAdd(tx) {
    if (checkingDuplicate.current) return null
    checkingDuplicate.current = true
    try {
      const { data, error } = await supabase.from('transactions').select('id')
        .eq('household_id', householdId).eq('date', tx.date).eq('type', tx.type)
        .eq('owner', tx.owner).eq('category', tx.category).eq('amount', Number(tx.amount)).limit(1)
      if (error) { showToast('중복 내역을 확인하지 못했어요. 입력을 유지했으니 다시 시도해주세요.'); return null }
      if (data.length) {
        const agreed = await new Promise(resolve => { duplicateAnswer.current = resolve; setDuplicatePrompt(true) })
        if (!agreed) return null
      }
      return await _handleAdd(tx)
    } finally { checkingDuplicate.current = false }
  }

  async function wrappedDelete(id) {
    const ok = await handleDelete(id)
    if (ok !== false) showToast('🗑 내역이 삭제되었습니다')
    return ok
  }

  async function wrappedUpdate(id, fields) {
    const ok = await handleUpdateTransaction(id, fields)
    if (ok) showToast('✓ 내역이 수정되었습니다')
    return ok
  }

  const [monthSlideDir, setMonthSlideDir] = useState(null)

  function changeMonth(delta) {
    const dir = delta > 0 ? 'left' : 'right'
    setMonthSlideDir(dir)
    setTimeout(() => setMonthSlideDir(null), 350)
    setCursor((prev) => {
      const d = new Date(prev.year, prev.month + delta, 1)
      return { year: d.getFullYear(), month: d.getMonth() }
    })
  }

  const monthSwipeStart = useRef(null)

  function handleMonthSwipeStart(e) {
    monthSwipeStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }

  function handleMonthSwipeEnd(e) {
    if (!monthSwipeStart.current) return
    const startX = monthSwipeStart.current.x
    const dx = e.changedTouches[0].clientX - startX
    const dy = e.changedTouches[0].clientY - monthSwipeStart.current.y
    monthSwipeStart.current = null
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return
    const target = e.changedTouches[0].target
    if (target.closest('.tx-item')) return
    // 화면 엣지(30px)에서 시작한 스와이프 → 탭 전환
    const screenW = window.innerWidth
    if (startX < 30 && dx > 60) { navigateTo('transactions'); return }
    if (startX > screenW - 30 && dx < -60) { navigateTo('assets'); return }
    // 내역 탭에서만 월 전환
    if (page !== 'transactions') return
    if (Math.abs(dx) < 80) return
    changeMonth(dx < 0 ? 1 : -1)
  }

  const ownedTransactions =
    ownerFilter === '전체' ? transactions : transactions.filter((t) => t.owner === ownerFilter)
  const ownedPrevTransactions =
    ownerFilter === '전체' ? prevTransactions : prevTransactions.filter((t) => t.owner === ownerFilter)

  const totals = summarizeResults(ownedTransactions)
  const totalIncome = totals.income
  const totalExpense = totals.expense
  const balance = totalIncome - totalExpense

  const animatedIncome = useCountUp(totalIncome)
  const animatedExpense = useCountUp(totalExpense)
  const animatedBalance = useCountUp(balance)
  const transferReceived = totals.received

  const transferSent =
    ownerFilter !== '전체' && ownerFilter !== '공동'
      ? totals.sent
      : 0

  function groupByCategory(items) {
    return items.reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + Number(t.amount)
      return acc
    }, {})
  }

  const incomeByCategory = groupByCategory(
    ownedTransactions.filter((t) => t.type === 'income' && !isTransfer(t)),
  )
  const expenseByCategory = groupByCategory(ownedTransactions.filter((t) => t.type === 'expense' && !isTransfer(t)))

  const previousTotals = summarizeResults(ownedPrevTransactions)
  const prevIncome = previousTotals.income
  const prevExpense = previousTotals.expense
  const prevBalance = prevIncome - prevExpense

  const filteredTransactions = useMemo(() => {
    const q = search.trim().toLowerCase()
    const min = amountMin ? Number(amountMin) : null
    const max = amountMax ? Number(amountMax) : null
    return ownedTransactions.filter((t) => {
      if (q && !(t.category.toLowerCase().includes(q) || (t.memo && t.memo.toLowerCase().includes(q)) || String(t.amount).includes(q))) return false
      if (min !== null && Number(t.amount) < min) return false
      if (max !== null && Number(t.amount) > max) return false
      if (dateFrom && t.date < dateFrom) return false
      if (dateTo && t.date > dateTo) return false
      return true
    })
  }, [ownedTransactions, search, amountMin, amountMax, dateFrom, dateTo])

  const hasActiveFilters = amountMin || amountMax || dateFrom || dateTo
  const isFiltered = !!(search.trim() || hasActiveFilters)
  const resultSummary = summarizeResults(filteredTransactions)

  function clearFilters() {
    setAmountMin('')
    setAmountMax('')
    setDateFrom('')
    setDateTo('')
  }

  async function handleExportAll() {
    if(!window.confirm('백업 파일에는 거래와 자산 정보가 포함됩니다. 이 계정에서 볼 수 있는 데이터만 내려받습니다. 저장할까요?')) return
    setExporting(true)
    try {
      const res=await fetch('/api/data',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'backup-export'})})
      const file=await res.json()
      if(file.code==='BACKUP_SETUP_REQUIRED') {
        await exportLegacyCsv(householdId)
        recordExport()
        showToast('기존 CSV로 백업했어요. JSON 복원은 SQL 024 적용 후 가능해요.')
        return
      }
      if(!res.ok){reportProblem('backup',res.status);throw new Error(file.message||file.error||'백업에 실패했습니다.')}
      const url=URL.createObjectURL(new Blob([JSON.stringify(file)],{type:'application/json'}))
      const a=document.createElement('a')
      a.href=url;a.download='가계부_백업_'+todayKst()+'.json';a.click()
      recordExport()
      setTimeout(()=>URL.revokeObjectURL(url),1000)
      showToast('백업 파일을 내려받았어요')
    }catch(e){reportProblem('backup');showToast(e.message||'백업하지 못했습니다. 다시 시도해주세요.')}
    finally{setExporting(false)}
  }
  function restored() {
    refreshTransactions()
    setDataVersion(n=>n+1)
    showToast('백업 복원 결과를 확인했어요')
  }
  async function retrySave() {
    const result=await retryMutation()
    if(result?.action==='add') handleAddSuccess()
    else if(result)showToast('처리 결과를 확인했어요')
  }

  if (!authReady || authError) {
    return authError ? <div className="container"><ProblemNotice message={authError} onRetry={()=>window.location.reload()}/></div> : <AppSplash />
  }
  if (!user) {
    return <Login onLogin={setUser} />
  }

  if (!splashDone) return <AppSplash />

  if (pinLocked) {
    return <PinLock mode="unlock" onUnlock={unlockPin} />
  }

  async function handleLogout() {
    try {
      const res = await fetch('/api/login', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'logout'})})
      if (!res.ok) throw new Error()
      clearSession()
      setUser(null)
      setShowPasswordForm(false)
    } catch { showToast('로그아웃하지 못했어요. 다시 시도해주세요.') }
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
        <div className="brand-header-left">
          <button className="header-icon-btn" onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))} title="테마 변경" aria-label={theme === 'dark' ? '라이트 모드로 변경' : '다크 모드로 변경'}>
            <HeaderIcon name={theme === 'dark' ? 'sun' : 'moon'} />
          </button>
        </div>
        <h1>{user.members.length === 2 ? `${shortName(user.members[0])} ❤️ ${shortName(user.members[1])}` : shortName(user.members[0])}</h1>
        <div className="brand-header-actions">
          <button className="header-icon-btn privacy-toggle" onClick={()=>setMoneyHidden(!moneyHidden)} aria-label={moneyHidden?'금액 보이기':'금액 숨기기'} title={moneyHidden?'금액 보이기':'금액 숨기기'} aria-pressed={moneyHidden}>
            <HeaderIcon name={moneyHidden ? 'eye-off' : 'eye'} />
          </button>
          <button className="header-icon-btn" onClick={() => setShowMoreMenu((prev) => !prev)} title="설정" aria-label="설정" aria-expanded={showMoreMenu}>
            <HeaderIcon name="settings" />
          </button>
        </div>
        {showMoreMenu && (
          <div className="more-menu" ref={moreMenuRef}>
            <div className="more-menu-color-section">
              <span className="more-menu-color-label">테마 색상</span>
              <div className="more-menu-color-swatches">
                {[
                  { id: 'purple', color: '#b896ff', label: '보라' },
                  { id: 'pink',   color: '#ff85b3', label: '핑크' },
                  { id: 'mint',   color: '#56c97a', label: '민트' },
                  { id: 'blue',   color: '#5ba4ef', label: '블루' },
                  { id: 'coral',  color: '#ff8c69', label: '코랄' },
                ].map(({ id, color, label }) => (
                  <button
                    key={id}
                    className={`color-swatch${colorTheme === id ? ' selected' : ''}`}
                    style={{ background: color }}
                    title={label}
                    onClick={() => { setColorTheme(id); setShowMoreMenu(false) }}
                  />
                ))}
              </div>
            </div>
            <div className="more-menu-divider" />
            <div className="more-menu-group">
              <button className="more-menu-item" onClick={() => window.location.reload()}><span className="more-menu-icon">↻</span>새로고침</button>
              <p className="auto-sync-hint">화면을 보고 있을 때 15초마다 자동 확인해요</p>
<button className="more-menu-item" onClick={() => { setShowMoreMenu(false); handleExportAll() }} disabled={exporting}>
                <span className="more-menu-icon" style={{ background: '#e8f8ef', color: '#4caf7d' }}>💾</span>
                {exporting ? '내보내는 중...' : '데이터 백업'}
              </button>
              <p className="backup-history">마지막 내보내기: {formatExportTime(lastExport)}<br/><small>이 기기·계정의 요청 기록이에요. 파일 저장 여부는 다운로드 목록에서 확인해주세요.</small></p>
              <button className="more-menu-item" onClick={()=>{setShowMoreMenu(false);setShowRestore(true)}}><span className="more-menu-icon">↥</span>백업 복원</button>
              <button className="more-menu-item" onClick={()=>{setShowMoreMenu(false);setShowDiagnostics(true)}}><span className="more-menu-icon">ⓘ</span>문제 진단</button>
              <button className="more-menu-item" onClick={() => setShowPasswordForm((prev) => !prev)}>
                <span className="more-menu-icon" style={{ background: '#f0ebff', color: '#9b6ff5' }}>👤</span>
                내 정보 변경
              </button>
            </div>
            <div className="more-menu-divider" />
            <div className="more-menu-group">
              <button className="more-menu-item" onClick={() => { setShowMoreMenu(false); setShowPinSetup(true) }}>
                <span className="more-menu-icon" style={{ background: '#fff3e6', color: '#f0a05a' }}>🔒</span>
                {hasPin ? 'PIN 변경' : 'PIN 설정'}
              </button>
              {hasPin && (
                <button className="more-menu-item" onClick={() => { localStorage.removeItem('app_pin'); sessionStorage.removeItem('pin_unlocked'); setHasPin(false); setShowMoreMenu(false) }}>
                  <span className="more-menu-icon" style={{ background: '#f5f5f5', color: '#999' }}>🔓</span>
                  PIN 해제
                </button>
              )}
            </div>
            <div className="more-menu-divider" />
            <div className="more-menu-group">
              <button className="more-menu-item" onClick={() => { setShowMoreMenu(false); setShowLogoutConfirm(true) }}>
                <span className="more-menu-icon" style={{ background: '#fff0f3', color: '#ff6b8a' }}>🚪</span>
                로그아웃
              </button>
            </div>
          </div>
        )}
      </div>

      <AnniversaryBanner datingStart={user.datingStart} weddingDate={user.weddingDate} />
      {copyCandidate && <Modal title="내역 복사" onClose={() => setCopyCandidate(null)}>
        <p>금액·날짜·카테고리·메모를 추가 폼에 채울까요? 현재 작성 중인 추가 폼은 복사한 내용으로 바뀌며, 저장 버튼을 눌러야 등록됩니다.</p>
        {copyCandidate.category === TRANSFER_CATEGORY && <p className="view-note">보낸 이체를 저장하면 배우자 쪽 받은 이체도 함께 생성됩니다.</p>}
        <div className="confirm-actions"><button className="confirm-btn cancel" onClick={() => setCopyCandidate(null)}>취소</button><button className="confirm-btn" onClick={confirmCopy}>폼에 복사</button></div>
      </Modal>}
      {showTransfers && ownerFilter !== '전체' && ownerFilter !== '공동' && <TransferSummary rows={ownedTransactions} owner={ownerFilter} monthLabel={`${cursor.year}년 ${cursor.month+1}월`} onClose={() => setShowTransfers(false)}/>}
      {duplicatePrompt && <Modal title="같은 내역이 있어요" onClose={() => answerDuplicate(false)}>
        <p>날짜·금액·구분·소유자·카테고리가 같은 내역이 있어요. 별도의 거래라면 추가할 수 있습니다.</p>
        <div className="confirm-actions"><button className="confirm-btn cancel" onClick={() => answerDuplicate(false)}>돌아가기</button><button className="confirm-btn" onClick={() => answerDuplicate(true)}>그래도 추가</button></div>
      </Modal>}
      {showRestore&&<BackupRestore onClose={()=>setShowRestore(false)} onRestored={restored}/>}
      {showDiagnostics&&<Modal title="문제 진단" onClose={()=>setShowDiagnostics(false)}><ProblemNotice message="최근 연결 오류를 안전한 진단 코드로 확인할 수 있어요." onRetry={()=>{refreshTransactions();setDataVersion(n=>n+1);setShowDiagnostics(false)}}/></Modal>}
      {['saving','checking','uncertain','failed'].includes(mutationState.status)&&<section className="mutation-notice" role="status">
        <p>{mutationState.message}</p>
        {mutationState.status==='uncertain'&&<button type="button" onClick={retrySave}>같은 요청으로 다시 확인</button>}
      </section>}

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

      {showLogoutConfirm && (
        <ConfirmDialog
          message="로그아웃 하시겠습니까?"
          confirmLabel="로그아웃"
          onConfirm={handleLogout}
          onCancel={() => setShowLogoutConfirm(false)}
        />
      )}

      {showPinSetup && (
        <PinLock
          mode="setup"
          onUnlock={() => { setShowPinSetup(false); setHasPin(true) }}
          onCancel={() => setShowPinSetup(false)}
        />
      )}

      <div
        className={`page-slide${slideDir ? ` slide-${slideDir}` : ''}`}
        onTouchStart={handleMonthSwipeStart}
        onTouchEnd={handleMonthSwipeEnd}
      >
      {page === 'assets' ? (
        <AssetsPage key={assetScope} ref={assetsPageRef} initialAssets={cachedAssets} onAssetsChange={receiveAssets}
          username={user.username}
          currentUser={myName}
          owners={owners}
          householdId={householdId}
          categories={categories.asset}
          onAddCategory={(name) => handleAddCategory('asset', name)}
          onRemoveCategory={(name) => handleRemoveCategory('asset', name)}
          onMoveCategory={(name, direction) => handleMoveCategory('asset', name, direction)}
          onToast={showToast}
        />
      ) : (
        <div className={`month-content${monthSlideDir ? ` slide-${monthSlideDir}` : ''}`}>
          <div className="month-nav">
            <div className="month-nav-side" />
            <button className="month-nav-arrow" onClick={() => changeMonth(-1)}>‹</button>
            <button className="month-nav-pill" onClick={() => setShowMonthPicker((p) => !p)}>
              <span className="month-nav-month">{cursor.month + 1}월</span>
              <span className="month-nav-year">{cursor.year}</span>
            </button>
            <button className="month-nav-arrow" onClick={() => changeMonth(1)}>›</button>
            <div className="month-nav-side">
              {(() => { const now = currentMonth(); return (cursor.year !== now.year || cursor.month !== now.month) ? (
                <button className="month-nav-today" onClick={() => setCursor(now)}>오늘</button>
              ) : null })()}
            </div>
          </div>
          {showMonthPicker && (
            <div className="month-picker-overlay" onClick={() => setShowMonthPicker(false)}>
              <div className="month-picker" onClick={(e) => e.stopPropagation()}>
                <div className="month-picker-year-row">
                  <button onClick={() => setCursor((c) => ({ ...c, year: c.year - 1 }))}>‹</button>
                  <span>{cursor.year}년</span>
                  <button onClick={() => setCursor((c) => ({ ...c, year: c.year + 1 }))}>›</button>
                </div>
                <div className="month-picker-grid">
                  {Array.from({ length: 12 }, (_, i) => (
                    <button
                      key={i}
                      className={`month-picker-cell${cursor.month === i ? ' selected' : ''}`}
                      onClick={() => { setCursor((c) => ({ ...c, month: i })); setShowMonthPicker(false) }}
                    >
                      {i + 1}월
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="owner-tabs">
            {['전체', ...owners].map((o) => (
              <button key={o} className={ownerFilter === o ? 'active' : ''} onClick={() => setOwnerFilter(o)}>
                {o}
              </button>
            ))}
          </div>

          <div className="summary">
            <div className="summary-item income clickable" onClick={() => setSummaryModal('수입')}>
              <div className="label">수입</div>
          <div className="value" data-zero={totalIncome === 0}>{formatAmount(animatedIncome)}</div>
              {prevIncome > 0 && (() => { const d = totalIncome - prevIncome; return d !== 0 ? (
                <div className={`summary-diff ${d > 0 ? 'up' : 'down'}`}>{d > 0 ? '▲' : '▼'} {formatAmount(Math.abs(d))}</div>
              ) : null })()}
              {transferReceived > 0 && ownerFilter !== '전체' && (
                <div className="sub-label">💸 이체 +{formatAmount(transferReceived)}</div>
              )}
            </div>
            <div className="summary-item expense clickable" onClick={() => setSummaryModal('지출')}>
              <div className="label">지출</div>
          <div className="value" data-zero={totalExpense === 0}>{formatAmount(animatedExpense)}</div>
              {prevExpense > 0 && (() => { const d = totalExpense - prevExpense; return d !== 0 ? (
                <div className={`summary-diff ${d > 0 ? 'down' : 'up'}`}>{d > 0 ? '▲' : '▼'} {formatAmount(Math.abs(d))}</div>
              ) : null })()}
              {transferSent > 0 && (
                <div className="sub-label">💸 이체 -{formatAmount(transferSent)}</div>
              )}
            </div>
            <div className="summary-item balance">
              <div className="label">합계</div>
          <div className="value" data-zero={balance === 0}>{formatAmount(animatedBalance)}</div>
              {(prevIncome > 0 || prevExpense > 0) && (() => { const d = balance - prevBalance; return d !== 0 ? (
                <div className={`summary-diff ${d > 0 ? 'up' : 'down'}`}>{d > 0 ? '▲' : '▼'} {formatAmount(Math.abs(d))}</div>
              ) : null })()}
            </div>
          </div>

          {(summaryModal === '수입' || summaryModal === '지출') && (() => {
            const isIncome = summaryModal === '수입'
            const byCategory = isIncome ? incomeByCategory : expenseByCategory
            const total = isIncome ? totalIncome : totalExpense
            const txType = isIncome ? 'income' : 'expense'
            const txPool = ownedTransactions.filter((t) => t.type === txType && !isTransfer(t))
            return (
              <Modal title={summaryModal} onClose={() => { setSummaryModal(null); setExpandedCategory(null) }}>
                {Object.keys(byCategory).length === 0 ? (
<EmptyState message={<>{summaryModal} 내역이 없어요</>} />
                ) : (
                  Object.entries(byCategory)
                    .sort((a, b) => b[1] - a[1])
                    .map(([category, amount]) => {
                      const isOpen = expandedCategory === category
                      const items = txPool.filter((t) => t.category === category).sort((a, b) => b.date.localeCompare(a.date))
                      return (
                        <div key={category}>
                          <div
                            className="modal-row clickable"
                            onClick={() => toggleCategory(category)}
                            style={{ cursor: 'pointer' }}
                          >
                            <span className="modal-row-name">
                              {category}
                              <span style={{ fontSize: 10, marginLeft: 4, opacity: 0.5 }}>{isOpen ? '▲' : '▼'}</span>
                            </span>
                            <span className="modal-row-amount">{formatAmount(amount)}원</span>
                          </div>
                          {isOpen && items.map((t) => (
                            <div key={t.id} className="modal-row modal-subrow">
                              <span className="modal-row-name" style={{ fontSize: 12, color: 'var(--meta-text)' }}>
                                {t.date.slice(5).replace('-', '.')}
                                {t.memo ? ` · ${t.memo}` : ''}
                                {t.owner ? ` · ${t.owner}` : ''}
                              </span>
                              <span className="modal-row-amount" style={{ fontSize: 13 }}>{formatAmount(t.amount)}원</span>
                            </div>
                          ))}
                        </div>
                      )
                    })
                )}
                <div className="modal-total-row">
                  <span>합계</span>
                  <span className="modal-row-amount">{formatAmount(total)}원</span>
                </div>
              </Modal>
            )
          })()}

          <ExpenseChart transactions={ownedTransactions} />
          {ownerFilter !== '전체' && ownerFilter !== '공동' && <div className="transfer-entry"><button type="button" onClick={() => setShowTransfers(true)}>보낸 이체 · 받은 이체 보기 ↗</button></div>}

          <div className="ledger-workspace">
          <div className="ledger-actions">
            {(ownerFilter === '전체' || ownerFilter === '공동' || ownerFilter === myName) && <button type="button" aria-expanded={entryPanel === 'add'} aria-controls="ledger-add-panel" onClick={() => setEntryPanel(p => p === 'add' ? null : 'add')}><span>＋</span> 내역 추가</button>}
            <button type="button" aria-expanded={entryPanel === 'recurring'} aria-controls="ledger-recurring-panel" onClick={() => setEntryPanel(p => p === 'recurring' ? null : 'recurring')}><HeaderIcon name="calendar" /> 고정 지출/수입</button>
          </div>
          <div id="ledger-add-panel" className="ledger-input-panel" hidden={entryPanel !== 'add'}>
          {ownerFilter === '전체' || ownerFilter === '공동' || ownerFilter === myName ? (
            <Collapsible title="내역 추가" embedded>
              <TransactionForm mutationState={mutationState} onRetrySave={retrySave} copyDraft={copyDraft} transactions={transactions}
                ref={formRef}
                onAdd={handleAdd}
                onSuccess={handleAddSuccess}
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
          </div>

          <div id="ledger-recurring-panel" className="ledger-recurring-panel" hidden={entryPanel !== 'recurring'}>
          <RecurringTemplates
            embedded
            currentUser={myName}
            owners={owners}
            householdId={householdId}
            assets={linkableAssets}
            categories={categories}
            onAddCategory={handleAddCategory}
            onRemoveCategory={handleRemoveCategory}
            onUndo={wrappedDelete}
            onToast={showToast}
            currentMonthTransactions={transactions}
            onQuickAdd={(t) =>
              handleAdd({
                type: t.type,
                category: t.category,
                amount: t.amount,
                memo: t.memo,
                author: t.author,
                owner: t.author,
                date: todayKst(),
                linked_asset_id: t.linked_asset_id ?? null,
              })
            }
          />
          </div>
          <Collapsible title="내역 · 캘린더" className="ledger-browser analysis-section">
          <div className="ledger-view-switch" role="group" aria-label="내역 표시 방식">
            <button type="button" aria-pressed={ledgerView === 'list'} onClick={() => setLedgerView('list')}>내역</button>
            <button type="button" aria-pressed={ledgerView === 'calendar'} onClick={() => setLedgerView('calendar')}>캘린더</button>
          </div>
          {error && <ProblemNotice message="내역을 불러오지 못했어요. 연결 상태를 확인해주세요." onRetry={refreshTransactions}/>}
          <div hidden={ledgerView !== 'list'}>
          {loading ? (
            <div className="skeleton-list">
              {[1,2,3,4,5].map((i) => (
                <div key={i} className="skeleton-item">
                  <div className="skeleton-line short" />
                  <div className="skeleton-line long" />
                </div>
              ))}
            </div>
          ) : (
            <Collapsible
              embedded
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
                    <div className="date-input-wrapper">
                      <input
                        type="date"
                        className="inline-search"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                      />
                      {!dateFrom && <span className="date-placeholder">년-월-일</span>}
                    </div>
                    <span className="filter-sep">~</span>
                    <div className="date-input-wrapper">
                      <input
                        type="date"
                        className="inline-search"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                      />
                      {!dateTo && <span className="date-placeholder">년-월-일</span>}
                    </div>
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
              {isFiltered && <div className="active-filter-strip" aria-label="적용 중인 검색 조건">
                {search.trim() && <button onClick={() => setSearch('')} aria-label="검색어 해제">검색어 적용 ×</button>}
                {(amountMin || amountMax) && <button onClick={() => { setAmountMin('');setAmountMax('') }} aria-label="금액 조건 해제">금액 {amountMin ? formatAmount(Number(amountMin)) : '제한 없음'} ~ {amountMax ? formatAmount(Number(amountMax)) : '제한 없음'} ×</button>}
                {(dateFrom || dateTo) && <button onClick={() => { setDateFrom('');setDateTo('') }} aria-label="날짜 조건 해제">기간 {dateFrom || '시작 제한 없음'} ~ {dateTo || '종료 제한 없음'} ×</button>}
                <button onClick={() => { clearFilters();setSearch('') }}>전체 초기화</button>
              </div>}
              <div className="tx-month-summary">
                <span className="month-total-label">월 전체 · {ownerFilter}</span>
                <span className="tx-month-balance">{formatAmount(totalIncome - totalExpense)}원</span>
                <span className="tx-month-sub">
                  <span className="tx-month-income">+{formatAmount(totalIncome)}</span>
                  <span className="tx-month-expense">−{formatAmount(totalExpense)}</span>
                </span>
              </div>
              {isFiltered && <section className="search-result-summary" aria-label="검색 결과 합계" aria-live="polite">
                <strong>검색 결과 · {resultSummary.count}건</strong>
                <span>일반 수입 {formatAmount(resultSummary.income)}원 · 일반 지출 {formatAmount(resultSummary.expense)}원</span>
                <span>합계 {formatAmount(resultSummary.income - resultSummary.expense)}원</span>
                {(resultSummary.received > 0 || resultSummary.sent > 0) && <small>별도 이체: 보냄 {formatAmount(resultSummary.sent)}원 · 받음 {formatAmount(resultSummary.received)}원</small>}
                <small>선택한 월·소유자 안에서 검색한 결과예요. 이체는 일반 합계에서 제외합니다.</small>
              </section>}
              <TransactionList
                onCopy={requestCopy}
                filtered={isFiltered}
                transactions={filteredTransactions}
                onDelete={wrappedDelete}
                onUpdate={wrappedUpdate}
                assets={linkableAssets}
                owners={owners}
                categories={categories}
                onAddCategory={handleAddCategory}
                onRemoveCategory={handleRemoveCategory}
                search={search}
                scrollToId={lastAddedTxId}
              />
            </Collapsible>
          )}
          </div>
          <div hidden={ledgerView !== 'calendar'}>
            {loading ? <div className="skeleton-list" aria-label="캘린더 불러오는 중"><div className="skeleton-item" /></div> : <TransactionCalendar transactions={ownedTransactions} year={cursor.year} month={cursor.month} onDeleteDate={wrappedDelete} onChangeMonth={changeMonth} onUpdate={wrappedUpdate} assets={linkableAssets} owners={owners} categories={categories} onAddCategory={handleAddCategory} onRemoveCategory={handleRemoveCategory} />}
          </div>
          </Collapsible>

          <div className="ledger-analysis">
          <MonthlyTrendChart householdId={householdId} ownerFilter={ownerFilter} year={cursor.year} month={cursor.month} refreshKey={JSON.stringify(transactions)} />
          <TransactionInsight
            ownerLabel={ownerFilter}
            transactions={ownedTransactions}
            totalIncome={totalIncome}
            totalExpense={totalExpense}
            balance={balance}
            monthLabel={`${cursor.year}년 ${cursor.month + 1}월`}
          />
          </div>
          </div>
        </div>
      )}
      </div>

      <div className="bottom-tab-bar">
        <button className={page === 'transactions' ? 'active' : ''} onClick={() => navigateTo('transactions')}>
          <span className="tab-icon">📋</span>
          <span className="tab-label">내역</span>
          {page === 'transactions' && <span className="tab-pill" />}
        </button>
        <button className={page === 'assets' ? 'active' : ''} onClick={() => navigateTo('assets')}>
          <span className="tab-icon">💰</span>
          <span className="tab-label">자산</span>
          {page === 'assets' && <span className="tab-pill" />}
        </button>
      </div>

      {!isOnline && <div className="offline-banner">📡 오프라인 상태예요 — 데이터가 저장되지 않을 수 있어요</div>}
      {toast && (
        <div className={`toast${toastAction ? ' toast-action' : ''}`} role="status">
          <span className="toast-bar" />
          <span className="toast-text">{toast}</span>
          {toastAction && <button className="toast-undo" onClick={runToastAction} disabled={toastBusy}>{toastBusy ? '처리 중…' : '실행 취소'}</button>}
        </div>
      )}
    </div>
  )
}
import EmptyState from './components/EmptyState'
