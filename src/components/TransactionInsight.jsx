import { useState } from 'react'
import Collapsible from './Collapsible'
import { requestAiInsight } from '../lib/aiInsight'

function formatAmount(n) {
  return Number(n).toLocaleString('ko-KR')
}

function categoryBreakdown(transactions, type) {
  const map = {}
  transactions.forEach((t) => {
    if (t.type === type) map[t.category] = (map[t.category] || 0) + Number(t.amount)
  })
  return Object.entries(map).sort((a, b) => b[1] - a[1])
}

export default function TransactionInsight({ transactions, totalIncome, totalExpense, balance, monthLabel }) {
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleAnalyze() {
    setLoading(true)
    setError('')
    setResult('')

    const incomeLines = categoryBreakdown(transactions, 'income')
      .map(([c, amt]) => `- ${c}: ${formatAmount(amt)}원`)
      .join('\n') || '(없음)'
    const expenseLines = categoryBreakdown(transactions, 'expense')
      .map(([c, amt]) => `- ${c}: ${formatAmount(amt)}원`)
      .join('\n') || '(없음)'

    const userContent = `${monthLabel} 가계부 데이터입니다.

총 수입: ${formatAmount(totalIncome)}원
총 지출: ${formatAmount(totalExpense)}원
합계(수입-지출): ${formatAmount(balance)}원

[수입 카테고리별]
${incomeLines}

[지출 카테고리별]
${expenseLines}

이 데이터를 바탕으로 이번 달 수입과 지출 현황을 간단히 정리/요약하고, 절약하거나 개선할 수 있는 부분에 대한 조언을 해주세요. 한국어로, 5~8줄 정도로 작성해주세요.`

    try {
      const text = await requestAiInsight([
        { role: 'system', content: '당신은 한국 가계부 앱의 재정 분석 도우미입니다. 친근하고 간결하게 답변하세요.' },
        { role: 'user', content: userContent },
      ])
      setResult(text)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Collapsible title="AI 분석" className="list">
      <button onClick={handleAnalyze} disabled={loading} className="submit-btn">
        {loading ? '분석 중...' : `${monthLabel} 내역 분석하기`}
      </button>
      {error && <div style={{ color: '#e0524c', marginTop: 10, fontSize: 13 }}>{error}</div>}
      {result && (
        <div style={{ marginTop: 12, whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.6 }}>{result}</div>
      )}
    </Collapsible>
  )
}
