import test from 'node:test'
import assert from 'node:assert/strict'
import { handleAssetOrder, validateAssetOrder } from '../server/assetOrder.js'
import { summarizeResults, isTransfer } from '../src/lib/ledgerView.js'
import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'

test('transfer classification is consistent for legacy and linked rows on both sides', () => {
  const rows = [
    {type:'income',category:'월급',amount:1000}, {type:'expense',category:'식비',amount:300},
    {type:'income',category:'배우자 이체',amount:400}, {type:'expense',category:'배우자 이체',amount:400},
    {type:'income',category:'이름 변경됨',transfer_id:'pair',amount:200}, {type:'expense',category:'이름 변경됨',transfer_id:'pair',amount:200},
  ]
  assert.deepEqual(summarizeResults(rows), {count:6,income:1000,expense:300,received:600,sent:600})
  assert.equal(rows.filter(isTransfer).length,4)
})

test('asset order rejects malformed identifiers and duplicates', () => {
  for (const ids of [null, {}, [1,1], [-1], [1.2], ['1'], Array.from({length:1001},(_,i)=>i+1)]) assert.throws(()=>validateAssetOrder(ids))
  assert.deepEqual(validateAssetOrder([3,1,2]),[3,1,2])
})

function fakeDb(saved) {
  const filters=[], writes=[]
  return {filters,writes,from(table) {
    const q={select(){return q},eq(k,v){filters.push([table,k,v]);return q},is(){return q},
      async maybeSingle(){return {data:saved,error:null}},
      async upsert(v){writes.push(v);return {error:null}},
      then(resolve){return Promise.resolve({data:[{id:1,owner:'me',category:'현금'},{id:2,owner:'partner',category:'비상금'},{id:3,owner:'공동',category:'현금'}],error:null}).then(resolve)}}
    return q
  }}
}
const user={username:'account-A',household_id:'household-A',display_name:'me'}
test('saved order is account scoped and excludes private or foreign assets', async () => {
  const db=fakeDb({asset_ids:[3,2,99,1]})
  assert.deepEqual(await handleAssetOrder({action:'asset-order-get'},db,user),{ids:[3,1]})
  assert.ok(db.filters.some(f=>f[0]==='app_asset_order'&&f[1]==='username'&&f[2]===user.username))
  assert.ok(db.filters.some(f=>f[0]==='app_asset_order'&&f[1]==='household_id'&&f[2]===user.household_id))
  assert.deepEqual(await handleAssetOrder({action:'asset-order-save',ids:[3,2,99,1],username:'other'},db,user),{ids:[3,1]})
  assert.equal(db.writes[0].username,'account-A')
  assert.equal(db.writes[0].household_id,'household-A')
})
test('an account without saved preferences is distinguishable from an empty order', async () => {
  assert.deepEqual(await handleAssetOrder({action:'asset-order-get'},fakeDb(null),user),{ids:null})
  assert.deepEqual(await handleAssetOrder({action:'asset-order-get'},fakeDb({asset_ids:[]}),user),{ids:[]})
})

test('asset-order migration is repeatable and blocks anonymous access', async () => {
  const db = new PGlite()
  try {
    await db.exec('create role anon; create role authenticated; create role service_role; create table app_users(username text primary key); create table households(id uuid primary key);')
    const sql = await readFile(new URL('../sql/026_asset_order.sql', import.meta.url),'utf8')
    await db.exec(sql); await db.exec(sql)
    await db.exec('set role anon')
    await assert.rejects(()=>db.query('select * from app_asset_order'))
    await db.exec('reset role; set role authenticated')
    await assert.rejects(()=>db.query('select * from app_asset_order'))
  } finally { await db.close() }
})
