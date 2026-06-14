-- 회원가입 시 상대방과 자동 매칭하기 위한 컬럼
alter table app_users add column if not exists partner_name text;
