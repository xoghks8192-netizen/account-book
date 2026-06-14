-- 가구별 거래 카테고리(수입/지출) 커스터마이즈
alter table households add column if not exists categories jsonb;

-- 기존 가구는 적금(주택청약/연금저축/ISA계좌) 등 기존에 쓰던 전체 카테고리를 그대로 유지
update households
set categories = '{
  "income": ["월급", "용돈", "부수입", "기타수입"],
  "expense": ["식비", "생활비", "교통", "주거/통신", "쇼핑", "의료", "보험", "문화/여가", "교육", "카드값", "적금(주택청약)", "적금(연금저축)", "적금(ISA계좌)", "비상금", "기타지출"],
  "asset": ["현금", "예적금", "주택청약", "주식", "ISA계좌", "연금저축", "퇴직금", "전세자금", "비상금", "기타"]
}'::jsonb
where categories is null;
