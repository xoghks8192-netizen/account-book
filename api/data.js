import { requireSession, fail } from '../server/auth.js'
import { columns, dataPlan } from '../server/dataPolicy.js'
import { handleBackup } from '../server/backup.js'
import { handleAssetOrder } from '../server/assetOrder.js'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') return res.status(405).json({ message: '허용되지 않는 요청입니다.' })
  try {
    const { db, user } = await requireSession(req)
    if (['asset-order-get', 'asset-order-save'].includes(req.body?.action)) return res.status(200).json(await handleAssetOrder(req.body, db, user))
    if (req.body?.action?.startsWith('backup-')) return await handleBackup(req,res,db,user)
    const p = dataPlan(req.body, user)
    if (p.values) {
      const { data: members, error } = await db.from('app_users').select('display_name').eq('household_id', user.household_id)
      if (error) throw fail(503,'가구 정보를 확인하지 못했습니다.')
      const owners = new Set(['공동', ...members.map(m => m.display_name)])
      if (p.values.owner !== undefined && !owners.has(p.values.owner)) throw fail(403,'가구 구성원을 선택해주세요.')
      if (p.values.author !== undefined && !owners.has(p.values.author)) throw fail(403,'가구 구성원을 선택해주세요.')
      if (p.table === 'assets') {
        const id = p.filters.find(([key,op]) => key === 'id' && op === 'eq')?.[2]
        let old = null
        if (id) {
          const { data, error: assetError } = await db.from('assets').select('category,owner').eq('id',id).eq('household_id',user.household_id).maybeSingle()
          if (assetError) throw fail(503,'자산을 확인하지 못했습니다.')
          old = data
        }
        const category = p.values.category ?? old?.category, owner = p.values.owner ?? old?.owner
        if (category === '비상금' && ![user.display_name,'공동'].includes(owner)) throw fail(403,'본인 또는 공동 비상금만 변경할 수 있습니다.')
        p.values.updated_at = new Date().toISOString()
      }
      if (p.values.linked_asset_id) {
        const { data, error: assetError } = await db.from('assets').select('owner,category,deleted_at')
          .eq('id',p.values.linked_asset_id).eq('household_id',user.household_id).maybeSingle()
        if (assetError || !data || data.deleted_at || (data.category === '비상금' && ![user.display_name,'공동'].includes(data.owner))) throw fail(403,'연동할 수 없는 자산입니다.')
      }
    }
    if (p.table === 'net_worth_snapshots' && p.write) {
      if (p.method !== 'POST' || !p.upsert || p.conflict !== 'household_id,snapshot_date') throw fail(400,'허용되지 않는 저장 요청입니다.')
      // Values come from the database, never from a forged client total.
      const { data, error } = await db.from('assets').select('amount,liquidity,category').eq('household_id',user.household_id).is('deleted_at',null).neq('category','비상금')
      if (error) throw fail(503,'자산 합계를 확인하지 못했습니다.')
      const total = data.reduce((s,a) => s + Number(a.amount),0)
      const liquid = data.filter(a => (a.liquidity || (['주택청약','연금저축','전세자금'].includes(a.category) ? '비유동' : '유동')) === '유동').reduce((s,a) => s + Number(a.amount),0)
      const date = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date())
      p.values = { household_id:user.household_id, snapshot_date:date, total:Math.round(total), liquid_total:Math.round(liquid), non_liquid_total:Math.round(total-liquid) }
    }
    let query = db.from(p.table)
    if (!p.write) query = query.select(p.select === '*' ? columns[p.table] : p.select)
    else if (p.method === 'PATCH') query = query.update(p.values)
    else if (p.method === 'DELETE') query = query.delete()
    else if (p.upsert) {
      if (p.table !== 'net_worth_snapshots') throw fail(403,'허용되지 않는 저장 요청입니다.')
      query = query.upsert(p.values, { onConflict:'household_id,snapshot_date' })
    } else query = query.insert(p.values)
    if (p.method !== 'POST') {
      query = query.eq(p.scopeColumn,p.scope)
      if (p.table === 'assets') query = query.or(`category.neq.비상금,owner.eq.${JSON.stringify(user.display_name)},owner.eq.공동`)
      for (const [key,op,val] of p.filters) query = query[op](key,val)
    }
    if (p.write && p.representation) query = query.select(p.select === '*' ? columns[p.table] : p.select)
    if (!p.write) {
      for (const [key,options] of p.orders) query = query.order(key,options)
      query = query.range(p.offset,p.offset + Math.max(1,p.limit) - 1)
    }
    if (p.single) query = query.single()
    const { data, error, status } = await query
    if (error) return res.status(error.code === 'PGRST116' ? 406 : 400).json({ code:error.code, message:'요청한 항목을 불러오거나 저장하지 못했습니다.' })
    return res.status(status === 201 ? 201 : 200).json(data)
  } catch (e) {
    return res.status(e.status || 500).json({ message:e.status ? e.message : '요청을 처리하지 못했습니다.', code:e.code || String(e.status || 500) })
  }
}
