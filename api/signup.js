import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'

// 새로 가입하는 가구의 기본 카테고리 (적금(...) 등 커스텀 카테고리는 가입 후 직접 추가)
const DEFAULT_CATEGORIES = {
  income: ['월급', '용돈', '부수입', '기타수입'],
  expense: ['식비', '생활비', '교통', '주거/통신', '쇼핑', '의료', '보험', '문화/여가', '교육', '카드값', '비상금', '기타지출'],
  asset: ['현금', '예적금', '주택청약', '주식', 'ISA계좌', '연금저축', '퇴직금', '전세자금', '비상금', '기타'],
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { username, password, displayName, partnerName, anniversaryType, anniversaryDate } = req.body
  const u = (username || '').trim()
  const dn = (displayName || '').trim()
  const pn = (partnerName || '').trim()
  const date = (anniversaryDate || '').trim()
  const type = anniversaryType === 'wedding' ? 'wedding' : 'dating'
  const dateColumn = type === 'wedding' ? 'wedding_date' : 'dating_start'

  if (!u || !password || !dn || !pn || !date) {
    return res.status(400).json({ error: '모든 항목을 입력해주세요.' })
  }
  if (password.length < 4) {
    return res.status(400).json({ error: '비밀번호는 4자 이상으로 입력해주세요.' })
  }

  try {
    const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

    const { data: existingUser } = await supabase
      .from('app_users')
      .select('username')
      .eq('username', u)
      .maybeSingle()
    if (existingUser) return res.status(409).json({ error: '이미 사용 중인 아이디입니다.' })

    // 상대방이 나를 자신의 짝으로 등록해뒀는지 확인 (이름과 기념일이 모두 일치해야 매칭)
    const { data: candidates } = await supabase
      .from('app_users')
      .select('username, household_id')
      .eq('display_name', pn)
      .eq('partner_name', dn)

    let householdId = null
    if (candidates) {
      for (const c of candidates) {
        const { data: household } = await supabase
          .from('households')
          .select('id, dating_start, wedding_date')
          .eq('id', c.household_id)
          .maybeSingle()
        if (!household || household[dateColumn] !== date) continue

        const { count } = await supabase
          .from('app_users')
          .select('*', { count: 'exact', head: true })
          .eq('household_id', c.household_id)
        if (count >= 2) continue

        householdId = c.household_id
        break
      }
    }

    if (!householdId) {
      const { data: household, error: hhError } = await supabase
        .from('households')
        .insert({ [dateColumn]: date, categories: DEFAULT_CATEGORIES })
        .select()
        .single()
      if (hhError) return res.status(500).json({ error: hhError.message })
      householdId = household.id
    }

    const hash = await bcrypt.hash(password, 10)
    const { error: insertError } = await supabase.from('app_users').insert({
      username: u,
      password: hash,
      household_id: householdId,
      display_name: dn,
      partner_name: pn,
    })
    if (insertError) return res.status(500).json({ error: insertError.message })

    return res.status(200).json({ ok: true })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
