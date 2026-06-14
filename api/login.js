import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'

const MAX_ATTEMPTS = 5
const WINDOW_MIN = 15

async function verifyPw(input, stored) {
  if (stored && stored.startsWith('$2')) return bcrypt.compare(input, stored)
  return input === stored
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { username, password } = req.body
  if (!username || !password) return res.status(400).json({ error: '아이디와 비밀번호를 입력해주세요.' })

  const ip = req.headers['x-forwarded-for']?.split(',')[0] || 'unknown'
  const identifier = `${ip}:${username}`

  try {
    const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
    const cutoff = new Date(Date.now() - WINDOW_MIN * 60 * 1000).toISOString()
    supabase.from('login_attempts').delete().lt('created_at', cutoff) // 오래된 기록 정리 (await 안 함)

    const { count } = await supabase
      .from('login_attempts')
      .select('*', { count: 'exact', head: true })
      .eq('identifier', identifier)
      .gte('created_at', cutoff)
    if (count >= MAX_ATTEMPTS) {
      return res.status(429).json({ error: `비밀번호를 ${MAX_ATTEMPTS}회 틀렸어요. ${WINDOW_MIN}분 후 다시 시도해주세요.` })
    }

    const { data } = await supabase
      .from('app_users')
      .select('username, password, household_id, display_name')
      .eq('username', username)
      .maybeSingle()

    if (!data || !(await verifyPw(password, data.password))) {
      await supabase.from('login_attempts').insert({ identifier })
      return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' })
    }

    await supabase.from('login_attempts').delete().eq('identifier', identifier)

    // 평문 비밀번호로 로그인 성공 시 bcrypt 해시로 자동 업그레이드
    if (!data.password.startsWith('$2')) {
      const hash = await bcrypt.hash(password, 10)
      await supabase.from('app_users').update({ password: hash }).eq('username', username)
    }

    let members = [data.display_name]
    let datingStart = null
    let weddingDate = null
    let categories = null

    if (data.household_id) {
      const [{ data: partners }, { data: household }] = await Promise.all([
        supabase
          .from('app_users')
          .select('display_name')
          .eq('household_id', data.household_id)
          .neq('username', username),
        supabase
          .from('households')
          .select('dating_start, wedding_date, categories')
          .eq('id', data.household_id)
          .maybeSingle(),
      ])
      if (partners && partners.length > 0) {
        members = [data.display_name, ...partners.map((p) => p.display_name)]
      }
      if (household) {
        datingStart = household.dating_start
        weddingDate = household.wedding_date
        categories = household.categories
      }
    }

    return res.status(200).json({
      username: data.username,
      displayName: data.display_name,
      householdId: data.household_id,
      members,
      datingStart,
      weddingDate,
      categories,
    })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
