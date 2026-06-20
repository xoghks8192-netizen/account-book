const FSS_KEY = process.env.FSS_API_KEY

const GROUP_CODES = ['020000', '030300'] // 은행, 저축은행

async function fetchProducts(type, topFinGrpNo) {
  const endpoint = type === 'deposit'
    ? 'depositProductsSearch'
    : 'savingProductsSearch'
  const url = `https://finlife.fss.or.kr/finlifeapi/${endpoint}.json?auth=${FSS_KEY}&topFinGrpNo=${topFinGrpNo}&pageNo=1`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`FSS API error: ${res.status}`)
  const json = await res.json()
  const result = json?.result
  if (!result) return []

  const baseList = result.baseList || []
  const optionList = result.optionList || []

  return baseList.flatMap((base) => {
    const options = optionList.filter((o) => o.fin_prdt_cd === base.fin_prdt_cd)
    return options.map((opt) => ({
      bankName: base.kor_co_nm,
      productName: base.fin_prdt_nm,
      term: opt.save_trm,
      rate: parseFloat(opt.intr_rate2 ?? opt.intr_rate ?? 0),
      rateType: opt.intr_rate_type_nm,
      joinWay: base.join_way,
      type,
    }))
  })
}

export default async function handler(req, res) {
  if (!FSS_KEY) return res.status(500).json({ error: 'FSS_API_KEY not set' })

  try {
    const [depositBank, depositSaving, savingBank, savingSaving] = await Promise.all([
      fetchProducts('deposit', '020000'),
      fetchProducts('deposit', '030300'),
      fetchProducts('saving', '020000'),
      fetchProducts('saving', '030300'),
    ])

    const all = [...depositBank, ...depositSaving, ...savingBank, ...savingSaving]

    // 12개월 기준으로 필터, 금리 내림차순 top 20
    const byTerm = (items, term) =>
      items
        .filter((p) => p.rate > 0 && String(p.term) === String(term))
        .sort((a, b) => b.rate - a.rate)
        .slice(0, 15)

    return res.status(200).json({
      deposit12: byTerm(all.filter((p) => p.type === 'deposit'), 12),
      deposit6:  byTerm(all.filter((p) => p.type === 'deposit'), 6),
      saving12:  byTerm(all.filter((p) => p.type === 'saving'), 12),
      saving6:   byTerm(all.filter((p) => p.type === 'saving'), 6),
      updatedAt: new Date().toISOString(),
    })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
