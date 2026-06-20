const GOV_KEY = process.env.GOV_DATA_API_KEY
const BASE = 'https://apis.data.go.kr/1613000'

const ENDPOINTS = {
  'apt-trade':  'RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev',
  'apt-rent':   'RTMSDataSvcAptRent/getRTMSDataSvcAptRent',
  'villa-trade':'RTMSDataSvcRHTrade/getRTMSDataSvcRHTrade',
  'villa-rent': 'RTMSDataSvcRHRent/getRTMSDataSvcRHRent',
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

export default async function handler(req, res) {
  if (!GOV_KEY) return res.status(500).json({ error: 'GOV_DATA_API_KEY not set' })

  const url = new URL(req.url, 'http://localhost')
  const code = url.searchParams.get('code')
  const type = url.searchParams.get('type') || 'apt'
  const deal = url.searchParams.get('deal') || 'trade'

  if (!code) return res.status(400).json({ error: 'code required' })

  const dealKey = deal === 'trade' ? 'trade' : 'rent'
  const key = `${type}-${dealKey}`
  const endpoint = ENDPOINTS[key] || ENDPOINTS['apt-trade']
  const months = recentMonths(5)

  try {
    const results = await Promise.all(months.map((ym) => fetchItems(endpoint, code, ym)))
    const all = results.flat()

    let transactions
    if (deal === 'trade') {
      transactions = all
        .filter((i) => !i.해제여부 || i.해제여부.trim() !== 'O')
        .map((i) => ({
          name: (i.아파트 || i.연립다세대 || '').trim(),
          dong: (i.법정동 || '').trim(),
          area: parseFloat(i.전용면적 || 0),
          floor: String(i.층 || '').trim(),
          price: parsePrice(i.거래금액),
          builtYear: i.건축년도,
          dealYear: i.년,
          dealMonth: String(i.월 || '').trim(),
          dealDay: String(i.일 || '').trim(),
        }))
        .filter((t) => t.price > 0)
        .sort((a, b) => {
          const da = `${a.dealYear}${String(a.dealMonth).padStart(2,'0')}`
          const db = `${b.dealYear}${String(b.dealMonth).padStart(2,'0')}`
          return db.localeCompare(da) || b.price - a.price
        })
        .slice(0, 60)
    } else {
      const isMonthly = deal === 'monthly'
      transactions = all
        .map((i) => ({
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
        .filter((t) => t.deposit > 0 && (isMonthly ? t.monthly > 0 : t.monthly === 0))
        .sort((a, b) => {
          const da = `${a.dealYear}${String(a.dealMonth).padStart(2,'0')}`
          const db = `${b.dealYear}${String(b.dealMonth).padStart(2,'0')}`
          return db.localeCompare(da) || b.deposit - a.deposit
        })
        .slice(0, 60)
    }

    return res.status(200).json({ transactions, fetchedAt: new Date().toISOString() })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
