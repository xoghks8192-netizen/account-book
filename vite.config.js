import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fetchStockPrice } from './api/lib/fetchPrice.js'
import loginHandler from './api/login.js'
import changePwHandler from './api/change-pw.js'
import aiInsightHandler from './api/ai-insight.js'
import signupHandler from './api/signup.js'
import updateHouseholdHandler from './api/update-household.js'
import resetPasswordHandler from './api/reset-password.js'

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

function jsonApi(path, handler) {
  return {
    name: `json-api-${path}`,
    configureServer(server) {
      server.middlewares.use(path, async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end()
          return
        }
        const chunks = []
        for await (const chunk of req) chunks.push(chunk)
        const body = Buffer.concat(chunks).toString('utf-8')
        req.body = body ? JSON.parse(body) : {}
        res.setHeader('Content-Type', 'application/json')
        const wrappedRes = {
          status(code) {
            res.statusCode = code
            return this
          },
          json(obj) {
            res.end(JSON.stringify(obj))
          },
        }
        await handler(req, wrappedRes)
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  Object.assign(process.env, env)

  return {
    plugins: [
      react(),
      stockPriceApi(),
      jsonApi('/api/login', loginHandler),
      jsonApi('/api/change-pw', changePwHandler),
      jsonApi('/api/ai-insight', aiInsightHandler),
      jsonApi('/api/signup', signupHandler),
      jsonApi('/api/update-household', updateHouseholdHandler),
      jsonApi('/api/reset-password', resetPasswordHandler),
    ],
    server: {
      host: true,
    },
  }
})
