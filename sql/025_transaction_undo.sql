-- Add atomic deletion undo; preserves original IDs, both transfer rows and linked balances.
begin;
create or replace function public.hb_mutate_transaction(
  p_actor text, p_action text, p_id bigint, p_fields jsonb, p_request uuid
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  me public.app_users%rowtype;
  old_row public.transactions%rowtype;
  new_row public.transactions%rowtype;
  row_item public.transactions%rowtype;
  saved public.app_mutation_requests%rowtype;
  payload jsonb;
  result jsonb;
  changed_ids bigint[] := '{}';
  pair_id uuid;
  partner text;
  affected integer;
  deleted_rows jsonb;
  deletion public.app_mutation_requests%rowtype;
begin
  select * into me from public.app_users where username = p_actor;
  if me.household_id is null then raise exception '로그인이 필요합니다.'; end if;
  if p_request is null or p_action not in ('add', 'update', 'delete', 'undo') then
    raise exception '잘못된 요청입니다.';
  end if;
  p_fields := coalesce(p_fields, '{}'::jsonb);
  if jsonb_typeof(p_fields) <> 'object' then raise exception '입력 형식이 올바르지 않습니다.'; end if;
  if exists (select 1 from jsonb_object_keys(p_fields) k
    where k not in ('type','date','category','amount','memo','owner','linked_asset_id','delete_request')) then
    raise exception '허용되지 않는 항목입니다.';
  end if;

  -- Serializes retries, counterpart edits and linked-asset adjustments per household.
  perform pg_advisory_xact_lock(hashtextextended(me.household_id::text, 0));
  payload := jsonb_build_object('action',p_action,'id',p_id,'fields',p_fields);
  select * into saved from public.app_mutation_requests
    where household_id = me.household_id and request_id = p_request;
  if found then
    if saved.actor <> p_actor or saved.payload <> payload then raise exception '요청 번호가 중복되었습니다.'; end if;
    return saved.result;
  end if;


  if p_action = 'undo' then
    select * into deletion from public.app_mutation_requests
      where household_id=me.household_id and request_id=(p_fields->>'delete_request')::uuid;
    if not found or deletion.actor<>p_actor or deletion.payload->>'action'<>'delete'
      or deletion.created_at < now()-interval '10 minutes'
      or deletion.result->'deletedRows' is null then
      raise exception '실행 취소할 삭제 요청을 찾을 수 없습니다.';
    end if;
    if coalesce((deletion.result->>'undone')::boolean,false) then
      raise exception '이미 실행 취소한 삭제입니다.';
    end if;
    deleted_rows := deletion.result->'deletedRows';
    for row_item in select * from jsonb_populate_recordset(null::public.transactions,deleted_rows)
    loop
      if row_item.household_id<>me.household_id or exists(select 1 from public.transactions where id=row_item.id) then
        raise exception '기존 내역을 덮어쓸 수 없습니다.';
      end if;
      if row_item.owner<>'공동' and not exists(select 1 from public.app_users where household_id=me.household_id and display_name=row_item.owner) then
        raise exception '가구 구성원을 확인해주세요.';
      end if;
      if row_item.linked_asset_id is not null then
        update public.assets set amount=amount+row_item.amount,updated_at=now()
          where id=row_item.linked_asset_id and household_id=me.household_id and deleted_at is null
            and (category<>'비상금' or owner in (me.display_name,'공동'));
        get diagnostics affected = row_count;
        if affected<>1 then raise exception '연동 자산을 확인해주세요. 삭제 취소되지 않았습니다.'; end if;
      end if;
      insert into public.transactions overriding system value select row_item.*;
    end loop;
    result := jsonb_build_object('rows',deleted_rows,'removedIds','[]'::jsonb,'primary',deleted_rows->0);
    update public.app_mutation_requests set result=public.app_mutation_requests.result || '{"undone":true}'::jsonb
      where household_id=me.household_id and request_id=deletion.request_id;
    insert into public.app_mutation_requests(household_id,request_id,actor,payload,result)
      values(me.household_id,p_request,p_actor,payload,result);
    return result;
  end if;

  if p_action <> 'add' then
    select * into old_row from public.transactions
      where id = p_id and household_id = me.household_id for update;
    if not found then raise exception '내역을 찾을 수 없습니다.'; end if;
    pair_id := old_row.transfer_id;
    select array_agg(id) into changed_ids from public.transactions
      where household_id = me.household_id
        and (id = p_id or (pair_id is not null and transfer_id = pair_id));
    if pair_id is not null and cardinality(changed_ids) <> 2 then
      raise exception '이체 연결을 확인해주세요.';
    end if;
  end if;

  if p_action = 'delete' then
    select jsonb_agg(to_jsonb(t) order by id) into deleted_rows from public.transactions t
      where household_id=me.household_id and id=any(changed_ids);
    for row_item in select * from public.transactions
      where household_id = me.household_id and id = any(changed_ids)
    loop
      if row_item.linked_asset_id is not null then
        update public.assets set amount = amount - row_item.amount, updated_at = now()
          where id = row_item.linked_asset_id and household_id = me.household_id
            and (category <> '비상금' or owner in (me.display_name, '공동'));
        get diagnostics affected = row_count;
        if affected <> 1 then raise exception '연동 자산에 접근할 수 없습니다.'; end if;
      end if;
    end loop;
    delete from public.transactions where household_id = me.household_id and id = any(changed_ids);
    result := jsonb_build_object('rows','[]'::jsonb,'removedIds',to_jsonb(changed_ids),'primary',null,'deletedRows',deleted_rows,'deleteRequest',p_request);
  else
    if p_action = 'update' then
      new_row := jsonb_populate_record(old_row, p_fields);
    else
      new_row := jsonb_populate_record(null::public.transactions, p_fields);
    end if;
    if new_row.type is null or new_row.type not in ('income','expense')
      or new_row.date is null or new_row.category is null or length(btrim(new_row.category)) not between 1 and 100
      or new_row.amount is null or new_row.amount::text in ('NaN','Infinity','-Infinity')
      or new_row.amount <= 0 or new_row.amount > 9000000000000
      or coalesce(length(new_row.memo),0) > 2000 then
      raise exception '날짜, 분류, 금액을 확인해주세요.';
    end if;
    if new_row.owner is null or (new_row.owner <> '공동' and not exists (
      select 1 from public.app_users where household_id = me.household_id and display_name = new_row.owner
    )) then raise exception '가구 구성원을 선택해주세요.'; end if;
    if p_action = 'update' and pair_id is not null and
      (new_row.type <> old_row.type or new_row.category <> '배우자 이체' or new_row.owner <> old_row.owner) then
      raise exception '연결된 이체의 구분·소유자는 바꿀 수 없습니다. 이체를 삭제하고 다시 입력해주세요.';
    end if;
    if p_action = 'update' and pair_id is null and new_row.category <> old_row.category
      and (new_row.category = '배우자 이체' or old_row.category = '배우자 이체') then
      raise exception '이체 전환은 기존 내역을 삭제하고 새로 입력해주세요.';
    end if;

    if new_row.linked_asset_id is not null and not exists (
      select 1 from public.assets where id = new_row.linked_asset_id
        and household_id = me.household_id and deleted_at is null
        and (category <> '비상금' or owner in (me.display_name, '공동'))
    ) then raise exception '연동 자산에 접근할 수 없습니다.'; end if;

    if p_action = 'add' then
      if new_row.category = '배우자 이체' then
        if new_row.type <> 'expense' or new_row.owner = '공동' then
          raise exception '배우자 이체는 보내는 사람의 지출로 입력해주세요.';
        end if;
        select display_name into partner from public.app_users
          where household_id = me.household_id and display_name <> new_row.owner;
        if partner is null or (select count(*) from public.app_users where household_id = me.household_id) <> 2 then
          raise exception '배우자 연결 후 이체를 입력해주세요.';
        end if;
        pair_id := gen_random_uuid();
      end if;
      insert into public.transactions (date,type,category,amount,memo,owner,author,household_id,linked_asset_id,transfer_id,request_id)
        values (new_row.date,new_row.type,new_row.category,new_row.amount,
          coalesce(nullif(new_row.memo,''),case when pair_id is not null then partner || '님께 보낸 돈' end),
          new_row.owner,me.display_name,me.household_id,new_row.linked_asset_id,pair_id,p_request)
        returning * into new_row;
      changed_ids := array[new_row.id];
      if pair_id is not null then
        insert into public.transactions (date,type,category,amount,memo,owner,author,household_id,transfer_id,request_id)
          values (new_row.date,'income','배우자 이체',new_row.amount,
            coalesce(nullif(p_fields->>'memo',''),new_row.owner || '님이 보낸 돈'),
            partner,me.display_name,me.household_id,pair_id,p_request)
          returning id into p_id;
        changed_ids := array_append(changed_ids,p_id);
      end if;
    else
      -- Reverse old linked amounts first; failures roll back the entire operation.
      for row_item in select * from public.transactions
        where household_id = me.household_id and id = any(changed_ids)
      loop
        if row_item.linked_asset_id is not null then
          update public.assets set amount = amount - row_item.amount, updated_at = now()
            where id = row_item.linked_asset_id and household_id = me.household_id
              and (category <> '비상금' or owner in (me.display_name,'공동'));
          get diagnostics affected = row_count;
          if affected <> 1 then raise exception '연동 자산에 접근할 수 없습니다.'; end if;
        end if;
      end loop;
      update public.transactions set date = new_row.date, type = new_row.type,
        category = new_row.category, amount = new_row.amount, memo = new_row.memo,
        owner = new_row.owner, linked_asset_id = new_row.linked_asset_id
        where id = old_row.id and household_id = me.household_id returning * into new_row;
      if pair_id is not null then
        update public.transactions set date = new_row.date, amount = new_row.amount
          where transfer_id = pair_id and id <> new_row.id and household_id = me.household_id;
      end if;
    end if;

    for row_item in select * from public.transactions
      where household_id = me.household_id and id = any(changed_ids)
    loop
      if row_item.linked_asset_id is not null then
        update public.assets set amount = amount + row_item.amount, updated_at = now()
          where id = row_item.linked_asset_id and household_id = me.household_id
            and (category <> '비상금' or owner in (me.display_name,'공동'));
        get diagnostics affected = row_count;
        if affected <> 1 then raise exception '연동 자산에 접근할 수 없습니다.'; end if;
      end if;
    end loop;
    select jsonb_build_object('rows',jsonb_agg(to_jsonb(t) order by id),'removedIds','[]'::jsonb,'primary',to_jsonb(new_row))
      into result from public.transactions t where household_id = me.household_id and id = any(changed_ids);
  end if;
  insert into public.app_mutation_requests(household_id,request_id,actor,payload,result)
    values(me.household_id,p_request,p_actor,payload,result);
  return result;
end;
$$;
revoke all on function public.hb_mutate_transaction(text,text,bigint,jsonb,uuid) from public, anon, authenticated;
grant execute on function public.hb_mutate_transaction(text,text,bigint,jsonb,uuid) to service_role;


commit;
notify pgrst,'reload schema';
select '삭제 실행 취소 준비 완료' as result;

