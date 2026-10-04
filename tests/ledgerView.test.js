import test from 'node:test'
import assert from 'node:assert/strict'
import { summarizeResults, copyTransaction, backupStorageKey, formatExportTime } from '../src/lib/ledgerView.js'

test('search totals separate internal transfers and include zero-result state', () => {
  assert.deepEqual(summarizeResults([]), { count:0,income:0,expense:0,received:0,sent:0 })
  assert.deepEqual(summarizeResults([
    {type:'income',category:'월급',amount:'100'}, {type:'expense',category:'식비',amount:20},
    {type:'expense',category:'배우자 이체',amount:30}, {type:'income',transfer_id:'pair',amount:30},
  ]),{count:4,income:100,expense:20,received:30,sent:30})
})
test('copy carries form fields but never IDs, authors or transfer identities', () => {
  const row={id:4,household_id:'private',author:'B',request_id:'old',date:'2026-10-04',type:'expense',category:'배우자 이체',amount:30,memo:'memo',owner:'A',transfer_id:'pair',linked_asset_id:5}
  const copy=copyTransaction(row,['A','B'],[{id:5,owner:'A'}])
  assert.equal(copy.linked_asset_id,'5')
  assert.equal(copy.date,row.date)
  assert.equal(copy.memo,'memo')
  for(const key of ['id','household_id','request_id','transfer_id','author']) assert.equal(copy[key],undefined)
  assert.equal(copyTransaction(row,['A'],[{id:5,owner:'A',deleted_at:'2026-01-01'}]).linked_asset_id,'')
  assert.equal(copyTransaction(row,['A'],[{id:5,owner:'B'}]).linked_asset_id,'')
  assert.throws(()=>copyTransaction({...row,type:'income'},['A'],[]))
  assert.throws(()=>copyTransaction(row,['B'],[]))
})
test('backup timestamp is account-scoped and rendered in Korean time', () => {
  assert.notEqual(backupStorageKey('h','a'),backupStorageKey('h','b'))
  assert.notEqual(backupStorageKey('h','a'),backupStorageKey('other','a'))
  assert.equal(formatExportTime(null),'기록 없음')
  assert.equal(formatExportTime('bad'),'기록 없음')
  assert.match(formatExportTime('2026-10-03T16:00:00Z'),/10\. 04\./)
})
