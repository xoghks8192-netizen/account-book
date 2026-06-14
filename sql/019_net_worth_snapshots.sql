-- 월별 순자산 추이를 위한 일별 스냅샷 (자산 탭 조회 시마다 오늘 날짜로 upsert)
create table if not exists net_worth_snapshots (
  id bigint generated always as identity primary key,
  household_id uuid references households(id),
  snapshot_date date not null,
  total bigint not null,
  liquid_total bigint not null,
  non_liquid_total bigint not null,
  created_at timestamptz not null default now(),
  unique (household_id, snapshot_date)
);

alter table net_worth_snapshots enable row level security;
create policy "Allow all" on net_worth_snapshots for all using (true) with check (true);
