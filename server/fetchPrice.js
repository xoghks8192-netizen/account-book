export async function fetchStockPrice(code) {
  const res = await fetch(`https://m.stock.naver.com/api/stock/${code}/basic`, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  })
  if (!res.ok) throw new Error('시세를 가져오지 못했습니다.')
  const data = await res.json()
  const price = Number(String(data.closePrice ?? '').replace(/,/g, ''))
  if (!price) throw new Error('종목코드를 확인해주세요.')
  return price
}
