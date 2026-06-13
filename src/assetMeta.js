export const ASSET_CATEGORIES = [
  '현금',
  '예적금',
  '주택청약',
  '주식',
  'ISA계좌',
  '연금저축',
  '퇴직금',
  '전세자금',
  '비상금',
  '기타',
]

export const STOCK_CATEGORIES = ['주식', 'ISA계좌', '연금저축']

export const NON_LIQUID_CATEGORIES = ['전세자금', '연금저축', '주택청약']

export const LIQUIDITY_OPTIONS = ['유동', '비유동']

export function defaultLiquidity(category) {
  return NON_LIQUID_CATEGORIES.includes(category) ? '비유동' : '유동'
}

export const OWNERS = ['박태환', '류진주', '공동']

export const CATEGORY_COLORS = {
  현금: '#ffb3c6',
  예적금: '#ffd6a5',
  주택청약: '#fdffb6',
  주식: '#caffbf',
  ISA계좌: '#ffd6e8',
  연금저축: '#9bf6ff',
  퇴직금: '#a0c4ff',
  전세자금: '#bdb2ff',
  비상금: '#ffc6ff',
  기타: '#e0c3cf',
}
