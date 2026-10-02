import { fail } from './auth.js'

export const columns = {
  households: 'id,dating_start,wedding_date,categories,created_at',
  transactions: 'id,date,type,category,amount,memo,owner,author,household_id,linked_asset_id,created_at,transfer_id,request_id',
  assets: 'id,name,category,owner,amount,memo,household_id,created_at,updated_at,shares,avg_price,current_price,liquidity,ticker,deleted_at',
  recurring_templates: 'id,name,type,category,amount,memo,author,linked_asset_id,household_id,sort_order,created_at',
  net_worth_snapshots: 'id,household_id,snapshot_date,total,liquid_total,non_liquid_total,created_at',
}
const writable = {
  households: ['categories'],
  assets: ['name','category','owner','amount','memo','shares','avg_price','current_price','liquidity','ticker','deleted_at','updated_at'],
  recurring_templates: ['name','type','category','amount','memo','author','linked_asset_id','sort_order'],
  net_worth_snapshots: ['snapshot_date','total','liquid_total','non_liquid_total'],
}
export function dataPlan(input, user) {
  const { table, method = 'GET', params = [], body = null, accept = '', prefer = '' } = input || {}
  if (!Object.hasOwn(columns, table) || !['GET','HEAD','POST','PATCH','DELETE'].includes(method)) throw fail(400, '허용되지 않는 요청입니다.')
  if (!Array.isArray(params) || params.length > 30) throw fail(400, '잘못된 조회 조건입니다.')
  const allowed = new Set(columns[table].split(','))
  const query = new URLSearchParams(params)
  const select = query.get('select') || '*'
  if (select !== '*' && select.split(',').some(c => !allowed.has(c.trim()))) throw fail(400, '허용되지 않는 조회 항목입니다.')
  const filters = [], orders = []
  for (const [key, value] of query) {
    if (['select','on_conflict','columns'].includes(key)) continue
    if (key === 'order') {
      for (const part of value.split(',')) {
        const [field, direction = 'asc', nulls] = part.split('.')
        if (!allowed.has(field) || !['asc','desc'].includes(direction) || (nulls && !['nullsfirst','nullslast'].includes(nulls))) throw fail(400,'정렬 조건이 올바르지 않습니다.')
        orders.push([field, { ascending: direction === 'asc', nullsFirst: nulls === 'nullsfirst' }])
      }
      continue
    }
    if (key === 'limit' || key === 'offset') {
      if (!/^\d+$/.test(value) || Number(value) > 10000) throw fail(400,'조회 범위를 확인해주세요.')
      continue
    }
    if (!allowed.has(key)) throw fail(400,'허용되지 않는 조회 조건입니다.')
    const dot = value.indexOf('.')
    const op = value.slice(0, dot), val = value.slice(dot + 1)
    if (!['eq','neq','gte','gt','lte','lt','is'].includes(op)) throw fail(400,'허용되지 않는 조회 조건입니다.')
    filters.push([key, op, op === 'is' && val === 'null' ? null : val])
  }
  const write = !['GET','HEAD'].includes(method)
  if (write && (table === 'transactions' || (table === 'households' && method !== 'PATCH'))) throw fail(403,'전용 저장 기능을 사용해주세요.')
  if (['PATCH','DELETE'].includes(method) && !filters.some(([k,op]) => k === 'id' && op === 'eq')) throw fail(400,'수정할 항목을 선택해주세요.')
  let values
  if (write && method !== 'DELETE') {
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw fail(400,'입력 형식을 확인해주세요.')
    if (Object.keys(body).some(key => key !== 'household_id' && !writable[table].includes(key))) throw fail(400,'변경할 수 없는 항목입니다.')
    values = { ...body }
    delete values.household_id
    if (method === 'POST') values.household_id = user.household_id
    for (const [key, val] of Object.entries(values)) {
      if (typeof val === 'string' && val.length > 2000) throw fail(400,'입력 내용이 너무 깁니다.')
      if (['amount','shares','avg_price','current_price','sort_order'].includes(key)
        && val !== null && (!Number.isFinite(Number(val)) || Number(val) < 0 || Number(val) > 9e12)) throw fail(400,'금액을 확인해주세요.')
    }
    if (table === 'households') {
      const c = values.categories
      if (!c || !['income','expense','asset'].every(k => Array.isArray(c[k]) && c[k].length > 0 && c[k].length <= 100 && c[k].every(v => typeof v === 'string' && v.trim().length > 0 && v.length <= 100))) throw fail(400,'분류 목록을 확인해주세요.')
    }
  }
  return { table, method, select, filters, orders, values, write,
    single: accept.includes('vnd.pgrst.object'), representation: prefer.includes('return=representation'),
    upsert: prefer.includes('resolution=merge-duplicates'),
    limit: Number(query.get('limit') || 1000), offset: Number(query.get('offset') || 0),
    conflict: query.get('on_conflict'), scopeColumn: table === 'households' ? 'id' : 'household_id', scope: user.household_id }
}
