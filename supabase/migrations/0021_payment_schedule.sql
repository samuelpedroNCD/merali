-- =====================================================================
-- Client feedback round 2 — payment schedule engine (phase 4).
-- Adds the scheduling controls that drive when rent is due.
--  - lease.payment_timing    Advance | Arrears  (start vs end of each period)
--  - lease.quarter_type      English | Calendar (only for Quarterly)
--  - lease.due_weekday       0=Sun .. 6=Sat      (Weekly / Fortnightly)
--  - lease.due_dom           1..31 day-of-month  (Monthly / Quarterly / Annually)
--  - lease.custom_due_dates  jsonb array of 'YYYY-MM-DD' (Custom frequency)
-- =====================================================================

alter table lease add column if not exists payment_timing text;          -- Advance | Arrears
alter table lease add column if not exists quarter_type text;            -- English | Calendar
alter table lease add column if not exists due_weekday int;              -- 0=Sun .. 6=Sat
alter table lease add column if not exists due_dom int;                  -- 1..31
alter table lease add column if not exists custom_due_dates jsonb not null default '[]'::jsonb;

-- "Custom" payment frequency option.
insert into option_set (category, value, label, sort, is_default, active)
values ('payment_frequency', 'Custom', 'Custom', 60, false, true)
on conflict (category, value) do nothing;

-- Backfills: default to paid in advance; derive the anchor day from the
-- rent-commencement (or start) date so existing schedules keep their shape.
update lease set payment_timing = 'Advance' where coalesce(payment_timing, '') = '';
update lease
  set due_dom = extract(day from coalesce(rent_commencement_date, start_date))::int
  where due_dom is null and coalesce(rent_commencement_date, start_date) is not null;
update lease
  set due_weekday = extract(dow from coalesce(rent_commencement_date, start_date))::int
  where due_weekday is null and coalesce(rent_commencement_date, start_date) is not null;
