import bcrypt from 'bcryptjs'
import { adminClient, checkOrigin, fail, hashToken, startSession, sessionView, apiError, rateLimit } from '../server/auth.js'
import sessionHandler from '../server/session.js'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method === 'GET' || (req.method === 'POST' && ['logout','invite'].includes(req.body?.action))) {
    return sessionHandler(req, res)
  }
  if (req.method !== 'POST') return res.status(405).json({ error:'허용되지 않는 요청입니다.' })
  try {
    checkOrigin(req)
    const { username, password } = req.body || {}
    if (typeof username !== 'string' || username.length > 100 || typeof password !== 'string' || password.length > 200 || !password) throw fail(400,'아이디와 비밀번호를 확인해주세요.')
    const db = adminClient()
    const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0]
    await rateLimit(db, 'login-user:' + hashToken(username), 10)
    await rateLimit(db, 'login-ip:' + hashToken(ip), 40)
    const { data:user, error } = await db.from('app_users').select('username,password,household_id,display_name').eq('username',username).maybeSingle()
    if (error) throw fail(503,'로그인을 확인하지 못했습니다.')
    const valid = user && (user.password.startsWith('$2') ? await bcrypt.compare(password,user.password) : password === user.password)
    if (!valid) throw fail(401,'아이디 또는 비밀번호가 올바르지 않습니다.')
    if (!user.password.startsWith('$2')) {
      const hash = await bcrypt.hash(password,10)
      const { data: upgraded, error: upgradeError } = await db.from('app_users').update({password:hash})
        .eq('username',username).eq('password',user.password).select('username').maybeSingle()
      if (upgradeError || !upgraded) throw fail(503,'다시 로그인해주세요.')
      user.password = hash
    }
    const view = await sessionView(db,user)
    await startSession(db,res,user.username,user.password)
    return res.status(200).json(view)
  } catch(e) { return apiError(res,e) }
}
