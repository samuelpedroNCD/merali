// WS11 — Double-entry journals for cash transactions.
//
// A `transaction` (the operational, bank-side record) also posts a *balanced*
// journal: the accounting truth the trial balance (WS12) and VAT (WS13) read.
// `buildTransactionJournal` is pure and mirrors the SQL backfill in
// migration 0023 exactly; `syncTransactionJournal` runs it at write time.

import type { SupabaseClient } from "@supabase/supabase-js";

export type JournalLineInput = {
  nominal_code_id: string;
  debit: number;
  credit: number;
  property_id?: string | null;
  lease_id?: string | null;
  landlord_id?: string | null;
  sort: number;
};

export type TxnForJournal = {
  type: string | null;
  amount_gross: number | null;
  amount_net: number | null;
  nominal_code_id: string | null;
  property_id: string | null;
  lease_id: string | null;
  landlord_id: string | null;
  bank_account_id: string | null;
};

export type ControlNominals = {
  suspenseId: string;
  vatControlId: string;
  uncatIncomeId: string;
  uncatExpenseId: string;
  /** The txn's bank control nominal, if the txn has a bank account. */
  bankControlId?: string | null;
};

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Build the balanced journal lines for a cash transaction.
 * Income:  Dr bank(gross) · Cr nominal(net) · Cr VAT(vat)
 * Expense: Dr nominal(net) · Dr VAT(vat) · Cr bank(gross)
 * Bank side → the txn's bank control, else Suspense. Counterparty → the txn's
 * nominal, else Uncategorised income/expense by type. Zero-value lines are
 * dropped (so a tax-only or zero-VAT entry still balances). Returns [] when
 * gross is 0 (nothing to post).
 */
export function buildTransactionJournal(txn: TxnForJournal, ctrl: ControlNominals): JournalLineInput[] {
  const gross = r2(Number(txn.amount_gross ?? 0));
  if (gross === 0) return [];
  const net = r2(Math.min(Number(txn.amount_net ?? gross), gross));
  const vat = r2(gross - net);
  const bank = ctrl.bankControlId || ctrl.suspenseId;
  const counter = txn.nominal_code_id ?? (txn.type === "Income" ? ctrl.uncatIncomeId : ctrl.uncatExpenseId);
  const tags = { property_id: txn.property_id, lease_id: txn.lease_id, landlord_id: txn.landlord_id };
  const lines: JournalLineInput[] = [];

  if (txn.type === "Income") {
    lines.push({ nominal_code_id: bank, debit: gross, credit: 0, ...tags, sort: 0 });
    if (net > 0) lines.push({ nominal_code_id: counter, debit: 0, credit: net, ...tags, sort: 1 });
    if (vat > 0) lines.push({ nominal_code_id: ctrl.vatControlId, debit: 0, credit: vat, sort: 2 });
  } else {
    if (net > 0) lines.push({ nominal_code_id: counter, debit: net, credit: 0, ...tags, sort: 0 });
    if (vat > 0) lines.push({ nominal_code_id: ctrl.vatControlId, debit: vat, credit: 0, sort: 1 });
    lines.push({ nominal_code_id: bank, debit: 0, credit: gross, ...tags, sort: 2 });
  }
  return lines;
}

const CONTROL_CODES = { vat: "2200", suspense: "9998", uncatIncome: "9990", uncatExpense: "9991" } as const;

/** Fetch the system control nominal ids (seeded in 0023) by their stable codes. */
export async function getControlNominals(
  supabase: SupabaseClient,
): Promise<Omit<ControlNominals, "bankControlId"> | null> {
  const { data } = await supabase
    .from("nominal_code")
    .select("id, code")
    .in("code", [CONTROL_CODES.vat, CONTROL_CODES.suspense, CONTROL_CODES.uncatIncome, CONTROL_CODES.uncatExpense]);
  const byCode = new Map((data ?? []).map((r) => [r.code as string, r.id as string]));
  const vatControlId = byCode.get(CONTROL_CODES.vat);
  const suspenseId = byCode.get(CONTROL_CODES.suspense);
  const uncatIncomeId = byCode.get(CONTROL_CODES.uncatIncome);
  const uncatExpenseId = byCode.get(CONTROL_CODES.uncatExpense);
  if (!vatControlId || !suspenseId || !uncatIncomeId || !uncatExpenseId) return null;
  return { vatControlId, suspenseId, uncatIncomeId, uncatExpenseId };
}

/**
 * Recompute a transaction's journal from its current state: replace any existing
 * journal (delete → the FK nulls the link) and post a fresh balanced one, then
 * relink. Best-effort — logs and returns on failure; the consistency check
 * (lib/finance/journal-consistency.ts) surfaces any transaction left without a
 * balancing journal. Call after every insert/update of a `transaction` row.
 */
export async function syncTransactionJournal(supabase: SupabaseClient, txnId: string): Promise<void> {
  const { data: txn } = await supabase
    .from("transaction")
    .select("type, amount_gross, amount_net, nominal_code_id, property_id, lease_id, landlord_id, bank_account_id, txn_date, reference, notes, journal_entry_id")
    .eq("id", txnId)
    .maybeSingle();
  if (!txn) return;

  // Drop any existing journal first (FK on delete set null clears the link).
  if (txn.journal_entry_id) {
    await supabase.from("journal_entry").delete().eq("id", txn.journal_entry_id as string);
  }

  const ctrl = await getControlNominals(supabase);
  if (!ctrl) {
    console.error("[journal] control nominals missing — skipping journal for", txnId);
    return;
  }

  let bankControlId: string | null = null;
  let entityId: string | null = null;
  if (txn.bank_account_id) {
    const { data: bank } = await supabase
      .from("bank_account")
      .select("control_nominal_id, entity_id")
      .eq("id", txn.bank_account_id as string)
      .maybeSingle();
    bankControlId = (bank?.control_nominal_id as string) ?? null;
    entityId = (bank?.entity_id as string) ?? null;
  }

  const lines = buildTransactionJournal(txn as TxnForJournal, { ...ctrl, bankControlId });
  if (lines.length === 0) return; // nothing to post (gross 0)

  const { data: entryId, error } = await supabase.rpc("post_journal", {
    p_entry: {
      entry_date: txn.txn_date,
      description: (txn.reference as string) || (txn.notes as string) || (txn.type as string) || "Transaction",
      source: "transaction",
      entity_id: entityId,
    },
    p_lines: lines,
  });
  if (error) {
    console.error("[journal] post_journal failed for", txnId, error.message);
    return;
  }
  await supabase.from("transaction").update({ journal_entry_id: entryId }).eq("id", txnId);
}
