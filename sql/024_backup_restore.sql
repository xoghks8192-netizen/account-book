-- Additive: safe, server-only backup and restore. Existing data is never overwritten.
begin;
create or replace function public.hb_backup(
  p_actor text, p_mode text, p_data jsonb default null, p_request uuid default null
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  me public.app_users%rowtype;
  result jsonb;
  saved public.app_mutation_requests%rowtype;
  a public.assets%rowtype;
  t public.transactions%rowtype;
  r public.recurring_templates%rowtype;
  na integer:=0; nt integer:=0; nr integer:=0;
  sa integer:=0; st integer:=0; sr integer:=0;
begin
  select * into me from public.app_users where username=p_actor;
  if me.household_id is null then raise exception '로그인이 필요합니다.'; end if;
  if p_mode is null or p_mode not in ('export','preview','restore') then raise exception '지원하지 않는 요청입니다.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(me.household_id::text,0));
  if p_mode='export' then
    select jsonb_build_object(
      'assets',coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from public.assets x
        where x.household_id=me.household_id and (x.category<>'비상금' or x.owner in (me.display_name,'공동'))),'[]'::jsonb),
      'transactions',coalesce((select jsonb_agg(
        to_jsonb(x) || jsonb_build_object('linked_asset_id',case when exists(
          select 1 from public.assets y where y.id=x.linked_asset_id and y.household_id=me.household_id
            and (y.category<>'비상금' or y.owner in (me.display_name,'공동'))
        ) then x.linked_asset_id else null end) order by x.id)
        from public.transactions x where x.household_id=me.household_id),'[]'::jsonb),
      'recurring_templates',coalesce((select jsonb_agg(
        to_jsonb(x) || jsonb_build_object('linked_asset_id',case when exists(
          select 1 from public.assets y where y.id=x.linked_asset_id and y.household_id=me.household_id
            and (y.category<>'비상금' or y.owner in (me.display_name,'공동'))
        ) then x.linked_asset_id else null end) order by x.id)
        from public.recurring_templates x where x.household_id=me.household_id),'[]'::jsonb)
    ) into result;
    return result;
  end if;
  if p_request is null or jsonb_typeof(p_data)<>'object' then raise exception '백업 형식을 확인해주세요.'; end if;
  if p_mode='restore' then
    select * into saved from public.app_mutation_requests where household_id=me.household_id and request_id=p_request;
    if found then
      if saved.actor<>p_actor or saved.payload<>jsonb_build_object('backup',p_data) then raise exception '요청 번호가 중복되었습니다.'; end if;
      return saved.result;
    end if;
  end if;
  if exists (
    select 1 from jsonb_to_recordset(p_data->'transactions') as x(id bigint,transfer_id uuid)
    where x.transfer_id is not null group by x.transfer_id
    having count(*)<>2 or
      count(*) filter(where exists(select 1 from public.transactions y where y.id=x.id))=1
  ) then raise exception '이체 연결이 일부만 남아 있어 복원할 수 없습니다. 연결된 내역을 먼저 확인해주세요.'; end if;

  for a in select * from jsonb_populate_recordset(null::public.assets,p_data->'assets') loop
    if a.household_id is distinct from me.household_id or
       (a.category='비상금' and a.owner not in (me.display_name,'공동')) then raise exception '다른 가구 또는 개인 자산은 복원할 수 없습니다.'; end if;
    if exists(select 1 from public.assets x where x.id=a.id and x.household_id<>me.household_id) then raise exception '백업 항목 번호가 충돌합니다.'; end if;
    if exists(select 1 from public.assets x where x.id=a.id) then sa:=sa+1; continue; end if;
    na:=na+1;
    if p_mode='restore' then
      insert into public.assets(id,name,category,owner,amount,memo,household_id,created_at,updated_at,shares,avg_price,current_price,liquidity,ticker,deleted_at)
      overriding system value values(a.id,a.name,a.category,a.owner,a.amount,a.memo,me.household_id,a.created_at,now(),a.shares,a.avg_price,a.current_price,a.liquidity,a.ticker,a.deleted_at);
    end if;
  end loop;
  for t in select * from jsonb_populate_recordset(null::public.transactions,p_data->'transactions') loop
    if t.household_id is distinct from me.household_id then raise exception '다른 가구의 내역은 복원할 수 없습니다.'; end if;
    if exists(select 1 from public.transactions x where x.id=t.id and x.household_id<>me.household_id) then raise exception '백업 항목 번호가 충돌합니다.'; end if;
    if exists(select 1 from public.transactions x where x.id=t.id) then st:=st+1; continue; end if;
    if t.linked_asset_id is not null and not exists(
      select 1 from public.assets x where x.id=t.linked_asset_id and x.household_id=me.household_id
      and (x.category<>'비상금' or x.owner in(me.display_name,'공동'))
    ) and not exists(select 1 from jsonb_to_recordset(p_data->'assets') as x(id bigint) where x.id=t.linked_asset_id)
    then raise exception '연동 자산이 없어 복원할 수 없습니다.'; end if;
    nt:=nt+1;
    if p_mode='restore' then
      -- Restore records, not money movements: never double-apply asset contributions.
      insert into public.transactions(id,date,type,category,amount,memo,owner,author,household_id,linked_asset_id,transfer_id,request_id,created_at)
      overriding system value values(t.id,t.date,t.type,t.category,t.amount,t.memo,t.owner,t.author,me.household_id,t.linked_asset_id,t.transfer_id,null,t.created_at);
    end if;
  end loop;
  for r in select * from jsonb_populate_recordset(null::public.recurring_templates,p_data->'recurring_templates') loop
    if r.household_id is distinct from me.household_id then raise exception '다른 가구의 고정 항목은 복원할 수 없습니다.'; end if;
    if exists(select 1 from public.recurring_templates x where x.id=r.id and x.household_id<>me.household_id) then raise exception '백업 항목 번호가 충돌합니다.'; end if;
    if exists(select 1 from public.recurring_templates x where x.id=r.id) then sr:=sr+1; continue; end if;
    if r.linked_asset_id is not null and not exists(
      select 1 from public.assets x where x.id=r.linked_asset_id and x.household_id=me.household_id
      and (x.category<>'비상금' or x.owner in(me.display_name,'공동'))
    ) and not exists(select 1 from jsonb_to_recordset(p_data->'assets') as x(id bigint) where x.id=r.linked_asset_id)
    then raise exception '연동 자산이 없어 복원할 수 없습니다.'; end if;
    nr:=nr+1;
    if p_mode='restore' then
      insert into public.recurring_templates(id,name,type,category,amount,memo,author,household_id,linked_asset_id,sort_order,created_at)
      overriding system value values(r.id,r.name,r.type,r.category,r.amount,r.memo,r.author,me.household_id,r.linked_asset_id,r.sort_order,r.created_at);
    end if;
  end loop;
  result:=jsonb_build_object('added',jsonb_build_object('transactions',nt,'assets',na,'recurring_templates',nr),
    'skipped',jsonb_build_object('transactions',st,'assets',sa,'recurring_templates',sr));
  if p_mode='restore' then
    insert into public.app_mutation_requests(household_id,request_id,actor,payload,result)
    values(me.household_id,p_request,p_actor,jsonb_build_object('backup',p_data),result);
  end if;
  return result;
end;
$$;
revoke all on function public.hb_backup(text,text,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.hb_backup(text,text,jsonb,uuid) to service_role;
commit;
notify pgrst,'reload schema';
select '백업 복원 기능 준비 완료' as result;
