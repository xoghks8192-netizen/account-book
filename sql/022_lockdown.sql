-- FINAL STEP: Run only AFTER deploying the authenticated gateway and
-- confirming that login and ledger/asset viewing work in the new app.
-- Existing data is not deleted. Browser requests must now use the server.
begin;

do $$
declare
  t text;
  sequence_name text;
begin
  if to_regprocedure('public.hb_mutate_transaction(text,text,bigint,jsonb,uuid)') is null then
    raise exception '먼저 021 SQL을 실행해주세요.';
  end if;
  if not exists (select 1 from public.app_sessions
    where expires_at > now() and password_version is not null) then
    raise exception '새 버전 배포 후 앱에 로그인하고 다시 실행해주세요.';
  end if;
  foreach t in array array[
    'app_users','households','transactions','assets','recurring_templates',
    'net_worth_snapshots','login_attempts','app_sessions','household_invites',
    'app_mutation_requests'
  ] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('drop policy if exists "Allow all" on public.%I',t);
    execute format('revoke all on table public.%I from public, anon, authenticated',t);
    execute format('grant select, insert, update, delete on table public.%I to service_role',t);
    -- Preserve only the backend's access to each table's identity sequence.
    select pg_get_serial_sequence(format('public.%I',t),'id') into sequence_name
      where exists (select 1 from information_schema.columns
        where table_schema='public' and table_name=t and column_name='id');
    if sequence_name is not null then
      execute format('revoke all on sequence %s from public, anon, authenticated',sequence_name);
      execute format('grant usage, select on sequence %s to service_role',sequence_name);
    end if;
  end loop;
end;
$$;
commit;
notify pgrst, 'reload schema';
select '공개 접근 차단 완료' as result;
