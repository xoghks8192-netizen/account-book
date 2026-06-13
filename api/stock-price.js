import { fetchStockPrice } from './lib/fetchPrice.js'

export default async function handler(req, res) {
  const { code } = req.query
  if (!code) {
    res.status(400).json({ error: '종목코드가 필요합니다.' })
    return
  }
  try {
    const price = await fetchStockPrice(code)
    res.status(200).json({ price })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
