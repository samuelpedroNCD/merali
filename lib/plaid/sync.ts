import type { SupabaseClient } from "@supabase/supabase-js";
import type { Transaction as PlaidTransaction } from "plaid";
import { plaidClient } from "./client";
import { autoReconcile } from "@/lib/finance/auto-reconcile";

type BankAccount = {
  id: string;
  access_token: string | null;
  institution: string | null;
  transactions_cursor: string | null;
};

function mapTxn(t: PlaidTransaction, bank: BankAccount) {
  // Plaid: positive amount = money out of the account (expense),
  // negative = money in (income).
  const isExpense = t.amount > 0;
  const gross = Math.abs(t.amount);
  return {
    plaid_transaction_id: t.transaction_id,
    type: isExpense ? "Expense" : "Income",
    category:
      t.personal_finance_category?.primary ?? t.category?.[0] ?? null,
    amount_gross: gross,
    amount_net: gross,
    vat_rate: 0,
    vat_amount: 0,
    txn_date: t.date,
    plaid_pending: t.pending,
    plaid_synced: true,
    manual_entry: false,
    needs_review: true,
    plaid_institution: bank.institution,
    bank_account_id: bank.id,
    plaid_account_id: t.account_id,
    reference: t.name?.slice(0, 120) ?? null,
    notes: t.merchant_name ?? null,
    status: t.pending ? "Pending" : "Paid",
    plaid_sync_timestamp: new Date().toISOString(),
  };
}

/** Pull new/updated transactions for one linked item into the ledger. */
export async function syncItem(
  supabase: SupabaseClient,
  bank: BankAccount,
): Promise<{ added: number; modified: number; removed: number }> {
  if (!bank.access_token) return { added: 0, modified: 0, removed: 0 };

  let cursor = bank.transactions_cursor ?? undefined;
  let added = 0,
    modified = 0,
    removed = 0;
  let hasMore = true;

  while (hasMore) {
    const res = await plaidClient.transactionsSync({
      access_token: bank.access_token,
      cursor,
    });
    const data = res.data;

    if (data.added.length) {
      await supabase
        .from("transaction")
        .upsert(data.added.map((t) => mapTxn(t, bank)), {
          onConflict: "plaid_transaction_id",
        });
      added += data.added.length;
    }
    if (data.modified.length) {
      await supabase
        .from("transaction")
        .upsert(data.modified.map((t) => mapTxn(t, bank)), {
          onConflict: "plaid_transaction_id",
        });
      modified += data.modified.length;
    }
    if (data.removed.length) {
      await supabase
        .from("transaction")
        .delete()
        .in(
          "plaid_transaction_id",
          data.removed.map((r) => r.transaction_id).filter(Boolean) as string[],
        );
      removed += data.removed.length;
    }

    cursor = data.next_cursor;
    hasMore = data.has_more;
  }

  await supabase
    .from("bank_account")
    .update({ transactions_cursor: cursor, last_synced_date: new Date().toISOString() })
    .eq("id", bank.id);

  return { added, modified, removed };
}

/** Sync all linked items. */
export async function syncAll(supabase: SupabaseClient) {
  const { data: banks } = await supabase
    .from("bank_account")
    .select("id, access_token, institution, transactions_cursor");
  let total = { added: 0, modified: 0, removed: 0 };
  for (const b of banks ?? []) {
    const r = await syncItem(supabase, b as BankAccount);
    total = {
      added: total.added + r.added,
      modified: total.modified + r.modified,
      removed: total.removed + r.removed,
    };
  }
  // Auto-link confident rent matches; leave the rest for manual review.
  const autoReconciled = await autoReconcile(supabase);
  return { ...total, autoReconciled };
}
