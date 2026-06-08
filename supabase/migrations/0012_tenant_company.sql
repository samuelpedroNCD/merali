-- Tenants: company tenants + the missing guarantor_phone column.
alter table tenant
  add column if not exists is_company boolean not null default false,
  add column if not exists company_name text,
  add column if not exists guarantor_phone text;
