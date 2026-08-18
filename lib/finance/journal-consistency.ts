// WS11 — Journal consistency check.
//
// Verifies the dual-write invariant: every posted cash transaction has exactly
// one balancing journal, and every journal entry balances. Used as an admin
// health report and after the 0023 backfill to prove the ledger is sound.

import type { SupabaseClient } from "@supabase/supabase-js";

export type ConsistencyReport = {
  ok: boolean;
  transactionsChecked: number;
  entriesChecked: number;
  issues: string[];
};

export async function checkJournalConsistency(supabase: SupabaseClient): Promise<ConsistencyReport> {
  const issues: string[] = [];

  // 1. Every transaction with money should link to a journal.
  const { data: txns } = await supabase
    .from("transaction")
    .select("id, amount_gross, journal_entry_id, type");
  const withMoney = (txns ?? []).filter((t) => Number(t.amount_gross ?? 0) !== 0);
  for (const t of withMoney) {
    if (!t.journal_entry_id) issues.push(`transaction ${t.id} has no journal_entry_id`);
  }

  // 2. Every journal entry balances (sum debit = sum credit, >= 2 lines).
  const { data: lines } = await supabase
    .from("journal_line")
    .select("journal_entry_id, debit, credit");
  const byEntry = new Map<string, { debit: number; credit: number; n: number }>();
  for (const l of lines ?? []) {
    const k = l.journal_entry_id as string;
    const agg = byEntry.get(k) ?? { debit: 0, credit: 0, n: 0 };
    agg.debit += Number(l.debit ?? 0);
    agg.credit += Number(l.credit ?? 0);
    agg.n += 1;
    byEntry.set(k, agg);
  }
  for (const [entry, agg] of byEntry) {
    if (agg.n < 2) issues.push(`journal ${entry} has ${agg.n} line(s)`);
    if (Math.round((agg.debit - agg.credit) * 100) !== 0) {
      issues.push(`journal ${entry} unbalanced: debit ${agg.debit.toFixed(2)} vs credit ${agg.credit.toFixed(2)}`);
    }
  }

  return {
    ok: issues.length === 0,
    transactionsChecked: withMoney.length,
    entriesChecked: byEntry.size,
    issues,
  };
}
