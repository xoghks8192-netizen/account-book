// 배우자 이체 시 상대방에게 자동 등록되는 수입 카테고리 (수입 통계에서 제외)
export const TRANSFER_CATEGORY = '배우자 이체'

// 새로 가입하는 가구의 기본 카테고리 (적금(...) 등 커스텀 카테고리는 직접 추가)
export const DEFAULT_CATEGORIES = {
  income: ['월급', '용돈', '부수입', '기타수입'],
  expense: [
    '식비',
    '생활비',
    '교통',
    '주거/통신',
    '쇼핑',
    '의료',
    '보험',
    '문화/여가',
    '교육',
    '카드값',
    '비상금',
    '기타지출',
  ],
  asset: ['현금', '예적금', '주택청약', '주식', 'ISA계좌', '연금저축', '퇴직금', '전세자금', '비상금', '기타'],
}

export const EXPENSE_CATEGORY_COLORS = {
  식비: '#ffb3c6',
  생활비: '#ffdac1',
  교통: '#ffd6a5',
  '주거/통신': '#fdffb6',
  쇼핑: '#caffbf',
  의료: '#9bf6ff',
  보험: '#c8b6ff',
  '문화/여가': '#a0c4ff',
  교육: '#bdb2ff',
  카드값: '#ffc6ff',
  '적금(주택청약)': '#fdffb6',
  '적금(연금저축)': '#9bf6ff',
  '적금(ISA계좌)': '#ffd6e8',
  비상금: '#ffc6ff',
  기타지출: '#e0c3cf',
}

// 위 목록에 없는 새 카테고리(직접 추가한 카테고리)에 자동으로 배정되는 색상
const FALLBACK_CATEGORY_COLORS = [
  '#ffafcc', '#a2d2ff', '#cdb4db', '#ffd6a5', '#b9fbc0',
  '#90dbf4', '#fbc4ab', '#d0bdf4', '#a3c4f3', '#ffc8dd',
]

export function getCategoryColor(category) {
  if (EXPENSE_CATEGORY_COLORS[category]) return EXPENSE_CATEGORY_COLORS[category]
  let hash = 0
  for (let i = 0; i < category.length; i++) {
    hash = (hash * 31 + category.charCodeAt(i)) % FALLBACK_CATEGORY_COLORS.length
  }
  return FALLBACK_CATEGORY_COLORS[hash]
}
