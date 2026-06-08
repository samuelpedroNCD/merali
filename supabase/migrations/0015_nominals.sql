-- Nominal codes (chart of accounts) + tagging on transactions and a default
-- rent nominal per tenancy. Editable by staff; seeded with a standard set.
create table if not exists nominal_code (
  id    uuid primary key default gen_random_uuid(),
  code  text not null,
  name  text not null,
  type  text not null default 'Expense',   -- Income | Expense | Both
  active boolean not null default true,
  sort  int not null default 0,
  created_at timestamptz not null default now()
);
create unique index if not exists nominal_code_code_idx on nominal_code (code);

alter table transaction add column if not exists nominal_code_id uuid references nominal_code(id) on delete set null;
alter table lease       add column if not exists rent_nominal_id uuid references nominal_code(id) on delete set null;

insert into nominal_code (code, name, type, sort) values
  ('4000','Rent received','Income',10),
  ('4010','Other income / charges','Income',20),
  ('4020','Late payment fees','Income',30),
  ('4030','Deposit received','Income',40),
  ('5000','Repairs & maintenance','Expense',100),
  ('5010','Management fees','Expense',110),
  ('5020','Insurance','Expense',120),
  ('5030','Utilities','Expense',130),
  ('5040','Ground rent / service charge','Expense',140),
  ('5050','Cleaning','Expense',150),
  ('5060','Letting / agency fees','Expense',160),
  ('5070','Legal & professional','Expense',170),
  ('5080','Mortgage interest','Expense',180),
  ('5090','Furnishings & white goods','Expense',190),
  ('5100','Safety certificates','Expense',200),
  ('5110','Void / re-let costs','Expense',210)
on conflict (code) do nothing;

alter table nominal_code enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'nominal_code' and policyname = 'merali_auth_nominal') then
    create policy merali_auth_nominal on nominal_code for all to authenticated using (true) with check (true);
  end if;
end $$;
