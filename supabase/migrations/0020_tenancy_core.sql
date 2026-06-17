-- =====================================================================
-- Client feedback round 2 — tenancy core (phase 3).
--  - lease.term_type            Fixed | Variable
--  - lease.commencement_date    tenancy commencement (distinct from rent)
--  - lease.rent_commencement_date  when rent starts being charged
--  - lease.tenancy_type         the AST/Assured "type" (was stored in tenancy_code)
--  - lease.deposit_received     boolean toggle
--  tenancy_code is repurposed as the team's free-text internal code.
--  Adds the "Landlord held" deposit scheme option.
-- =====================================================================

alter table lease add column if not exists term_type text;              -- Fixed | Variable
alter table lease add column if not exists commencement_date date;
alter table lease add column if not exists rent_commencement_date date;
alter table lease add column if not exists tenancy_type text;
alter table lease add column if not exists deposit_received boolean not null default false;

-- New deposit scheme option.
insert into option_set (category, value, label, sort, is_default, active)
values ('deposit_scheme', 'Landlord held', 'Landlord held', 50, false, true)
on conflict (category, value) do nothing;

-- Backfills (only seed where empty so re-runs are safe).
-- The AST/Assured value currently lives in tenancy_code → move it to tenancy_type,
-- then clear tenancy_code so it becomes the free-text internal code.
update lease set tenancy_type = tenancy_code
  where coalesce(tenancy_type, '') = '' and coalesce(tenancy_code, '') <> '';
update lease set tenancy_code = null
  where coalesce(tenancy_type, '') <> '' and tenancy_code = tenancy_type;

-- Term type: leases with an end date are Fixed, otherwise Variable.
update lease set term_type = case when end_date is not null then 'Fixed' else 'Variable' end
  where coalesce(term_type, '') = '';

-- Commencement defaults to the start date; rent commencement to move-in or start.
update lease set commencement_date = start_date where commencement_date is null;
update lease set rent_commencement_date = coalesce(move_in_date, start_date) where rent_commencement_date is null;

-- Existing leases with a deposit amount are treated as received.
update lease set deposit_received = true where coalesce(deposit_amount, 0) > 0;
