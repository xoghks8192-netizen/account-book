import { supabase } from './supabase'
import { toCSV, downloadCSV } from './csv'
import { todayKst } from './dates'

// Keep existing export available until the additive backup SQL is installed.
export async function exportLegacyCsv(householdId) {
  async function all(table) {
    const rows=[]
    for(let offset=0;;offset+=500) {
      const {data,error}=await supabase.from(table).select('*').eq('household_id',householdId).order('id').range(offset,offset+499)
      if(error)throw new Error('백업 데이터를 읽지 못했습니다. 다시 시도해주세요.')
      rows.push(...data)
      if(data.length<500)return rows
    }
  }
  const [transactions,assets,recurring]=await Promise.all(['transactions','assets','recurring_templates'].map(all))
  const date=todayKst()
  downloadCSV('거래내역_'+date+'.csv',toCSV(
    ['날짜','구분','유형','카테고리','금액','메모','작성자','연동자산ID'],
    transactions.map(t=>[t.date,t.owner,t.type==='income'?'수입':'지출',t.category,t.amount,t.memo,t.author,t.linked_asset_id])))
  downloadCSV('자산_'+date+'.csv',toCSV(['이름','카테고리','유동성','구분','금액'],
    assets.map(a=>[a.name,a.category,a.liquidity,a.owner,a.amount])))
  downloadCSV('고정지출수입_'+date+'.csv',toCSV(['이름','유형','카테고리','금액','메모','구분','연동자산ID'],
    recurring.map(t=>[t.name,t.type==='income'?'수입':'지출',t.category,t.amount,t.memo,t.author,t.linked_asset_id])))
}
