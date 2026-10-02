import { requireSession, apiError, fail } from '../server/auth.js'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') return res.status(405).json({ error: '허용되지 않는 요청입니다.' })
  try {
    const { db, user } = await requireSession(req)
    const { action, id = null, fields = {}, requestId } = req.body || {}
    if (!['add','update','delete'].includes(action) || !/^[a-f0-9-]{36}$/i.test(requestId || '')) throw fail(400, '잘못된 요청입니다.')
    const { data, error } = await db.rpc('hb_mutate_transaction', {
      p_actor: user.username, p_action: action, p_id: id, p_fields: fields, p_request: requestId,
    })
    if (error) {
      if (error.code === 'P0001') throw fail(400, error.message)
      throw fail(503, '내역을 저장하지 못했습니다. 입력 내용은 유지됩니다.')
    }
    return res.status(200).json(data)
  } catch (e) { return apiError(res, e) }
}
