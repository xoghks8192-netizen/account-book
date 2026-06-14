-- 자산 항목 소프트 삭제 (삭제된 자산 탭에서 복구 가능하도록)
alter table assets add column if not exists deleted_at timestamptz;
