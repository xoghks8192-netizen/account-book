import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fetchStockPrice } from './api/lib/fetchPrice.js'

function stockPriceApi() {
  return {
    name: 'stock-price-api',
    configureServer(server) {
      server.middlewares.use('/api/stock-price', async (req, res) => {
        const url = new URL(req.url, 'http://localhost')
        const code = url.searchParams.get('code')
        res.setHeader('Content-Type', 'application/json')
        if (!code) {
          res.statusCode = 400
          res.end(JSON.stringify({ error: '종목코드가 필요합니다.' }))
          return
        }
        try {
          const price = await fetchStockPrice(code)
          res.end(JSON.stringify({ price }))
        } catch (e) {
          res.statusCode = 500
          res.end(JSON.stringify({ error: e.message }))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), stockPriceApi()],
  server: {
    host: true,
  },
})
