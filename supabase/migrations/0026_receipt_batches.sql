-- =====================================================================
-- WS2 — Receipt batches.
-- A working session for one bank account: receipts booked in it carry batch_id;
-- the batch shows a running total and (against an optional expected_total, the
-- bank statement figure) a left-to-apply. Posting finalises the session.
-- =====================================================================

create table if not exists receipt_batch (
  id              uuid primary key default gen_random_uuid(),
  bank_account_id uuid references bank_account(id) on delete set null,
  entity_id       uuid references entity(id) on delete set null,
  status          text not null default 'draft',   -- draft | posted
  expected_total  numeric(14,2),
  note            text,
  posted_at       timestamptz,
  posted_by       uuid references staff_user(id) on delete set null,
  created_by      uuid references staff_user(id) on delete set null,
  created_at      timestamptz not null default now()
);
create index if not exists idx_receipt_batch_bank on receipt_batch (bank_account_id, status);

alter table transaction add column if not exists batch_id uuid references receipt_batch(id) on delete set null;
create index if not exists idx_transaction_batch on transaction (batch_id);

alter table receipt_batch enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename='receipt_batch' and policyname='authenticated_all') then
    create policy authenticated_all on receipt_batch for all to authenticated using (true) with check (true);
  end if;
end $$;
