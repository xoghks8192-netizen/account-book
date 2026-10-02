import bcrypt from 'bcryptjs'
import { requireSession, startSession, rateLimit, fail, apiError } from '../server/auth.js'

export default async function handler(req,res) {
  if (req.method !== 'POST') return res.status(405).json({error:'허용되지 않는 요청입니다.'})
  try {
    const {db,user} = await requireSession(req)
    const {currentPassword,newPassword} = req.body || {}
    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' || newPassword.length < 8 || newPassword.length > 200) throw fail(400,'새 비밀번호는 8~200자로 입력해주세요.')
    await rateLimit(db,'change-pw:' + user.username,5)
    const {data,error} = await db.from('app_users').select('password').eq('username',user.username).single()
    if (error || !await bcrypt.compare(currentPassword,data.password)) throw fail(401,'현재 비밀번호가 올바르지 않습니다.')
    const hash = await bcrypt.hash(newPassword,10)
    const {data:updated,error:updateError} = await db.from('app_users').update({password:hash})
      .eq('username',user.username).eq('password',data.password).select('username').maybeSingle()
    if (updateError || !updated) throw fail(409,'비밀번호가 변경되었습니다. 다시 로그인해주세요.')
    // password_version also invalidates concurrent old sessions if cleanup fails.
    await db.from('app_sessions').delete().eq('username',user.username)
    await startSession(db,res,user.username,hash)
    return res.status(200).json({ok:true})
  } catch(e) { return apiError(res,e) }
}
