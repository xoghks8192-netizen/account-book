create table if not exists app_users (
  username text primary key,
  password text not null
);

alter table app_users enable row level security;

create policy "Allow all" on app_users
  for all
  using (true)
  with check (true);

insert into app_users (username, password) values
  ('박태환', '251109'),
  ('류진주', '251109')
on conflict (username) do nothing;
