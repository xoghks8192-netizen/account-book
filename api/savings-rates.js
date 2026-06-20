const FSS_KEY = process.env.FSS_API_KEY

async function fetchSavings(type, topFinGrpNo) {
  const endpoint = type === 'deposit' ? 'depositProductsSearch' : 'savingProductsSearch'
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
      joinWay: base.join_way,
      type,
    }))
  })
}

async function fetchLoans(loanType, topFinGrpNo) {
  const endpointMap = {
    mortgage: 'mortgageLoanProductsSearch',
    rent:     'rentHouseLoanProductsSearch',
    credit:   'creditLoanProductsSearch',
  }
  const url = `https://finlife.fss.or.kr/finlifeapi/${endpointMap[loanType]}.json?auth=${FSS_KEY}&topFinGrpNo=${topFinGrpNo}&pageNo=1`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`FSS loan API error: ${res.status}`)
  const json = await res.json()
  const result = json?.result
  if (!result) return []
  const baseList = result.baseList || []
  const optionList = result.optionList || []
  return baseList.flatMap((base) => {
    const options = optionList.filter((o) => o.fin_prdt_cd === base.fin_prdt_cd)
    if (options.length === 0) return []
    const minRate = Math.min(...options.map((o) => parseFloat(o.lend_rate_min ?? o.lend_rate_avg ?? 99)).filter((r) => r > 0))
    const maxRate = Math.max(...options.map((o) => parseFloat(o.lend_rate_max ?? o.lend_rate_avg ?? 0)).filter((r) => r > 0))
    return [{
      bankName: base.kor_co_nm,
      productName: base.fin_prdt_nm,
      rateMin: isFinite(minRate) ? minRate : 0,
      rateMax: isFinite(maxRate) ? maxRate : 0,
      joinWay: base.join_way,
      loanType,
    }]
  }).filter((p) => p.rateMin > 0)
}

export default async function handler(req, res) {
  if (!FSS_KEY) return res.status(500).json({ error: 'FSS_API_KEY not set' })

  try {
    const [depositBank, depositSaving, savingBank, savingSaving,
           mortgageBank, rentBank, creditBank] = await Promise.all([
      fetchSavings('deposit', '020000'),
      fetchSavings('deposit', '030300'),
      fetchSavings('saving',  '020000'),
      fetchSavings('saving',  '030300'),
      fetchLoans('mortgage', '020000'),
      fetchLoans('rent',     '020000'),
      fetchLoans('credit',   '020000'),
    ])

    const all = [...depositBank, ...depositSaving, ...savingBank, ...savingSaving]
    const byTerm = (items, term) =>
      items.filter((p) => p.rate > 0 && String(p.term) === String(term))
           .sort((a, b) => b.rate - a.rate).slice(0, 15)

    const sortLoans = (items) =>
      items.sort((a, b) => a.rateMin - b.rateMin).slice(0, 15)

    return res.status(200).json({
      deposit12: byTerm(all.filter((p) => p.type === 'deposit'), 12),
      deposit6:  byTerm(all.filter((p) => p.type === 'deposit'), 6),
      saving12:  byTerm(all.filter((p) => p.type === 'saving'),  12),
      saving6:   byTerm(all.filter((p) => p.type === 'saving'),  6),
      mortgage:  sortLoans(mortgageBank),
      rent:      sortLoans(rentBank),
      credit:    sortLoans(creditBank),
      updatedAt: new Date().toISOString(),
    })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
