-- app_users 테이블을 anon 키로 직접 읽고 쓸 수 없도록 차단
-- (로그인/비밀번호 변경은 서버사이드 API(api/login.js, api/change-pw.js)에서
--  SUPABASE_SERVICE_ROLE_KEY로만 접근)
drop policy if exists "Allow all" on app_users;

-- 로그인 시도 기록 (rate limit용)
create table if not exists login_attempts (
  id bigint generated always as identity primary key,
  identifier text not null,
  created_at timestamptz not null default now()
);

create index if not exists login_attempts_identifier_idx on login_attempts (identifier, created_at);

alter table login_attempts enable row level security;
-- login_attempts도 서버(service role)만 접근
