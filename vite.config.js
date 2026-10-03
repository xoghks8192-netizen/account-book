import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import login from './api/login.js'
import signup from './api/signup.js'
import changePw from './api/change-pw.js'
import updateHousehold from './api/update-household.js'
import aiInsight from './api/ai-insight.js'
import stockPrice from './api/stock-price.js'
import data from './api/data.js'
import transactions from './api/transactions.js'
import resetPassword from './api/reset-password.js'
import savingsRates from './api/savings-rates.js'
import realestate from './api/realestate.js'
import realestateAi from './api/realestate-ai.js'

function apiRoute(path, handler) {
  return { name: 'api-'+path, configureServer(server) {
    server.middlewares.use(path, async (req, res) => {
      res.setHeader('Content-Type', 'application/json')
      const wrapped = {
        setHeader(name,value) { res.setHeader(name,value); return this },
        status(code) { res.statusCode=code; return this },
        json(value) { res.end(JSON.stringify(value)) },
      }
      try {
        req.query=Object.fromEntries(new URL(req.url,'http://localhost').searchParams)
        const chunks=[]; let size=0
        for await (const chunk of req) {
          size+=chunk.length
          if(size>4000000) return wrapped.status(413).json({error:'입력 내용이 너무 큽니다.'})
          chunks.push(chunk)
        }
        const raw=Buffer.concat(chunks).toString('utf8')
        try { req.body=raw ? JSON.parse(raw) : {} }
        catch { return wrapped.status(400).json({error:'입력 형식을 확인해주세요.'}) }
        await handler(req,wrapped)
      } catch { wrapped.status(500).json({error:'요청을 처리하지 못했습니다.'}) }
    })
  } }
}
export default defineConfig(({mode}) => {
  Object.assign(process.env,loadEnv(mode,process.cwd(),''))
  const routes={login,signup,'change-pw':changePw,'update-household':updateHousehold,
    'ai-insight':aiInsight,'stock-price':stockPrice,data,transactions,
    'reset-password':resetPassword,'savings-rates':savingsRates,realestate,'realestate-ai':realestateAi}
  return {plugins:[react(),...Object.entries(routes).map(([path,handler])=>apiRoute('/api/'+path,handler))],server:{host:true}}
})
