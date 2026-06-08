-- Landlords: single entity name for company/trust, + bank details for invoicing.
alter table landlord
  add column if not exists entity_name text,
  add column if not exists bank_account_name text,
  add column if not exists bank_sort_code text,
  add column if not exists bank_account_number text,
  add column if not exists bank_name text,
  add column if not exists bank_reference text;
