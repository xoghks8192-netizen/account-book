create table if not exists assets (
  id bigint generated always as identity primary key,
  name text not null,
  category text not null,
  owner text not null,
  amount numeric not null default 0,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table assets enable row level security;

create policy "Allow all" on assets
  for all
  using (true)
  with check (true);
