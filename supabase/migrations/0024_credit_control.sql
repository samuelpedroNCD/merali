-- =====================================================================
-- WS14 — Credit control.
--  - lease.chasing_enabled: per-tenancy off-switch (bailiffs / agreement in
--    place → reminders must stop). Default true.
--  - credit_control_chase: one row per chase sent, so the daily job can enforce
--    the 7-days-then-weekly cadence and keep an audit trail.
-- =====================================================================

alter table lease add column if not exists chasing_enabled boolean not null default true;

create table if not exists credit_control_chase (
  id            uuid primary key default gen_random_uuid(),
  lease_id      uuid not null references lease(id) on delete cascade,
  chased_at     timestamptz not null default now(),
  days_overdue  int,
  amount        numeric(12,2),
  channel       text,                 -- Email | In-App
  sent          boolean not null default false,   -- true only if an email actually went out
  created_at    timestamptz not null default now()
);
create index if not exists idx_cc_chase_lease on credit_control_chase (lease_id, chased_at desc);

alter table credit_control_chase enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename='credit_control_chase' and policyname='authenticated_all') then
    create policy authenticated_all on credit_control_chase for all to authenticated using (true) with check (true);
  end if;
end $$;
