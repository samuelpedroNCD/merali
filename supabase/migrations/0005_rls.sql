-- =====================================================================
-- Security hardening: enable RLS on every public table, revoke the anon
-- (logged-out) role, and grant the authenticated (staff) role full access.
-- The app enforces fine-grained per-module permissions server-side; this is
-- defense-in-depth so the publishable key alone (no session) can't read data.
-- Service-role operations (webhook, cron, staff invite) bypass RLS.
-- =====================================================================
do $$
declare t text;
begin
  for t in
    select tablename from pg_tables
    where schemaname = 'public' and tablename <> '_migrations'
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('drop policy if exists authenticated_all on public.%I', t);
    execute format(
      'create policy authenticated_all on public.%I for all to authenticated using (true) with check (true)',
      t
    );
  end loop;
end $$;
