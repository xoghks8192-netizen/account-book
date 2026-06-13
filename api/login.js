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
      .select('username, password')
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

    return res.status(200).json({ username })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
