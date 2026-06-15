import { useState } from 'react'
import { supabase } from '../lib/supabase'
import Collapsible from './Collapsible'
import { requestAiInsight } from '../lib/aiInsight'

function formatAmount(n) {
  return Number(n).toLocaleString('ko-KR')
}

export default function AssetForecast({ total, liquidTotal, nonLiquidTotal, chartData, householdId }) {
  const [months, setMonths] = useState(6)
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleAnalyze() {
    setLoading(true)
    setError('')
    setResult('')

    try {
      const { data: templates, error: tplError } = await supabase
        .from('recurring_templates')
        .select('*')
        .eq('household_id', householdId)
      if (tplError) throw new Error(tplError.message)

      const monthlyIncome = templates
        .filter((t) => t.type === 'income')
        .reduce((s, t) => s + Number(t.amount), 0)
      const monthlyExpense = templates
        .filter((t) => t.type === 'expense')
        .reduce((s, t) => s + Number(t.amount), 0)
      const monthlyNet = monthlyIncome - monthlyExpense

      const categoryLines = chartData.map(([c, amt]) => `- ${c}: ${formatAmount(amt)}원`).join('\n') || '(없음)'

      const userContent = `현재 자산 현황입니다.

총 자산: ${formatAmount(total)}원
유동자산: ${formatAmount(liquidTotal)}원
비유동자산: ${formatAmount(nonLiquidTotal)}원

[자산 카테고리별 구성]
${categoryLines}

[고정 지출/수입]
월 고정 수입 합계: ${formatAmount(monthlyIncome)}원
월 고정 지출 합계: ${formatAmount(monthlyExpense)}원
월 순현금흐름(수입-지출): ${formatAmount(monthlyNet)}원

이 추세가 그대로 유지된다고 가정할 때, ${months}개월 후 총 자산이 대략 얼마가 될지 계산해서 알려주고, 자산 구성이나 재정 계획에 대해 조언해주세요. 한국어로, 5~8줄 정도로 작성해주세요.`

      const text = await requestAiInsight([
        { role: 'system', content: '당신은 한국 가계부 앱의 자산 분석 도우미입니다. 친근하고 간결하게 답변하세요.' },
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
    <Collapsible title="AI 자산 예측">
      <div className="form-row">
        <label>몇 개월 후</label>
        <input
          type="number"
          inputMode="numeric"
          min="1"
          value={months}
          onChange={(e) => setMonths(e.target.value)}
        />
      </div>
      <button onClick={handleAnalyze} disabled={loading || !months} className="submit-btn">
        {loading ? '예측 중...' : `${months || ''}개월 후 자산 예측하기`}
      </button>
      {error && <div style={{ color: '#e0524c', marginTop: 10, fontSize: 13 }}>{error}</div>}
      {result && (
        <div style={{ marginTop: 12, whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.6 }}>{result}</div>
      )}
    </Collapsible>
  )
}
