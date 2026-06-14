create extension if not exists pgcrypto;

create table if not exists households (
  id uuid primary key default gen_random_uuid(),
  dating_start date,
  wedding_date date,
  created_at timestamptz not null default now()
);
alter table households enable row level security;
create policy "Allow all" on households for all using (true) with check (true);

alter table app_users add column if not exists household_id uuid references households(id);
alter table app_users add column if not exists display_name text;

alter table transactions add column if not exists household_id uuid references households(id);
alter table assets add column if not exists household_id uuid references households(id);
alter table recurring_templates add column if not exists household_id uuid references households(id);

create index if not exists transactions_household_idx on transactions (household_id);
create index if not exists assets_household_idx on assets (household_id);
create index if not exists recurring_templates_household_idx on recurring_templates (household_id);

-- 기존(박태환/류진주) 데이터 백필
do $$
declare
  hh_id uuid;
begin
  insert into households (dating_start, wedding_date) values ('2024-08-07', '2025-11-09')
  returning id into hh_id;

  update app_users set household_id = hh_id, display_name = username
    where username in ('박태환', '류진주');

  update transactions set household_id = hh_id where household_id is null;
  update assets set household_id = hh_id where household_id is null;
  update recurring_templates set household_id = hh_id where household_id is null;
end $$;
