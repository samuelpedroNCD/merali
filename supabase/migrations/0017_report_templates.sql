-- Saved custom-report definitions for the report builder.
create table if not exists report_template (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  source text not null,
  fields jsonb not null default '[]'::jsonb,
  filters jsonb not null default '{}'::jsonb,
  created_by uuid references staff_user(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table report_template enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'report_template' and policyname = 'merali_auth_report_template') then
    create policy merali_auth_report_template on report_template for all to authenticated using (true) with check (true);
  end if;
end $$;
