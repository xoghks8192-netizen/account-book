-- Account-specific asset ordering. Only the authenticated server may access this table.
begin;
create table if not exists public.app_asset_order (
  username text not null references public.app_users(username) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  asset_ids jsonb not null default '[]'::jsonb check (jsonb_typeof(asset_ids) = 'array'),
  updated_at timestamptz not null default now(),
  primary key (username, household_id)
);
alter table public.app_asset_order enable row level security;
revoke all on public.app_asset_order from anon, authenticated;
grant select, insert, update, delete on public.app_asset_order to service_role;
commit;
