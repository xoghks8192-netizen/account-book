const OPENAI_KEY = process.env.OPENAI_API_KEY

export default async function handler(req, res) {
  if (!OPENAI_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY not set' })

  const { regionName, deal, type, transactions, financials, profile } = req.body || {}
  if (!transactions?.length) return res.status(400).json({ error: 'no data' })

  const dealLabel = { trade: '매매', jeonse: '전세', monthly: '월세' }[deal] || deal
  const typeLabel = type === 'apt' ? '아파트' : '빌라/연립다세대'

  const txSummary = transactions.slice(0, 15).map((t) => {
    if (deal === 'trade') {
      return `${t.name}(${t.dong}) ${t.area}㎡ ${t.floor}층 ${t.price}만원 (${t.builtYear}년 준공)`
    } else {
      return `${t.name}(${t.dong}) ${t.area}㎡ ${t.floor}층 보증금${t.deposit}만원${t.monthly ? ` 월세${t.monthly}만원` : ''}`
    }
  }).join('\n')

  const avgPrice = deal === 'trade'
    ? Math.round(transactions.reduce((s, t) => s + t.price, 0) / transactions.length)
    : Math.round(transactions.reduce((s, t) => s + t.deposit, 0) / transactions.length)

  const totalAssets = financials.totalAssets || 0
  const monthlyIncome = financials.monthlyIncome || 0
  const monthlyExpense = financials.monthlyExpense || 0
  const monthlySaving = monthlyIncome - monthlyExpense
  const emergencyFund = financials.emergencyFund || 0
  const equity = Math.floor((totalAssets - emergencyFund) / 10000) // 만원

  // 구매력 계산기 입력값이 있으면 활용
  const hasProfile = profile && profile.monthlyIncome > 0
  const profileIncome = hasProfile ? profile.monthlyIncome : Math.floor(monthlyIncome / 10000)
  const existingLoan = hasProfile ? (profile.existingLoan || 0) : 0
  const hasHome = hasProfile ? profile.hasHome : 'none'
  const isFirstBuyer = hasProfile ? profile.isFirstBuyer : true
  const zone = hasProfile ? profile.zone : 'normal'
  const zoneLabel = { normal: '비규제', adjustment: '조정대상지역', regulated: '투기과열지구' }[zone]
  const hasHomeLabel = { none: '무주택', one: '1주택', two: '2주택 이상' }[hasHome]

  const ltvMap = {
    none: { normal: 80, adjustment: 70, regulated: 50 },
    one:  { normal: 60, adjustment: 50, regulated: 0 },
    two:  { normal: 0,  adjustment: 0,  regulated: 0 },
  }
  const ltv = isFirstBuyer && hasHome === 'none' ? 80 : (ltvMap[hasHome]?.[zone] ?? 0)

  const r = 0.035 / 12
  const n = 360
  const maxPayment = profileIncome * 0.4 - existingLoan
  const maxLoan = maxPayment > 0 ? Math.floor(maxPayment * (1 - Math.pow(1 + r, -n)) / r) : 0
  const maxByLTV = ltv > 0 ? Math.floor(equity / (1 - ltv / 100)) : equity
  const maxPrice = Math.min(maxByLTV, equity + maxLoan)

  const prompt = `당신은 한국 부동산 전문가이자 가계 재무 상담사입니다. 아래 부부의 실제 재무 상황을 바탕으로 구체적이고 실용적인 조언을 해주세요.

=== 부부 재무 현황 ===
총 자산: ${(totalAssets).toLocaleString('ko-KR')}원 (비상금 제외 자기자본: ${equity.toLocaleString('ko-KR')}만원)
월 소득 합계: ${(monthlyIncome).toLocaleString('ko-KR')}원
월 지출 합계: ${(monthlyExpense).toLocaleString('ko-KR')}원
월 순저축: ${(monthlySaving).toLocaleString('ko-KR')}원
비상금: ${(emergencyFund).toLocaleString('ko-KR')}원

=== 주택 구매 여건 ===
주택 소유: ${hasHomeLabel}${isFirstBuyer && hasHome === 'none' ? ' (생애최초)' : ''}
지역 규제: ${zoneLabel}
적용 LTV: ${ltv}%
기존 대출 월상환액: ${existingLoan.toLocaleString('ko-KR')}만원
DSR 40% 기준 최대 대출 가능액: ${maxLoan.toLocaleString('ko-KR')}만원
최대 매입 가능 금액: ${maxPrice.toLocaleString('ko-KR')}만원

=== 검색 지역 현황 ===
지역: ${regionName} / 유형: ${typeLabel} ${dealLabel}
최근 실거래 평균가: ${deal === 'trade' ? `${avgPrice.toLocaleString('ko-KR')}만원` : `보증금 ${avgPrice.toLocaleString('ko-KR')}만원`}

=== 최근 실거래 내역 (상위 15건) ===
${txSummary}

위 부부에게 아래 항목을 순서대로 분석해주세요:

1. **현재 구매 가능 여부** — 최대 매입 가능 금액(${maxPrice.toLocaleString('ko-KR')}만원) 기준으로 이 지역에서 살 수 있는 매물이 있는지, 어떤 유형/크기가 현실적인지

2. **추천 대출 전략** — 어떤 대출 상품을 활용하면 좋은지 (생애최초주택구입자론, 디딤돌대출, 보금자리론 등 해당 조건에 맞는 상품 명시), 금리/한도 조건 간략히

3. **목표 저축 플랜** — 지금 월 저축액 기준으로 몇 개월/몇 년 후에 어떤 수준의 집을 살 수 있게 되는지 구체적 수치로

4. **이 지역 장기 투자 관점** — 실거래 내역을 보고 이 지역이 장기적으로 투자 가치가 있는지, 지금 사는 게 나은지 더 모아서 사는 게 나은지 의견

5. **최종 추천** — "지금 당장 ○○ 대출로 ○○ 구입" 또는 "○개월 더 모아서 ○○ 노려라" 형태로 한 줄 결론

한국어로, 친근하되 전문적으로, 각 항목을 짧게 핵심만 답해주세요.
금액 표기는 반드시 "N억 M만원" 형식으로 써주세요. 예: 46,435만원 → 4억 6,435만원, 30,000만원 → 3억원, 8,500만원 → 8,500만원.`

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1200,
        temperature: 0.7,
      }),
    })
    const json = await response.json()
    const text = json.choices?.[0]?.message?.content || '분석 결과를 가져오지 못했어요.'
    return res.status(200).json({ analysis: text })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
