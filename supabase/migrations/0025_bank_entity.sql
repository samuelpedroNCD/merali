-- =====================================================================
-- WS1 — Bank accounts as real ledger accounts + entity.
--  - entity: the trading companies (multi-entity confirmed, B1). Reconciliation
--    is done per company; journals and the trial balance filter by entity.
--  - bank_account gains code (e.g. 37BA), short_ref (LB/BB), entity_id, active.
-- journal_entry.entity_id already exists (WS11); WS1 populates it from the bank.
-- =====================================================================

create table if not exists entity (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  companies_house_number text,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);
alter table entity enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename='entity' and policyname='authenticated_all') then
    create policy authenticated_all on entity for all to authenticated using (true) with check (true);
  end if;
end $$;

insert into entity (name) values
  ('Merali Lettings Ltd'),
  ('Aspengold Limited'),
  ('Merali Property')
on conflict do nothing;

alter table bank_account add column if not exists code text;          -- e.g. 37BA
alter table bank_account add column if not exists short_ref text;     -- e.g. LB, BB
alter table bank_account add column if not exists entity_id uuid references entity(id) on delete set null;
alter table bank_account add column if not exists active boolean not null default true;
