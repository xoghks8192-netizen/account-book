const OPENAI_KEY = process.env.OPENAI_API_KEY

export default async function handler(req, res) {
  if (!OPENAI_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY not set' })

  const { regionName, deal, type, transactions, financials } = req.body || {}
  if (!transactions?.length) return res.status(400).json({ error: 'no data' })

  const dealLabel = { trade: '매매', jeonse: '전세', monthly: '월세' }[deal] || deal
  const typeLabel = type === 'apt' ? '아파트' : '빌라/연립다세대'

  const txSummary = transactions.slice(0, 15).map((t) => {
    if (deal === 'trade') {
      return `${t.name}(${t.dong}) ${t.area}㎡ ${t.floor}층 ${(t.price * 10000).toLocaleString('ko-KR')}원 (${t.builtYear}년)`
    } else {
      return `${t.name}(${t.dong}) ${t.area}㎡ ${t.floor}층 보증금${(t.deposit * 10000).toLocaleString('ko-KR')}원${t.monthly ? ` 월세${(t.monthly * 10000).toLocaleString('ko-KR')}원` : ''}`
    }
  }).join('\n')

  const avgPrice = deal === 'trade'
    ? Math.round(transactions.reduce((s, t) => s + t.price, 0) / transactions.length)
    : Math.round(transactions.reduce((s, t) => s + t.deposit, 0) / transactions.length)

  const prompt = `당신은 한국 부동산 전문가이자 가계 재무 상담사입니다.

=== 부부 재무 현황 ===
총 자산: ${(financials.totalAssets || 0).toLocaleString('ko-KR')}원
월 소득 합계: ${(financials.monthlyIncome || 0).toLocaleString('ko-KR')}원
월 지출 합계: ${(financials.monthlyExpense || 0).toLocaleString('ko-KR')}원
월 순저축: ${((financials.monthlyIncome || 0) - (financials.monthlyExpense || 0)).toLocaleString('ko-KR')}원
비상금: ${(financials.emergencyFund || 0).toLocaleString('ko-KR')}원

=== 검색 조건 ===
지역: ${regionName}
유형: ${typeLabel} ${dealLabel}
최근 실거래 평균: ${deal === 'trade' ? `${avgPrice}만원` : `보증금 ${avgPrice}만원`}

=== 최근 실거래 내역 (상위 15건) ===
${txSummary}

위 부부의 재무 상황을 바탕으로 다음을 분석해주세요:
1. 현재 이 지역 ${typeLabel} ${dealLabel}이 가능한지 여부
2. 감당 가능한 가격대 범위
3. 실거래 내역 중 주목할 만한 매물 2~3개 추천 (이유 포함)
4. 이 지역 부동산에 대한 전반적인 조언

한국어로, 친근하고 실용적으로, 총 6~10줄로 답변해주세요.`

  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 800,
        temperature: 0.7,
      }),
    })
    const json = await r.json()
    const text = json.choices?.[0]?.message?.content || '분석 결과를 가져오지 못했어요.'
    return res.status(200).json({ analysis: text })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
