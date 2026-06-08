-- Multiple tenants per tenancy: join table. lease.tenant_id stays as the lead
-- tenant (used to denormalise rent_schedule); the join holds all tenants.
create table if not exists lease_tenant (
  lease_id  uuid not null references lease(id) on delete cascade,
  tenant_id uuid not null references tenant(id) on delete cascade,
  is_lead   boolean not null default false,
  primary key (lease_id, tenant_id)
);
create index if not exists lease_tenant_tenant_idx on lease_tenant (tenant_id);

-- Backfill existing single-tenant leases as the lead tenant.
insert into lease_tenant (lease_id, tenant_id, is_lead)
select id, tenant_id, true from lease where tenant_id is not null
on conflict do nothing;

alter table lease_tenant enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'lease_tenant' and policyname = 'merali_auth_lease_tenant') then
    create policy merali_auth_lease_tenant on lease_tenant for all to authenticated using (true) with check (true);
  end if;
end $$;
