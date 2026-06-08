-- Plaid sync support: per-item cursor + idempotent transaction upserts.
alter table bank_account add column if not exists transactions_cursor text;
alter table bank_account add column if not exists user_id uuid;

create unique index if not exists transaction_plaid_txn_uniq
  on transaction (plaid_transaction_id)
  where plaid_transaction_id is not null;
