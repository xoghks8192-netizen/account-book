import { requireSession, sessionView, fail, apiError } from '../server/auth.js'

export default async function handler(req,res) {
  if (req.method !== 'POST') return res.status(405).json({error:'허용되지 않는 요청입니다.'})
  try {
    const {db,user} = await requireSession(req)
    const {datingStart,weddingDate} = req.body || {}
    const validDate = value => !value || (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value))
    if (!validDate(datingStart) || !validDate(weddingDate)) throw fail(400,'기념일을 확인해주세요.')
    const {error} = await db.from('households').update({dating_start:datingStart || null,wedding_date:weddingDate || null}).eq('id',user.household_id)
    if (error) throw fail(400,'기념일을 저장하지 못했습니다.')
    // Names and anniversaries are public facts, never proof of household membership.
    return res.status(200).json(await sessionView(db,user))
  } catch(e) { return apiError(res,e) }
}
