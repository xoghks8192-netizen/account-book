import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'
import { signBackup,verifyBackup } from '../server/backup.js'
import { mutationRequest } from '../src/lib/mutationRequest.js'

test('signed backup rejects edits, wrong accounts and duplicate IDs',()=>{
 const user={username:'a',household_id:'h'}
 const payload=JSON.stringify({username:'a',householdId:'h',data:{assets:[],transactions:[{id:1}],recurring_templates:[]}})
 const file={format:'household-budget-backup',version:1,payload,signature:signBackup(payload,'test-only')}
 assert.equal(verifyBackup(file,user,'test-only').data.transactions.length,1)
 assert.throws(()=>verifyBackup({...file,payload:payload+' '},user,'test-only'))
 assert.throws(()=>verifyBackup(file,{...user,username:'b'},'test-only'))
 assert.throws(()=>verifyBackup(file,{...user,household_id:'other'},'test-only'))
 assert.throws(()=>verifyBackup(file,user,'rotated-secret'))
 assert.throws(()=>verifyBackup({format:'csv'},user,'test-only'))
 const duplicated=JSON.stringify({username:'a',householdId:'h',data:{assets:[],transactions:[{id:1},{id:1}],recurring_templates:[]}})
 assert.throws(()=>verifyBackup({...file,payload:duplicated,signature:signBackup(duplicated,'test-only')},user,'test-only'))
})

test('mutation distinguishes rejection from unknown network/server outcome',async()=>{
 await assert.rejects(()=>mutationRequest({},async()=>{throw new TypeError('offline')}),e=>e.uncertain===true)
 await assert.rejects(()=>mutationRequest({},async()=>new Response(JSON.stringify({error:'invalid'}),{status:400})),e=>e.uncertain===false&&e.status===400)
 await assert.rejects(()=>mutationRequest({},async()=>new Response('{}',{status:503})),e=>e.uncertain===true)
 assert.deepEqual(await mutationRequest({},async()=>new Response('{"ok":true}')),{ok:true})
})

test('backup preview, atomic restore, privacy and idempotency in PostgreSQL',async()=>{
 const db=new PGlite()
 try{
  await db.exec('create role anon;create role authenticated;create role service_role bypassrls;')
  for(const file of ['schema.sql','003_assets.sql','004_stock_fields.sql','005_liquidity.sql','007_recurring_templates.sql','008_recurring_author.sql','009_transaction_owner.sql','010_app_users.sql','011_asset_ticker.sql','012_linked_asset.sql','013_recurring_sort_order.sql']){
   await db.exec(await readFile(new URL('../sql/'+file,import.meta.url),'utf8'))
  }
  await db.exec(`
   create table households(id uuid primary key default gen_random_uuid(),dating_start date,wedding_date date,categories jsonb);
   alter table app_users add column household_id uuid references households,add column display_name text,add column partner_name text;
   alter table transactions add column household_id uuid references households;
   alter table assets add column household_id uuid references households,add column deleted_at timestamptz;
   alter table recurring_templates add column household_id uuid references households;
  `)
  for(const file of ['020_security_prepare.sql','021_atomic_operations.sql','024_backup_restore.sql','024_backup_restore.sql'])await db.exec(await readFile(new URL('../sql/'+file,import.meta.url),'utf8'))
  const h=randomUUID()
  await db.query("insert into households(id) values($1)",[h])
  await db.query("insert into app_users(username,password,display_name,partner_name,household_id) values('a','hash','A','B',$1),('b','hash','B','A',$1)",[h])
  await db.query("insert into assets(name,category,owner,amount,household_id) values('visible','현금','A',1000,$1),('private','비상금','B',9999,$1)",[h])
  await db.query("insert into recurring_templates(name,type,category,amount,author,household_id) values('fixed','expense','기타지출',100,'A',$1)",[h])
  const mutation=(await db.query("select hb_mutate_transaction('a','add',null,$1::jsonb,$2) r",[JSON.stringify({date:'2026-10-02',type:'expense',category:'배우자 이체',amount:100,owner:'A'}),randomUUID()])).rows[0].r
  const call=async(mode,data=null,request=randomUUID(),actor='a')=>(await db.query('select hb_backup($1,$2,$3::jsonb,$4) r',[actor,mode,data?JSON.stringify(data):null,request])).rows[0].r
  const backup=await call('export')
  assert.equal(backup.assets.length,1)
  assert.equal(backup.assets[0].name,'visible')
  assert.equal(backup.transactions.length,2)
  let preview=await call('preview',backup)
  assert.equal(preview.added.transactions,0)
  assert.equal(preview.skipped.assets,1)
  await db.query("select hb_mutate_transaction('a','delete',$1,'{}'::jsonb,$2)",[mutation.primary.id,randomUUID()])
  await db.query('delete from recurring_templates')
  await db.query('delete from assets where id=$1',[backup.assets[0].id])
  preview=await call('preview',backup)
  assert.equal(preview.added.transactions,2)
  assert.equal(preview.added.assets,1)
  const request=randomUUID()
  const restored=await call('restore',backup,request)
  assert.deepEqual(restored.added,{assets:1,transactions:2,recurring_templates:1})
  assert.deepEqual(await call('restore',backup,request),restored)
  assert.equal((await call('preview',backup)).added.transactions,0)
  const differentRequest=await call('restore',backup)
  assert.equal(differentRequest.added.assets,0)
  assert.equal(Number((await db.query('select amount from assets where id=$1',[backup.assets[0].id])).rows[0].amount),1000)
  // Partial pair must fail, never silently synthesize a counterpart.
  await db.query('delete from transactions where id=$1',[backup.transactions[0].id])
  await assert.rejects(()=>call('restore',backup))
  assert.equal((await db.query('select count(*)::int n from transactions')).rows[0].n,1)
  // Demonstrate all-or-nothing rollback if a later insert is invalid.
  await db.query('delete from transactions')
  await db.query('delete from assets where id=$1',[backup.assets[0].id])
  const bad=structuredClone(backup);bad.transactions[0].amount=-1
  await assert.rejects(()=>call('restore',bad))
  assert.equal((await db.query('select count(*)::int n from assets where id=$1',[backup.assets[0].id])).rows[0].n,0)
  await db.exec('set role anon')
  await assert.rejects(()=>call('export'))
 }finally{await db.close()}
})
