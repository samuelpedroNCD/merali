-- =====================================================================
-- Client feedback round 2 — unify tenant contacts.
--  - tenant_contact: repeatable contacts per tenant, each with a type
--    (Emergency | Guarantor), replacing the single nok_* / guarantor_*
--    columns in the UI. The old columns are kept (dormant) for safety.
--  - Backfills existing next-of-kin and guarantor data into the new shape.
--    Values are copied verbatim — encrypted columns stay encrypted and are
--    decrypted by the app on read (enc:v1: prefix), so no key is needed here.
-- =====================================================================

create table if not exists tenant_contact (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenant(id) on delete cascade,
  type          text,            -- Emergency | Guarantor
  name          text,
  email         text,
  phone         text,
  relationship  text,
  address       text,
  created_at    timestamptz not null default now()
);
create index if not exists idx_tenant_contact_tenant on tenant_contact (tenant_id);
alter table tenant_contact enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'tenant_contact' and policyname = 'merali_auth_tenant_contact') then
    create policy merali_auth_tenant_contact on tenant_contact for all to authenticated using (true) with check (true);
  end if;
end $$;

-- ---- backfills (only seed when the tenant has no contacts yet) --------
-- Existing next-of-kin → an Emergency contact.
insert into tenant_contact (tenant_id, type, name, phone, email, relationship, address)
select id, 'Emergency', nok_name, nok_phone, nok_email, nok_relationship, nok_address
from tenant
where (coalesce(nok_name, '') <> '' or coalesce(nok_phone, '') <> ''
       or coalesce(nok_email, '') <> '' or coalesce(nok_address, '') <> '')
  and not exists (select 1 from tenant_contact tc where tc.tenant_id = tenant.id);

-- Existing guarantor → a Guarantor contact.
insert into tenant_contact (tenant_id, type, name, email, phone)
select id, 'Guarantor', guarantor_name, guarantor_email, guarantor_phone
from tenant
where (coalesce(guarantor_name, '') <> '' or coalesce(guarantor_email, '') <> ''
       or coalesce(guarantor_phone, '') <> '')
  and not exists (select 1 from tenant_contact tc where tc.tenant_id = tenant.id and tc.type = 'Guarantor');
