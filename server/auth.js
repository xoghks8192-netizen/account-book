import { createHash, randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const COOKIE = 'hb_session'
const AGE = 60 * 60 * 24 * 30
export const hashToken = (token) => createHash('sha256').update(token).digest('hex')
export const newToken = () => randomBytes(32).toString('hex')
export function adminClient() {
  return createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } })
}
export function fail(status, message) {
  return Object.assign(new Error(message), { status })
}
export function checkOrigin(req) {
  const origin = req.headers?.origin
  if (origin && new URL(origin).host !== req.headers.host) throw fail(403, '허용되지 않는 요청입니다.')
  if (req.headers?.['sec-fetch-site'] === 'cross-site') throw fail(403, '허용되지 않는 요청입니다.')
}
export function sessionToken(req) {
  return (req.headers?.cookie || '').split(';').map(s => s.trim())
    .find(s => s.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1)
}
function writeCookie(res, token, maxAge) {
  const secure = process.env.NODE_ENV === 'production' || process.env.VERCEL ? '; Secure' : ''
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secure}`)
}
export async function startSession(db, res, username, passwordHash) {
  const token = newToken()
  const { error } = await db.from('app_sessions').insert({
    token_hash: hashToken(token), username, password_version: hashToken(passwordHash),
    expires_at: new Date(Date.now() + AGE * 1000).toISOString(),
  })
  if (error) throw fail(503, '로그인 저장에 실패했습니다. 잠시 후 다시 시도해주세요.')
  writeCookie(res, token, AGE)
}
export async function endSession(req, res, db = adminClient()) {
  const token = sessionToken(req)
  if (token && /^[a-f0-9]{64}$/.test(token)) {
    const { error } = await db.from('app_sessions').delete().eq('token_hash', hashToken(token))
    if (error) throw fail(503, '로그아웃에 실패했습니다. 다시 시도해주세요.')
  }
  writeCookie(res, '', 0)
}
export async function requireSession(req, db = adminClient()) {
  checkOrigin(req)
  const token = sessionToken(req)
  if (!token || !/^[a-f0-9]{64}$/.test(token)) throw fail(401, '보안을 위해 다시 로그인해주세요.')
  const { data: session, error } = await db.from('app_sessions').select('username,password_version')
    .eq('token_hash', hashToken(token)).gt('expires_at', new Date().toISOString()).maybeSingle()
  if (error) throw fail(503, '로그인 상태를 확인하지 못했습니다.')
  if (!session) throw fail(401, '로그인이 만료되었습니다. 다시 로그인해주세요.')
  const { data: user, error: userError } = await db.from('app_users')
    .select('username,household_id,display_name,password').eq('username', session.username).maybeSingle()
  if (userError) throw fail(503, '가구 정보를 확인하지 못했습니다.')
  if (!user?.household_id || !session.password_version || session.password_version !== hashToken(user.password)) throw fail(401, '로그인이 필요합니다.')
  delete user.password
  return { db, user }
}
export async function sessionView(db, user) {
  const [{ data: household, error: e1 }, { data: members, error: e2 }] = await Promise.all([
    db.from('households').select('dating_start,wedding_date,categories').eq('id', user.household_id).single(),
    db.from('app_users').select('username,display_name').eq('household_id', user.household_id),
  ])
  if (e1 || e2) throw fail(503, '가구 정보를 불러오지 못했습니다.')
  return { username: user.username, displayName: user.display_name, householdId: user.household_id,
    members: [user.display_name, ...members.filter(m => m.username !== user.username).map(m => m.display_name)],
    datingStart: household.dating_start, weddingDate: household.wedding_date, categories: household.categories }
}
export function apiError(res, error) {
  res.setHeader('Cache-Control', 'no-store')
  return res.status(error.status || 500).json({ error: error.status ? error.message : '요청을 처리하지 못했습니다. 다시 시도해주세요.', code:error.code || (error.status===401?'AUTH_REQUIRED':'SERVER') })
}

export async function rateLimit(db, key, limit) {
  const { data, error } = await db.rpc('hb_rate_limit', { p_key:key, p_limit:limit })
  if (error) throw Object.assign(fail(503,'로그인 보안 설정을 확인하지 못했습니다. 관리자에게 진단 코드를 전달해주세요.'),{code:'DB_SECURITY_NOT_READY'})
  if (!data) throw fail(429,'요청이 많습니다. 15분 후 다시 시도해주세요.')
}
