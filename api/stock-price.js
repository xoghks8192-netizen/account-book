import { fetchStockPrice } from '../server/fetchPrice.js'
import { requireSession, apiError, fail } from '../server/auth.js'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'GET') return res.status(405).json({ error: '허용되지 않는 요청입니다.' })
  try {
    await requireSession(req)
    const { code } = req.query || {}
    if (typeof code !== 'string' || !/^[A-Za-z0-9]{6}$/.test(code)) throw fail(400, '6자리 종목코드를 확인해주세요.')
    const price = await fetchStockPrice(code)
    res.status(200).json({ price })
  } catch (e) {
    return apiError(res, e)
  }
}
