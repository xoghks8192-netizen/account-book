import { requireSession, apiError, fail } from '../server/auth.js'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') return res.status(405).json({ error: '허용되지 않는 요청입니다.' })
  try {
    const { db, user } = await requireSession(req)
    const { action, id = null, fields = {}, requestId } = req.body || {}
    if (!['add','update','delete','undo','status'].includes(action) || !/^[a-f0-9-]{36}$/i.test(requestId || '')) throw fail(400, '잘못된 요청입니다.')
    if (action === 'undo' && !/^[a-f0-9-]{36}$/i.test(fields?.delete_request || '')) throw fail(400, '실행 취소 요청을 확인해주세요.')
    if (action === 'status') {
      const {data:receipt,error} = await db.from('app_mutation_requests').select('result')
        .eq('household_id',user.household_id).eq('actor',user.username).eq('request_id',requestId).maybeSingle()
      if(error) throw fail(503,'저장 결과를 확인하지 못했습니다.')
      if(!receipt) return res.status(200).json({state:'unconfirmed'})
      const ids=[...(receipt.result.removedIds||[]),...(receipt.result.rows||[]).map(r=>r.id)]
      const {data:rows,error:readError}=ids.length
        ? await db.from('transactions').select('*').eq('household_id',user.household_id).in('id',ids)
        : {data:[],error:null}
      if(readError) throw fail(503,'저장 결과를 확인하지 못했습니다.')
      return res.status(200).json({state:'confirmed',result:{...receipt.result,rows,removedIds:ids}})
    }
    const { data, error } = await db.rpc('hb_mutate_transaction', {
      p_actor: user.username, p_action: action, p_id: id, p_fields: fields, p_request: requestId,
    })
    if (error) {
      if (error.code === 'P0001') throw fail(400, error.message)
      throw fail(503, '내역을 저장하지 못했습니다. 입력 내용은 유지됩니다.')
    }
    return res.status(200).json(data)
  } catch (e) { return apiError(res, e) }
}
