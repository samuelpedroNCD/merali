-- Tenancy finance: deposit tracking, rent reviews/increases, reminder exclusion.
alter table lease
  add column if not exists deposit_amount numeric(12,2),
  add column if not exists deposit_scheme text,
  add column if not exists deposit_reference text,
  add column if not exists deposit_protected_date date,
  add column if not exists deposit_returned_date date,
  add column if not exists exclude_from_reminders boolean not null default false;

create table if not exists rent_review (
  id uuid primary key default gen_random_uuid(),
  lease_id uuid not null references lease(id) on delete cascade,
  effective_date date not null,
  new_amount numeric(12,2) not null
);
create index if not exists rent_review_lease_idx on rent_review (lease_id);

alter table rent_review enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'rent_review' and policyname = 'merali_auth_rent_review') then
    create policy merali_auth_rent_review on rent_review for all to authenticated using (true) with check (true);
  end if;
end $$;

-- Seed deposit-scheme option set (only if the category is empty).
insert into option_set (category, value, label, sort, active)
select v.category, v.value, v.label, v.sort, v.active
from (values
  ('deposit_scheme','DPS','DPS (Deposit Protection Service)',10,true),
  ('deposit_scheme','TDS','TDS (Tenancy Deposit Scheme)',20,true),
  ('deposit_scheme','mydeposits','mydeposits',30,true),
  ('deposit_scheme','Zero','Zero deposit',40,true)
) as v(category,value,label,sort,active)
where not exists (select 1 from option_set o where o.category = 'deposit_scheme');
