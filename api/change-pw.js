import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'

async function verifyPw(input, stored) {
  if (stored && stored.startsWith('$2')) return bcrypt.compare(input, stored)
  return input === stored
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { username, currentPassword, newPassword } = req.body
  if (!username || !currentPassword || !newPassword) {
    return res.status(400).json({ error: '입력값이 올바르지 않습니다.' })
  }
  if (newPassword.length < 4) {
    return res.status(400).json({ error: '새 비밀번호는 4자 이상으로 입력해주세요.' })
  }

  const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

  try {
    const { data } = await supabase
      .from('app_users')
      .select('password')
      .eq('username', username)
      .maybeSingle()

    if (!data || !(await verifyPw(currentPassword, data.password))) {
      return res.status(401).json({ error: '현재 비밀번호가 올바르지 않습니다.' })
    }

    const hash = await bcrypt.hash(newPassword, 10)
    const { error } = await supabase.from('app_users').update({ password: hash }).eq('username', username)
    if (error) return res.status(500).json({ error: error.message })

    return res.status(200).json({ ok: true })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
