const GOV_KEY = process.env.GOV_DATA_API_KEY
const BASE = 'https://apis.data.go.kr/1613000'

const ENDPOINTS = {
  'apt-trade':    'RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev',
  'apt-rent':     'RTMSDataSvcAptRent/getRTMSDataSvcAptRent',
  'villa-trade':  'RTMSDataSvcRHTrade/getRTMSDataSvcRHTrade',
  'villa-rent':   'RTMSDataSvcRHRent/getRTMSDataSvcRHRent',
  'apt-presale':  'RTMSDataSvcSilvTrade/getRTMSDataSvcSilvTrade',
}

async function fetchItems(endpoint, lawdCd, dealYmd) {
  const url = `${BASE}/${endpoint}?serviceKey=${encodeURIComponent(GOV_KEY)}&LAWD_CD=${lawdCd}&DEAL_YMD=${dealYmd}&numOfRows=1000&pageNo=1&_type=json`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`API ${res.status}`)
  const text = await res.text()
  let json
  try { json = JSON.parse(text) } catch { throw new Error(`JSON parse fail: ${text.slice(0, 200)}`) }
  const body = json?.response?.body
  const totalCount = body?.totalCount ?? 0
  const items = body?.items?.item
  if (!items || totalCount === 0) return []
  return Array.isArray(items) ? items : [items]
}

function recentMonths(n, startFrom = 1) {
  const now = new Date()
  const months = []
  for (let i = startFrom; i <= startFrom + n - 1; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return months
}

function parsePrice(val) {
  if (val == null) return 0
  return parseInt(String(val).replace(/,/g, '')) || 0
}

function parseTrade(items, propType) {
  return items
    .filter((i) => {
      const cancel = i.해제여부 || i.cdealType || ''
      return cancel.trim() !== 'O'
    })
    .map((i) => ({
      propType,
      dealType: 'trade',
      name: (i.아파트 || i.aptNm || i.연립다세대 || i.houseNm || i.mhouseNm || '').trim(),
      dong: (i.법정동 || i.umdNm || '').trim(),
      area: parseFloat(i.전용면적 || i.excluUseAr || 0),
      floor: String(i.층 || i.floor || '').trim(),
      price: parsePrice(i.거래금액 || i.dealAmount),
      builtYear: i.건축년도 || i.buildYear,
      dealYear: i.년 || i.dealYear,
      dealMonth: String(i.월 || i.dealMonth || '').trim(),
    }))
    .filter((t) => t.price > 0)
}

function parsePresale(items) {
  return items
    .filter((i) => {
      const cancel = i.해제여부 || ''
      return cancel.trim() !== 'O'
    })
    .map((i) => ({
      propType: 'apt',
      dealType: 'presale',
      name: (i.아파트 || i.단지명 || '').trim(),
      dong: (i.법정동 || '').trim(),
      area: parseFloat(i.전용면적 || 0),
      floor: String(i.층 || '').trim(),
      price: parsePrice(i.거래금액),
      builtYear: i.건축년도 || '-',
      dealYear: i.년,
      dealMonth: String(i.월 || '').trim(),
    }))
    .filter((t) => t.price > 0)
}

function parseRent(items, propType) {
  return items
    .map((i) => {
      const monthly = parsePrice(i.월세금액 || i.monthlyRent || i.monthlyRnt)
      return {
        propType,
        dealType: monthly > 0 ? 'monthly' : 'jeonse',
        name: (i.아파트 || i.aptNm || i.연립다세대 || i.houseNm || i.mhouseNm || '').trim(),
        dong: (i.법정동 || i.umdNm || '').trim(),
        area: parseFloat(i.전용면적 || i.excluUseAr || 0),
        floor: String(i.층 || i.floor || '').trim(),
        deposit: parsePrice(i.보증금액 || i.deposit),
        monthly,
        builtYear: i.건축년도 || i.buildYear,
        dealYear: i.년 || i.dealYear,
        dealMonth: String(i.월 || i.dealMonth || '').trim(),
      }
    })
    .filter((t) => t.deposit > 0)
}

function sortByDate(items) {
  return items.sort((a, b) => {
    const da = `${a.dealYear}${String(a.dealMonth).padStart(2, '0')}`
    const db = `${b.dealYear}${String(b.dealMonth).padStart(2, '0')}`
    return db.localeCompare(da)
  })
}

export default async function handler(req, res) {
  if (!GOV_KEY) return res.status(500).json({ error: 'GOV_DATA_API_KEY not set' })

  const url = new URL(req.url, 'http://localhost')
  const code = url.searchParams.get('code')
  if (!code) return res.status(400).json({ error: 'code required' })

  // 일반 거래: 최근 5개월, 분양권: 최근 12개월 (신축 커버)
  const months5 = recentMonths(5)
  const months12 = recentMonths(12)

  try {
    const [aptTradeItems, aptRentItems, villaTradeItems, villaRentItems, presaleItems] = await Promise.all([
      Promise.all(months5.map((ym) => fetchItems(ENDPOINTS['apt-trade'],   code, ym))).then(r => r.flat()),
      Promise.all(months5.map((ym) => fetchItems(ENDPOINTS['apt-rent'],    code, ym))).then(r => r.flat()),
      Promise.all(months5.map((ym) => fetchItems(ENDPOINTS['villa-trade'], code, ym))).then(r => r.flat()),
      Promise.all(months5.map((ym) => fetchItems(ENDPOINTS['villa-rent'],  code, ym))).then(r => r.flat()),
      Promise.all(months12.map((ym) => fetchItems(ENDPOINTS['apt-presale'], code, ym))).then(r => r.flat()),
    ])

    const all = [
      ...parseTrade(aptTradeItems,   'apt'),
      ...parseRent(aptRentItems,     'apt'),
      ...parseTrade(villaTradeItems, 'villa'),
      ...parseRent(villaRentItems,   'villa'),
    ]
    const presaleAll = parsePresale(presaleItems)

    const result = {
      'apt-trade':     sortByDate(all.filter(t => t.propType === 'apt'   && t.dealType === 'trade'  )).slice(0, 300),
      'apt-jeonse':    sortByDate(all.filter(t => t.propType === 'apt'   && t.dealType === 'jeonse' )).slice(0, 300),
      'apt-monthly':   sortByDate(all.filter(t => t.propType === 'apt'   && t.dealType === 'monthly')).slice(0, 300),
      'villa-trade':   sortByDate(all.filter(t => t.propType === 'villa' && t.dealType === 'trade'  )).slice(0, 300),
      'villa-jeonse':  sortByDate(all.filter(t => t.propType === 'villa' && t.dealType === 'jeonse' )).slice(0, 300),
      'villa-monthly': sortByDate(all.filter(t => t.propType === 'villa' && t.dealType === 'monthly')).slice(0, 300),
      'apt-presale':   sortByDate(presaleAll).slice(0, 300),
      fetchedAt: new Date().toISOString(),
    }
    return res.status(200).json(result)
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
