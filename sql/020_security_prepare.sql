-- Step 1: additive preparation only. Existing application access is unchanged.
-- Run BEFORE deploying the authenticated server data gateway.
begin;

alter table public.transactions
  add column if not exists transfer_id uuid,
  add column if not exists request_id uuid;

-- Old transfers intentionally remain unlinked: never guess their counterparts.
create unique index if not exists transactions_transfer_side_unique
  on public.transactions (household_id, transfer_id, type)
  where transfer_id is not null;

create unique index if not exists transactions_request_side_unique
  on public.transactions (household_id, request_id, type)
  where request_id is not null;

-- Only hashes of random session/invitation tokens are stored in the database.
create table if not exists public.app_sessions (
  token_hash text primary key,
  username text not null references public.app_users(username) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists app_sessions_username_idx
  on public.app_sessions(username);
create index if not exists app_sessions_expiry_idx
  on public.app_sessions(expires_at);

create table if not exists public.household_invites (
  token_hash text primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  created_by text not null references public.app_users(username) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);
create index if not exists household_invites_household_idx
  on public.household_invites(household_id);

alter table public.app_sessions enable row level security;
alter table public.household_invites enable row level security;

-- These NEW tables must never be exposed to browser/anonymous clients.
revoke all on table public.app_sessions from public, anon, authenticated;
revoke all on table public.household_invites from public, anon, authenticated;
grant select, insert, update, delete on table public.app_sessions to service_role;
grant select, insert, update, delete on table public.household_invites to service_role;

commit;

select '준비 완료: 기존 거래와 자산 데이터는 유지됩니다.' as result;
