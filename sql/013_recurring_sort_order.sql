alter table recurring_templates add column if not exists sort_order integer;
update recurring_templates set sort_order = id where sort_order is null;
