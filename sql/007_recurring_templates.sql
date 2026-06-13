create table if not exists recurring_templates (
  id bigint generated always as identity primary key,
  name text not null,
  type text not null check (type in ('income', 'expense')),
  category text not null,
  amount numeric not null check (amount > 0),
  memo text,
  created_at timestamptz not null default now()
);

alter table recurring_templates enable row level security;

create policy "Allow all" on recurring_templates
  for all
  using (true)
  with check (true);
