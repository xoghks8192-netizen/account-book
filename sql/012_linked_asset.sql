alter table transactions add column if not exists linked_asset_id bigint references assets(id) on delete set null;
alter table recurring_templates add column if not exists linked_asset_id bigint references assets(id) on delete set null;
