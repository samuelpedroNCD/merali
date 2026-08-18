-- =====================================================================
-- WS11 — Double-entry ledger (foundational).
--  - Journals (journal_entry + journal_line), balance enforced in the DB.
--  - Balance-sheet / control nominals (the chart was P&L-only): VAT control,
--    Suspense, Uncategorised income/expense, and a bank-control per bank account.
--  - transaction.journal_entry_id links the operational row to its journal.
--  - post_journal() posts an entry + lines atomically.
-- Journals are the accounting truth (trial balance / VAT read them); the
-- transaction table stays the operational record. See BUILD-BRIEF WS11.
-- =====================================================================

-- ---- nominal_code: classes + control flags --------------------------
alter table nominal_code add column if not exists class text;           -- Asset|Liability|Income|Expense|Equity
alter table nominal_code add column if not exists is_control boolean not null default false;
alter table nominal_code add column if not exists system_managed boolean not null default false;

-- Backfill class from the existing income/expense type.
update nominal_code set class = 'Income'  where class is null and type = 'Income';
update nominal_code set class = 'Expense' where class is null and type = 'Expense';
update nominal_code set class = 'Expense' where class is null;           -- 'Both'/null fallback

-- ---- system control nominals ----------------------------------------
-- Stable codes, looked up by the app. system_managed so WS12's PM7 import can
-- reconcile with them rather than colliding.
insert into nominal_code (code, name, type, class, is_control, system_managed, sort) values
  ('2200','VAT control','Both','Liability',true,true,900),
  ('9998','Suspense','Both','Asset',true,true,990),
  ('9990','Uncategorised income','Income','Income',true,true,991),
  ('9991','Uncategorised expense','Expense','Expense',true,true,992)
on conflict (code) do nothing;

-- ---- bank_account -> control nominal --------------------------------
alter table bank_account add column if not exists control_nominal_id uuid references nominal_code(id) on delete set null;

-- Create one Asset control nominal per existing bank account and link it.
-- (None exist today; this runs for any that do, and is the pattern WS9 reuses.)
do $$
declare b record;
declare v_nom uuid;
begin
  for b in select id, coalesce(account_name, institution, 'Bank') as nm, account_mask
           from bank_account where control_nominal_id is null loop
    insert into nominal_code (code, name, type, class, is_control, system_managed, sort)
    values ('BANK-' || substr(b.id::text,1,8),
            'Bank: ' || b.nm || coalesce(' ****' || b.account_mask, ''),
            'Both','Asset',true,true,800)
    on conflict (code) do nothing
    returning id into v_nom;
    if v_nom is null then
      select id into v_nom from nominal_code where code = 'BANK-' || substr(b.id::text,1,8);
    end if;
    update bank_account set control_nominal_id = v_nom where id = b.id;
  end loop;
end $$;

-- ---- journals -------------------------------------------------------
create table if not exists journal_entry (
  id           uuid primary key default gen_random_uuid(),
  entry_date   date not null,
  description  text,
  source       text,                 -- e.g. 'transaction', 'rent_charge', 'supplier_payment'
  entity_id    uuid,                 -- WS1 populates; nullable for now
  entity_name  text,
  created_by   uuid,
  created_at   timestamptz not null default now()
);
create index if not exists idx_journal_entry_date on journal_entry (entry_date);

create table if not exists journal_line (
  id               uuid primary key default gen_random_uuid(),
  journal_entry_id uuid not null references journal_entry(id) on delete cascade,
  nominal_code_id  uuid not null references nominal_code(id),
  debit            numeric(14,2) not null default 0,
  credit           numeric(14,2) not null default 0,
  property_id      uuid references property(id) on delete set null,
  lease_id         uuid references lease(id) on delete set null,
  landlord_id      uuid references landlord(id) on delete set null,
  sort             int not null default 0,
  constraint journal_line_nonneg check (debit >= 0 and credit >= 0),
  constraint journal_line_one_side check (not (debit > 0 and credit > 0))
);
create index if not exists idx_journal_line_entry on journal_line (journal_entry_id);
create index if not exists idx_journal_line_nominal on journal_line (nominal_code_id);

alter table transaction add column if not exists journal_entry_id uuid references journal_entry(id) on delete set null;

-- ---- RLS (mirror every other table) ---------------------------------
alter table journal_entry enable row level security;
alter table journal_line  enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename='journal_entry' and policyname='authenticated_all') then
    create policy authenticated_all on journal_entry for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='journal_line' and policyname='authenticated_all') then
    create policy authenticated_all on journal_line for all to authenticated using (true) with check (true);
  end if;
end $$;

-- ---- balance enforcement (deferred, at commit) ----------------------
create or replace function check_journal_balanced() returns trigger
language plpgsql as $$
declare
  v_entry uuid := coalesce(NEW.journal_entry_id, OLD.journal_entry_id);
  v_debit numeric(14,2);
  v_credit numeric(14,2);
  v_lines int;
begin
  -- Entry may have been deleted (cascade) by commit time — nothing to check.
  if not exists (select 1 from journal_entry where id = v_entry) then
    return null;
  end if;
  select coalesce(sum(debit),0), coalesce(sum(credit),0), count(*)
    into v_debit, v_credit, v_lines
    from journal_line where journal_entry_id = v_entry;
  if v_lines < 2 then
    raise exception 'Journal entry % must have at least two lines (has %)', v_entry, v_lines;
  end if;
  if v_debit <> v_credit then
    raise exception 'Journal entry % is unbalanced: debit % <> credit %', v_entry, v_debit, v_credit;
  end if;
  return null;
