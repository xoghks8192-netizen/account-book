import bcrypt from 'bcryptjs'
import { adminClient, checkOrigin, fail, hashToken, rateLimit, apiError } from '../server/auth.js'

const DEFAULT_CATEGORIES = {
  income: ['월급', '용돈', '부수입', '기타수입'],
  expense: ['식비', '생활비', '교통', '주거/통신', '쇼핑', '의료', '보험', '문화/여가', '교육', '카드값', '비상금', '기타지출'],
  asset: ['현금', '예적금', '주택청약', '주식', 'ISA계좌', '연금저축', '퇴직금', '전세자금', '비상금', '기타'],
}

export default async function handler(req,res) {
  if (req.method !== 'POST') return res.status(405).json({error:'허용되지 않는 요청입니다.'})
  try {
    checkOrigin(req)
    const {username,password,displayName,partnerName,anniversaryType,anniversaryDate,inviteCode} = req.body || {}
    if (![username,displayName,partnerName].every(v => typeof v === 'string' && v.trim().length > 0 && v.length <= 100) ||
      typeof password !== 'string' || password.length < 8 || password.length > 200) throw fail(400,'이름·아이디와 8자 이상의 비밀번호를 입력해주세요.')
    if (!['dating','wedding'].includes(anniversaryType) || typeof anniversaryDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(anniversaryDate)) throw fail(400,'기념일을 확인해주세요.')
    const code = typeof inviteCode === 'string' ? inviteCode.trim() : ''
    if (code && !/^[a-f0-9]{64}$/.test(code)) throw fail(400,'초대 코드를 확인해주세요.')
    const db = adminClient()
    const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0]
    await rateLimit(db,'signup:' + hashToken(ip),10)
    const hash = await bcrypt.hash(password,10)
    const {error} = await db.rpc('hb_signup',{
      p_username:username.trim(),p_hash:hash,p_name:displayName.trim(),p_partner:partnerName.trim(),
      p_date:anniversaryDate,p_date_type:anniversaryType,p_categories:DEFAULT_CATEGORIES,p_invite_hash:code ? hashToken(code) : null,
    })
    if (error?.code === '23505') throw fail(409,'이미 사용 중인 아이디입니다.')
    if (error?.code === 'P0001') throw fail(400,error.message)
    if (error) throw fail(503,'가입하지 못했습니다. 잠시 후 다시 시도해주세요.')
    return res.status(200).json({ok:true})
  } catch(e) { return apiError(res,e) }
}
