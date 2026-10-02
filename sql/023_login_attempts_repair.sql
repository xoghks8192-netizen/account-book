-- Add the previously missing rate-limit table without changing existing data.
begin;
create table if not exists public.login_attempts (
  id bigint generated always as identity primary key,
  identifier text not null,
  created_at timestamptz not null default now()
);
create index if not exists login_attempts_identifier_idx
  on public.login_attempts(identifier, created_at);
alter table public.login_attempts enable row level security;
revoke all on table public.login_attempts from public, anon, authenticated;
grant select, insert, update, delete on table public.login_attempts to service_role;
revoke all on sequence public.login_attempts_id_seq from public, anon, authenticated;
grant usage, select on sequence public.login_attempts_id_seq to service_role;
commit;
notify pgrst, 'reload schema';
select '로그인 보안 테이블 준비 완료' as result;