end $$;

drop trigger if exists trg_journal_balanced on journal_line;
create constraint trigger trg_journal_balanced
  after insert or update or delete on journal_line
  deferrable initially deferred
  for each row execute function check_journal_balanced();

-- ---- post_journal: entry + lines atomically -------------------------
create or replace function post_journal(p_entry jsonb, p_lines jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  insert into journal_entry (entry_date, description, source, entity_id, entity_name, created_by)
  values (
    coalesce((p_entry->>'entry_date')::date, current_date),
    p_entry->>'description',
    p_entry->>'source',
    (p_entry->>'entity_id')::uuid,
    p_entry->>'entity_name',
    (p_entry->>'created_by')::uuid
  ) returning id into v_id;

  insert into journal_line (journal_entry_id, nominal_code_id, debit, credit, property_id, lease_id, landlord_id, sort)
  select v_id,
         (l->>'nominal_code_id')::uuid,
         coalesce((l->>'debit')::numeric, 0),
         coalesce((l->>'credit')::numeric, 0),
         (l->>'property_id')::uuid,
         (l->>'lease_id')::uuid,
         (l->>'landlord_id')::uuid,
         coalesce((l->>'sort')::int, 0)
  from jsonb_array_elements(p_lines) as l;

  return v_id;
end $$;

-- ---- backfill: one balanced journal per existing transaction --------
-- Bank side -> the txn's bank control, else Suspense. Counterparty -> the
-- txn's nominal, else Uncategorised income/expense by type. VAT (gross-net)
-- -> VAT control (Cr for income, Dr for expense). Line skipped when its
-- amount rounds to 0. Guarantees debit = credit.
do $$
declare
  t record;
  v_suspense uuid; v_vat uuid; v_uinc uuid; v_uexp uuid;
  v_bank uuid; v_counter uuid;
  v_gross numeric(14,2); v_net numeric(14,2); v_vatamt numeric(14,2);
  v_entry uuid; v_lines jsonb;
begin
  select id into v_suspense from nominal_code where code='9998';
  select id into v_vat      from nominal_code where code='2200';
  select id into v_uinc     from nominal_code where code='9990';
  select id into v_uexp     from nominal_code where code='9991';

  for t in select * from transaction where journal_entry_id is null loop
    v_gross := coalesce(t.amount_gross, 0);
    if v_gross = 0 then continue; end if;
    v_net := least(coalesce(t.amount_net, v_gross), v_gross);
    v_vatamt := round(v_gross - v_net, 2);

    -- bank side
    if t.bank_account_id is not null then
      select control_nominal_id into v_bank from bank_account where id = t.bank_account_id;
    end if;
    v_bank := coalesce(v_bank, v_suspense);
    -- counterparty
    v_counter := coalesce(t.nominal_code_id, case when t.type='Income' then v_uinc else v_uexp end);

    if t.type = 'Income' then
      -- Dr bank gross; Cr nominal net; Cr VAT vat
      v_lines := jsonb_build_array(
        jsonb_build_object('nominal_code_id', v_bank,    'debit',  v_gross, 'credit', 0, 'property_id', t.property_id, 'lease_id', t.lease_id, 'landlord_id', t.landlord_id, 'sort', 0)
      );
      if v_net > 0 then
        v_lines := v_lines || jsonb_build_array(jsonb_build_object('nominal_code_id', v_counter, 'debit', 0, 'credit', v_net, 'property_id', t.property_id, 'lease_id', t.lease_id, 'landlord_id', t.landlord_id, 'sort', 1));
      end if;
      if v_vatamt > 0 then
        v_lines := v_lines || jsonb_build_array(jsonb_build_object('nominal_code_id', v_vat, 'debit', 0, 'credit', v_vatamt, 'sort', 2));
      end if;
    else
      -- Dr nominal net; Dr VAT vat; Cr bank gross
      v_lines := '[]'::jsonb;
      if v_net > 0 then
        v_lines := v_lines || jsonb_build_array(jsonb_build_object('nominal_code_id', v_counter, 'debit', v_net, 'credit', 0, 'property_id', t.property_id, 'lease_id', t.lease_id, 'landlord_id', t.landlord_id, 'sort', 0));
      end if;
      if v_vatamt > 0 then
        v_lines := v_lines || jsonb_build_array(jsonb_build_object('nominal_code_id', v_vat, 'debit', v_vatamt, 'credit', 0, 'sort', 1));
      end if;
      v_lines := v_lines || jsonb_build_array(jsonb_build_object('nominal_code_id', v_bank, 'debit', 0, 'credit', v_gross, 'property_id', t.property_id, 'lease_id', t.lease_id, 'landlord_id', t.landlord_id, 'sort', 2));
    end if;

    v_entry := post_journal(
      jsonb_build_object('entry_date', t.txn_date, 'description', coalesce(t.reference, t.notes, t.type), 'source', 'transaction:backfill'),
      v_lines
    );
    update transaction set journal_entry_id = v_entry where id = t.id;
    v_bank := null;
  end loop;
end $$;
