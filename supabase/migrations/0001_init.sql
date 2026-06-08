-- =====================================================================
-- Merali Lettings — initial schema (Phase 0–5 data model)
-- Single-tenant, staff-only. All money in GBP. Timestamps are timestamptz.
-- User-editable "option sets" are stored as text + an `option_set` table
-- (no hard enum types, so staff can add values without a migration).
-- =====================================================================

create extension if not exists pgcrypto;

-- updated_at trigger helper
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- =====================================================================
-- RBAC: roles, permissions, staff users
-- =====================================================================
create table role (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  description text,
  is_system   boolean not null default false,   -- Admin/Manager seeds
  protected_delete boolean not null default false, -- reserved
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table permission (
  id     uuid primary key default gen_random_uuid(),
  module text not null,   -- properties, tenants, finance, ...
  action text not null,   -- view | create | edit | delete
  unique (module, action)
);

create table role_permission (
  role_id       uuid not null references role(id) on delete cascade,
  permission_id uuid not null references permission(id) on delete cascade,
  primary key (role_id, permission_id)
);

-- Staff profile, linked 1:1 to a Supabase auth user.
create table staff_user (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid unique,            -- references auth.users(id)
  first_name  text,
  last_name   text,
  full_name   text generated always as (
                trim(coalesce(first_name,'') || ' ' || coalesce(last_name,''))
              ) stored,
  email       text not null unique,
  phone       text,
  profile_picture text,
  role_id     uuid references role(id) on delete set null,
  bio         text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger trg_staff_updated before update on staff_user
  for each row execute function set_updated_at();

-- =====================================================================
-- Option sets (user-editable enums)
-- =====================================================================
create table option_set (
  id        uuid primary key default gen_random_uuid(),
  category  text not null,         -- e.g. property_class, lease_status...
  value     text not null,
  label     text not null,
  sort      int not null default 0,
  is_default boolean not null default false,
  active    boolean not null default true,
  created_at timestamptz not null default now(),
  unique (category, value)
);

-- =====================================================================
-- Landlords
-- =====================================================================
create table landlord (
  id            uuid primary key default gen_random_uuid(),
  landlord_type text,              -- Individual | Limited Company | Trust
  first_name    text,
  last_name     text,
  full_name     text,
  email         text,
  phone         text,
  preferred_contact text,
  -- company / trust
  company_registration_date date,
  vat_number    text,
  main_contact_name  text,
  main_contact_email text,
  main_contact_phone text,
  director_name  text,
  director_email text,
  director_phone text,
  trustee_name   text,
  trustee_email  text,
  trustee_phone  text,
  bio           text,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger trg_landlord_updated before update on landlord
  for each row execute function set_updated_at();

-- =====================================================================
-- Properties (self-referencing: a building contains units; a unit can be
-- a property row with parent_property_id; a property with configuration
-- 'unit' cannot own units — enforced in app + a trigger below)
-- =====================================================================
create table property (
  id            uuid primary key default gen_random_uuid(),
  -- identification
  address       text,
  flat          text,             -- sub-building / flat line (Google gap)
  town          text,
  post_code     text,
  country       text default 'United Kingdom',
  area          text,
  internal_code text,
  configuration text,             -- Building | Standalone Property | Unit
  class         text,
  property_type text,
  status        text,             -- Occupied | Vacant | ...
  tenancy_class text,
  property_tax  text,
  bedrooms      int,
  -- relations
  parent_property_id uuid references property(id) on delete set null,
  landlord_id   uuid references landlord(id) on delete set null,
  assigned_manager_id uuid references staff_user(id) on delete set null,
  -- acquisition & registration
  date_acquired date,
  leasehold_register_number text,
  -- targets
  target_rent   numeric(12,2),
  target_rent_month text,
  rent_collected boolean default false,
  -- google places
  google_place_id text,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on property (parent_property_id);
create index on property (landlord_id);
create trigger trg_property_updated before update on property
  for each row execute function set_updated_at();

-- A property that is itself a Unit cannot be a parent of other properties.
create or replace function check_unit_no_children()
returns trigger language plpgsql as $$
begin
  if new.parent_property_id is not null then
    if (select configuration from property where id = new.parent_property_id) = 'Unit' then
      raise exception 'A property of configuration "Unit" cannot contain units';
    end if;
  end if;
  return new;
end $$;
create trigger trg_unit_no_children before insert or update on property
  for each row execute function check_unit_no_children();

-- Utilities attached to a property
create table utility (
  id            uuid primary key default gen_random_uuid(),
  property_id   uuid not null references property(id) on delete cascade,
  utility_type  text not null,     -- Gas | Electricity | Water | Broadband
  supplier      text,
  meter_location text,
  serial_number text,
  notes         text,
  created_at    timestamptz not null default now()
);
create index on utility (property_id);

-- =====================================================================
-- Tenants
-- =====================================================================
create table tenant (
  id            uuid primary key default gen_random_uuid(),
  first_name    text,
  last_name     text,
  full_name     text,
  email         text,
  phone         text,
  forwarding_address text,
  position      text,
  tenant_code   text,
  preferred_contact text,
  tenant_type   text,
  status        text,
  acquired_date date,
  -- next of kin
  nok_name         text,
  nok_phone        text,
  nok_email        text,
  nok_address      text,
  nok_relationship text,
  -- guarantor
  guarantor_name  text,
  guarantor_email text,
  guarantor_phone text,
  bio           text,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger trg_tenant_updated before update on tenant
  for each row execute function set_updated_at();

-- =====================================================================
-- Leases + auto-generated rent schedule
-- =====================================================================
create table lease (
  id            uuid primary key default gen_random_uuid(),
  property_id   uuid references property(id) on delete set null,
  unit_id       uuid references property(id) on delete set null,
  tenant_id     uuid references tenant(id) on delete set null,
  tenancy_code  text,             -- AST etc.
  start_date    date,
  end_date      date,
  move_in_date  date,
  renewal_date  date,
  rent_amount   numeric(12,2),
  payment_frequency text,         -- Weekly | Monthly | ...
  status        text,             -- Active | Pending | Ended | ...
  agreement_file text,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on lease (property_id);
create index on lease (tenant_id);
create trigger trg_lease_updated before update on lease
  for each row execute function set_updated_at();

create table rent_schedule (
  id            uuid primary key default gen_random_uuid(),
  lease_id      uuid not null references lease(id) on delete cascade,
  property_id   uuid references property(id) on delete set null,
  tenant_id     uuid references tenant(id) on delete set null,
  due_date      date not null,
  amount_due    numeric(12,2) not null default 0,
  amount_collected numeric(12,2) not null default 0,
  amount_difference numeric(12,2) generated always as (amount_due - amount_collected) stored,
  invoice_status text not null default 'Pending', -- Pending|Paid|Overdue|Partial
  reconciled    boolean not null default false,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on rent_schedule (lease_id);
create index on rent_schedule (due_date);
create trigger trg_rentsched_updated before update on rent_schedule
  for each row execute function set_updated_at();
