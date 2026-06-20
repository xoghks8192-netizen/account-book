const GOV_KEY = process.env.GOV_DATA_API_KEY
const BASE = 'https://apis.data.go.kr/1613000'

const ENDPOINTS = {
  'apt-trade':   'RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev',
  'apt-rent':    'RTMSDataSvcAptRent/getRTMSDataSvcAptRent',
  'villa-trade': 'RTMSDataSvcRHTrade/getRTMSDataSvcRHTrade',
  'villa-rent':  'RTMSDataSvcRHRent/getRTMSDataSvcRHRent',
}

async function fetchItems(endpoint, lawdCd, dealYmd) {
  const url = `${BASE}/${endpoint}?serviceKey=${encodeURIComponent(GOV_KEY)}&LAWD_CD=${lawdCd}&DEAL_YMD=${dealYmd}&numOfRows=100&pageNo=1&_type=json`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`API ${res.status}`)
  const json = await res.json()
  const items = json?.response?.body?.items?.item
  if (!items) return []
  return Array.isArray(items) ? items : [items]
}

function recentMonths(n) {
  const now = new Date()
  const months = []
  for (let i = 1; i <= n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return months
}

function parsePrice(str) {
  return parseInt((str || '0').replace(/,/g, '')) || 0
}

function parseTrade(items, propType) {
  return items
    .filter((i) => !i.해제여부 || i.해제여부.trim() !== 'O')
    .map((i) => ({
      propType,
      dealType: 'trade',
      name: (i.아파트 || i.연립다세대 || '').trim(),
      dong: (i.법정동 || '').trim(),
      area: parseFloat(i.전용면적 || 0),
      floor: String(i.층 || '').trim(),
      price: parsePrice(i.거래금액),
      builtYear: i.건축년도,
      dealYear: i.년,
      dealMonth: String(i.월 || '').trim(),
    }))
    .filter((t) => t.price > 0)
}

function parseRent(items, propType) {
  return items
    .map((i) => ({
      propType,
      dealType: parsePrice(i.월세금액) > 0 ? 'monthly' : 'jeonse',
      name: (i.아파트 || i.연립다세대 || '').trim(),
      dong: (i.법정동 || '').trim(),
      area: parseFloat(i.전용면적 || 0),
      floor: String(i.층 || '').trim(),
      deposit: parsePrice(i.보증금액),
      monthly: parsePrice(i.월세금액),
      builtYear: i.건축년도,
      dealYear: i.년,
      dealMonth: String(i.월 || '').trim(),
    }))
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

  const months = recentMonths(5)

  try {
    // 4개 엔드포인트 × 5개월 = 20개 병렬 요청
    const [aptTradeItems, aptRentItems, villaTradeItems, villaRentItems] = await Promise.all(
      Object.entries(ENDPOINTS).map(([, endpoint]) =>
        Promise.all(months.map((ym) => fetchItems(endpoint, code, ym))).then((r) => r.flat())
      )
    )

    const all = [
      ...parseTrade(aptTradeItems,   'apt'),
      ...parseRent(aptRentItems,     'apt'),
      ...parseTrade(villaTradeItems, 'villa'),
      ...parseRent(villaRentItems,   'villa'),
    ]

    return res.status(200).json({
      'apt-trade':   sortByDate(all.filter(t => t.propType === 'apt'   && t.dealType === 'trade'  )).slice(0, 60),
      'apt-jeonse':  sortByDate(all.filter(t => t.propType === 'apt'   && t.dealType === 'jeonse' )).slice(0, 60),
      'apt-monthly': sortByDate(all.filter(t => t.propType === 'apt'   && t.dealType === 'monthly')).slice(0, 60),
      'villa-trade':   sortByDate(all.filter(t => t.propType === 'villa' && t.dealType === 'trade'  )).slice(0, 60),
      'villa-jeonse':  sortByDate(all.filter(t => t.propType === 'villa' && t.dealType === 'jeonse' )).slice(0, 60),
      'villa-monthly': sortByDate(all.filter(t => t.propType === 'villa' && t.dealType === 'monthly')).slice(0, 60),
      fetchedAt: new Date().toISOString(),
    })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
