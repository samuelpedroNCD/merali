-- =====================================================================
-- Keys: delivery/return audit log + richer spare tracking.
-- key_log already exists (issue/return events); link spare events to the
-- specific spare, and give each spare its own current state.
-- =====================================================================

alter table key_log
  add column if not exists spare_id uuid references key_spare(id) on delete cascade;

alter table key_spare
  add column if not exists status text,
  add column if not exists held_by_type text,
  add column if not exists holder_name text,
  add column if not exists date_given date,
  add column if not exists date_returned date;

create index if not exists key_log_key_id_idx on key_log (key_id, created_at desc);
create index if not exists key_log_spare_id_idx on key_log (spare_id);
