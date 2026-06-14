import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'

const MAX_ATTEMPTS = 5
const WINDOW_MIN = 15

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { username, displayName, partnerName, anniversaryType, anniversaryDate, newPassword } = req.body
  const u = (username || '').trim()
  const dn = (displayName || '').trim()
  const pn = (partnerName || '').trim()
  const date = (anniversaryDate || '').trim()
  const type = anniversaryType === 'wedding' ? 'wedding' : 'dating'
  const dateColumn = type === 'wedding' ? 'wedding_date' : 'dating_start'

  if (!u || !dn || !pn || !date || !newPassword) {
    return res.status(400).json({ error: '모든 항목을 입력해주세요.' })
  }
  if (newPassword.length < 4) {
    return res.status(400).json({ error: '새 비밀번호는 4자 이상으로 입력해주세요.' })
  }

  const ip = req.headers['x-forwarded-for']?.split(',')[0] || 'unknown'
  const identifier = `reset:${ip}:${u}`

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
      return res.status(429).json({ error: `${MAX_ATTEMPTS}회 일치하지 않았어요. ${WINDOW_MIN}분 후 다시 시도해주세요.` })
    }

    const { data: user } = await supabase
      .from('app_users')
      .select('username, display_name, partner_name, household_id')
      .eq('username', u)
      .maybeSingle()

    let ok = !!user && user.display_name === dn && user.partner_name === pn

    if (ok) {
      const { data: household } = await supabase
        .from('households')
        .select(dateColumn)
        .eq('id', user.household_id)
        .maybeSingle()
      ok = !!household && household[dateColumn] === date
    }

    if (!ok) {
      await supabase.from('login_attempts').insert({ identifier })
      return res.status(401).json({ error: '입력한 정보가 일치하지 않습니다.' })
    }

    await supabase.from('login_attempts').delete().eq('identifier', identifier)

    const hash = await bcrypt.hash(newPassword, 10)
    const { error } = await supabase.from('app_users').update({ password: hash }).eq('username', u)
    if (error) return res.status(500).json({ error: error.message })

    return res.status(200).json({ ok: true })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
