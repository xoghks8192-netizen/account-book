create table if not exists transactions (
  id bigint generated always as identity primary key,
  date date not null,
  type text not null check (type in ('income', 'expense')),
  category text not null,
  amount numeric not null check (amount > 0),
  memo text,
  author text,
  created_at timestamptz not null default now()
);

create index if not exists transactions_date_idx on transactions (date);

alter table transactions enable row level security;

create policy "Allow all" on transactions
  for all
  using (true)
  with check (true);
