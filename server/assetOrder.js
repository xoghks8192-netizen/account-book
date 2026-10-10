import { fail } from './auth.js'

export function validateAssetOrder(ids) {
  if (!Array.isArray(ids) || ids.length > 1000 || ids.some(id => !Number.isSafeInteger(id) || id <= 0) || new Set(ids).size !== ids.length) throw fail(400, '자산 순서를 확인해주세요.')
  return ids
}

export async function handleAssetOrder(input, db, user) {
  const scope = () => db.from('app_asset_order').select('asset_ids').eq('username', user.username).eq('household_id', user.household_id).maybeSingle()
  const { data: saved, error: readError } = await scope()
  if (readError) throw fail(503, '자산 순서 동기화 설정을 확인해주세요. 관리자 SQL 026 실행이 필요할 수 있어요.')
  const { data: assets, error } = await db.from('assets').select('id,owner,category').eq('household_id', user.household_id).is('deleted_at', null)
  if (error) throw fail(503, '자산 목록을 확인하지 못했습니다.')
  const visible = new Set(assets.filter(a => a.category !== '비상금' || [user.display_name, '공동'].includes(a.owner)).map(a => Number(a.id)))
  if (input.action === 'asset-order-get') return { ids: saved ? saved.asset_ids.filter(id => visible.has(id)) : null }
  if (input.action !== 'asset-order-save') throw fail(400, '허용되지 않는 요청입니다.')
  // Deleted/moved assets are discarded; the client cannot assign another account's order.
  const ids = validateAssetOrder(input.ids).filter(id => visible.has(id))
  const { error: writeError } = await db.from('app_asset_order').upsert({ username: user.username, household_id: user.household_id, asset_ids: ids, updated_at: new Date().toISOString() }, { onConflict: 'username,household_id' })
  if (writeError) throw fail(503, '순서를 저장하지 못했습니다. 다시 시도해주세요.')
  return { ids }
}
