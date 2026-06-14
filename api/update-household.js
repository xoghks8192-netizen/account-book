import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { username, datingStart, weddingDate } = req.body
  if (!username) return res.status(400).json({ error: '입력값이 올바르지 않습니다.' })

  const dating = datingStart || null
  const wedding = weddingDate || null

  try {
    const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

    const { data: me } = await supabase
      .from('app_users')
      .select('household_id, display_name, partner_name')
      .eq('username', username)
      .maybeSingle()
    if (!me) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' })

    let householdId = me.household_id
    await supabase.from('households').update({ dating_start: dating, wedding_date: wedding }).eq('id', householdId)

    const { count } = await supabase
      .from('app_users')
      .select('*', { count: 'exact', head: true })
      .eq('household_id', householdId)

    // 아직 혼자인 가구라면, 입력한 기념일이 상대방과 일치하는지 확인해서 자동으로 연결 시도
    if (count === 1 && me.display_name && me.partner_name) {
      const { data: candidates } = await supabase
        .from('app_users')
        .select('username, household_id')
        .eq('display_name', me.partner_name)
        .eq('partner_name', me.display_name)
        .neq('household_id', householdId)

      for (const c of candidates ?? []) {
        const { count: cCount } = await supabase
          .from('app_users')
          .select('*', { count: 'exact', head: true })
          .eq('household_id', c.household_id)
        if (cCount !== 1) continue

        const { data: cHousehold } = await supabase
          .from('households')
          .select('dating_start, wedding_date')
          .eq('id', c.household_id)
          .maybeSingle()
        if (!cHousehold) continue

        const datingConflict = dating && cHousehold.dating_start && dating !== cHousehold.dating_start
        const weddingConflict = wedding && cHousehold.wedding_date && wedding !== cHousehold.wedding_date
        if (datingConflict || weddingConflict) continue

        const datingMatch = dating && cHousehold.dating_start && dating === cHousehold.dating_start
        const weddingMatch = wedding && cHousehold.wedding_date && wedding === cHousehold.wedding_date
        if (!datingMatch && !weddingMatch) continue

        const mergedDating = dating || cHousehold.dating_start || null
        const mergedWedding = wedding || cHousehold.wedding_date || null

        await supabase
          .from('households')
          .update({ dating_start: mergedDating, wedding_date: mergedWedding })
          .eq('id', c.household_id)
        await supabase.from('app_users').update({ household_id: c.household_id }).eq('username', username)
        await supabase.from('households').delete().eq('id', householdId)

        householdId = c.household_id
        break
      }
    }

    const { data: memberRows } = await supabase
      .from('app_users')
      .select('display_name')
      .eq('household_id', householdId)
    const { data: household } = await supabase
      .from('households')
      .select('dating_start, wedding_date, categories')
      .eq('id', householdId)
      .maybeSingle()

    const others = (memberRows ?? []).map((m) => m.display_name).filter((n) => n !== me.display_name)
    const members = [me.display_name, ...others]

    return res.status(200).json({
      householdId,
      members,
      datingStart: household?.dating_start ?? null,
      weddingDate: household?.wedding_date ?? null,
      categories: household?.categories ?? null,
    })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
