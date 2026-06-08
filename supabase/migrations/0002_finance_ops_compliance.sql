-- =====================================================================
-- Merali Lettings — finance, operations, compliance, comms
-- =====================================================================

-- ---------------------------------------------------------------------
-- Bank / Plaid
-- ---------------------------------------------------------------------
create table bank_account (
  id            uuid primary key default gen_random_uuid(),
  plaid_item_id text,
  access_token  text,             -- server-only; encrypt at rest in prod
  institution   text,
  account_name  text,
  account_mask  text,
  account_type  text,
  account_subtype text,
  plaid_account_id text,
  last_synced_date timestamptz,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Transaction ledger (single source of truth; GBP)
-- ---------------------------------------------------------------------
create table transaction (
  id            uuid primary key default gen_random_uuid(),
  type          text not null,    -- Income | Expense
  category      text,
  amount_net    numeric(12,2) not null default 0,
  vat_rate      numeric(5,2) not null default 0,   -- 0 | 5 | 20
  vat_amount    numeric(12,2) not null default 0,
  amount_gross  numeric(12,2) not null default 0,
  txn_date      date not null,
  -- links
  property_id   uuid references property(id) on delete set null,
  unit_id       uuid references property(id) on delete set null,
  lease_id      uuid references lease(id) on delete set null,
  tenant_id     uuid references tenant(id) on delete set null,
  landlord_id   uuid references landlord(id) on delete set null,
  supplier_id   uuid,
  linked_invoice_id uuid references rent_schedule(id) on delete set null,
  -- flags
  manual_entry  boolean not null default true,
  needs_review  boolean not null default false,
  reconciled_with uuid references rent_schedule(id) on delete set null,
  receipt_link  text,
  notes         text,
  -- plaid
  bank_account_id uuid references bank_account(id) on delete set null,
  plaid_transaction_id text,
  plaid_pending boolean,
  plaid_synced  boolean not null default false,
  plaid_institution text,
  plaid_sync_timestamp timestamptz,
  status        text,             -- Paid | Pending | ...
  reference     text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on transaction (txn_date);
create index on transaction (property_id);
create index on transaction (needs_review);
create trigger trg_txn_updated before update on transaction
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- Suppliers
-- ---------------------------------------------------------------------
create table supplier (
  id            uuid primary key default gen_random_uuid(),
  business_name text not null,
  primary_contact_name  text,
  primary_contact_email text,
  type          text,
  status        text,
  outstanding   numeric(12,2) default 0,
  preferred     boolean default false,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger trg_supplier_updated before update on supplier
  for each row execute function set_updated_at();

alter table transaction
  add constraint transaction_supplier_fk
  foreign key (supplier_id) references supplier(id) on delete set null;

-- ---------------------------------------------------------------------
-- Maintenance + comments
-- ---------------------------------------------------------------------
create table maintenance (
  id            uuid primary key default gen_random_uuid(),
  description   text,
  status        text not null default 'Needs Booking',
  urgency       text,
  type          text,
  property_id   uuid references property(id) on delete set null,
  unit_id       uuid references property(id) on delete set null,
  planned_date  date,
  completion_date date,
  assigned_staff_id uuid references staff_user(id) on delete set null,
  supplier_id   uuid references supplier(id) on delete set null,
  cost          numeric(12,2),
  response_time text,
  resolution_time text,
  submitted_by  uuid references staff_user(id) on delete set null,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on maintenance (status);
create index on maintenance (property_id);
create trigger trg_maint_updated before update on maintenance
  for each row execute function set_updated_at();

create table maintenance_comment (
  id            uuid primary key default gen_random_uuid(),
  maintenance_id uuid not null references maintenance(id) on delete cascade,
  author_id     uuid references staff_user(id) on delete set null,
  message       text,
  photos        text[],
  created_at    timestamptz not null default now()
);
create index on maintenance_comment (maintenance_id);

-- ---------------------------------------------------------------------
-- Keys + spares + logs
-- ---------------------------------------------------------------------
create table key (
  id            uuid primary key default gen_random_uuid(),
  key_code      text,
  property_id   uuid references property(id) on delete set null,
  holder_id     uuid,             -- tenant/staff depending on held_by_type
  held_by_type  text,             -- Tenant | Landlord | Staff | ...
  status        text,             -- Out | In Office | Lost | Returned
  date_given    date,
  date_returned date,
  reference_id  text,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on key (property_id);
create trigger trg_key_updated before update on key
  for each row execute function set_updated_at();

create table key_spare (
  id            uuid primary key default gen_random_uuid(),
  key_id        uuid not null references key(id) on delete cascade,
  holder        text,
  reference     text,
  created_at    timestamptz not null default now()
);

create table key_log (
  id            uuid primary key default gen_random_uuid(),
  key_id        uuid references key(id) on delete cascade,
  property_id   uuid references property(id) on delete set null,
  action_out_when timestamptz,
  action_in_when  timestamptz,
  holder        text,
  held_by_type_snapshot text,
  is_spare_snapshot boolean,
  issued_by     uuid references staff_user(id) on delete set null,
  received_by   uuid references staff_user(id) on delete set null,
  status_after_return text,
  is_open       boolean,
  notes         text,
  created_at    timestamptz not null default now()
);
create index on key_log (key_id);

-- ---------------------------------------------------------------------
-- Compliance: certification types + certifications
-- ---------------------------------------------------------------------
create table certification_type (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,
  default_expiry_period_months int,
  reminder_lead_days int not null default 7,
  created_at    timestamptz not null default now()
);

create table certification (
  id            uuid primary key default gen_random_uuid(),
  property_id   uuid references property(id) on delete cascade,
  unit_id       uuid references property(id) on delete set null,
  type_id       uuid references certification_type(id) on delete set null,
  expiry_date   date,
  is_expired    boolean not null default false,
  document_link text,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on certification (property_id);
create index on certification (expiry_date);
create trigger trg_cert_updated before update on certification
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- Documents (external links only)
-- ---------------------------------------------------------------------
create table document (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  external_link text not null,
  linked_to     text,             -- Property | Tenant | Landlord | ...
  property_id   uuid references property(id) on delete cascade,
  tenant_id     uuid references tenant(id) on delete cascade,
  landlord_id   uuid references landlord(id) on delete cascade,
  lease_id      uuid references lease(id) on delete cascade,
  maintenance_id uuid references maintenance(id) on delete cascade,
  certification_id uuid references certification(id) on delete cascade,
  supplier_id   uuid references supplier(id) on delete cascade,
  staff_id      uuid references staff_user(id) on delete cascade,
  expiry_date   date,
  tag           text,
  uploaded_by   uuid references staff_user(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index on document (linked_to);

-- ---------------------------------------------------------------------
-- Reminders + notifications + activity log
-- ---------------------------------------------------------------------
create table reminder (
  id            uuid primary key default gen_random_uuid(),
  content       text,
  alert_date    date,
  alert_time    time,
  status        text not null default 'Pending',  -- Pending|Sent|Completed
  sent          boolean not null default false,
  created_by    uuid references staff_user(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger trg_reminder_updated before update on reminder
  for each row execute function set_updated_at();

create table reminder_assignee (
  reminder_id   uuid not null references reminder(id) on delete cascade,
  staff_id      uuid not null references staff_user(id) on delete cascade,
  primary key (reminder_id, staff_id)
);

create table notification (
  id            uuid primary key default gen_random_uuid(),
  to_staff_id   uuid references staff_user(id) on delete cascade,
  type          text,
  delivery_channel text,          -- Email | In-App
  trigger_source text,
  lease_id      uuid references lease(id) on delete set null,
  maintenance_id uuid references maintenance(id) on delete set null,
  certification_id uuid references certification(id) on delete set null,
  message       text,
  was_sent      boolean not null default false,
  read_at       timestamptz,
  date_sent     timestamptz,
  created_at    timestamptz not null default now()
);
create index on notification (to_staff_id);

create table activity_log (
  id            uuid primary key default gen_random_uuid(),
  type          text not null,    -- Property Update | Tenant Creation | ...
  object_label  text,
  object_table  text,
  object_id     uuid,
  creator_id    uuid references staff_user(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index on activity_log (created_at desc);
