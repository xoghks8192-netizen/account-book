import { requireSession, sessionView, endSession, checkOrigin, apiError, fail, hashToken, newToken, rateLimit } from './auth.js'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  try {
    if (req.method === 'POST' && req.body?.action === 'logout') {
      checkOrigin(req)
      await endSession(req, res)
      return res.status(200).json({ ok: true })
    }
    const { db, user } = await requireSession(req)
    if (req.method === 'GET') return res.status(200).json(await sessionView(db, user))
    if (req.method === 'POST' && req.body?.action === 'invite') {
      await rateLimit(db, 'invite:' + hashToken(user.username), 10)
      const { count, error } = await db.from('app_users').select('username', { count: 'exact', head: true }).eq('household_id', user.household_id)
      if (error) throw fail(503, '가구 정보를 확인하지 못했습니다.')
      if (count !== 1) throw fail(409, '이미 배우자와 연결되어 있습니다.')
      const code = newToken()
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      const { error: insertError } = await db.from('household_invites').insert({
        token_hash: hashToken(code), household_id: user.household_id,
        created_by: user.username, expires_at: expiresAt,
      })
      if (insertError) throw fail(503, '초대 코드를 생성하지 못했습니다.')
      return res.status(200).json({ code, expiresAt })
    }
    return res.status(405).json({ error: '허용되지 않는 요청입니다.' })
  } catch (e) { return apiError(res, e) }
}
