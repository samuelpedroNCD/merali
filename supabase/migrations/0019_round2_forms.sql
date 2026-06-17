-- =====================================================================
-- Client feedback round 2 — form restructures (phase 2b).
--  - property_title: repeatable Title/Tenure documents per property.
--  - landlord_person: multiple people (Director/Trustee/Contact) per landlord.
--  - landlord.internal_code, landlord.company_status (Active/Dormant).
--  - tenant.company_address (free address for company tenants).
--  - lease.tenancy_class (moved off the property onto the tenancy).
-- Backfills existing single-value data into the new shapes.
-- =====================================================================

-- ---- new columns -----------------------------------------------------
alter table landlord add column if not exists internal_code text;
alter table landlord add column if not exists company_status text;   -- Active | Dormant
alter table tenant   add column if not exists company_address text;
alter table lease    add column if not exists tenancy_class text;

-- ---- property_title --------------------------------------------------
create table if not exists property_title (
  id            uuid primary key default gen_random_uuid(),
  property_id   uuid not null references property(id) on delete cascade,
  doc_date      date,
  tenure        text,            -- Freehold | Leasehold
  title_number  text,
  created_at    timestamptz not null default now()
);
create index if not exists idx_property_title_property on property_title (property_id);
alter table property_title enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'property_title' and policyname = 'merali_auth_property_title') then
    create policy merali_auth_property_title on property_title for all to authenticated using (true) with check (true);
  end if;
end $$;

-- ---- landlord_person -------------------------------------------------
create table if not exists landlord_person (
  id            uuid primary key default gen_random_uuid(),
  landlord_id   uuid not null references landlord(id) on delete cascade,
  role          text,            -- Director | Trustee | Contact
  name          text,
  email         text,
  phone         text,
  created_at    timestamptz not null default now()
);
create index if not exists idx_landlord_person_landlord on landlord_person (landlord_id);
alter table landlord_person enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'landlord_person' and policyname = 'merali_auth_landlord_person') then
    create policy merali_auth_landlord_person on landlord_person for all to authenticated using (true) with check (true);
  end if;
end $$;

-- ---- backfills (idempotent-ish; only seed when target is empty) -------
-- Existing single director/trustee names → landlord_person rows.
insert into landlord_person (landlord_id, role, name)
select id, 'Director', director_name from landlord
where coalesce(director_name, '') <> ''
  and not exists (select 1 from landlord_person lp where lp.landlord_id = landlord.id);
insert into landlord_person (landlord_id, role, name)
select id, 'Trustee', trustee_name from landlord
where coalesce(trustee_name, '') <> ''
  and not exists (select 1 from landlord_person lp where lp.landlord_id = landlord.id and lp.role = 'Trustee');

-- Existing leasehold_register_number → a Leasehold title document.
insert into property_title (property_id, tenure, title_number)
select id, 'Leasehold', leasehold_register_number from property
where coalesce(leasehold_register_number, '') <> ''
  and not exists (select 1 from property_title pt where pt.property_id = property.id);

-- Carry each lease's tenancy class down from its property.
update lease l set tenancy_class = p.tenancy_class
from property p
where l.property_id = p.id
  and coalesce(l.tenancy_class, '') = ''
  and coalesce(p.tenancy_class, '') <> '';
