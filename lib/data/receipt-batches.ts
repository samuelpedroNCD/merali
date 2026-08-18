import { createClient } from "@/lib/supabase/server";
import { batchTotals } from "@/lib/finance/receipt-batch";

const rel = <T,>(v: unknown): T | null => (Array.isArray(v) ? (v[0] ?? null) : ((v as T) ?? null)) as T | null;

export type BatchListRow = {
  id: string;
  status: string;
  expected_total: number | null;
  created_at: string;
  bank: string | null;
  entity: string | null;
  total: number;
  count: number;
  left_to_apply: number | null;
};

export async function listBatches(): Promise<BatchListRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("receipt_batch")
    .select("id, status, expected_total, created_at, bank_account:bank_account_id(code, account_name), entity:entity_id(name), transaction(amount_gross)")
    .order("created_at", { ascending: false });
  return (data ?? []).map((b) => {
    const bank = rel<{ code: string | null; account_name: string | null }>((b as Record<string, unknown>).bank_account);
    const lines = ((b as Record<string, unknown>).transaction as { amount_gross: number | null }[]) ?? [];
    const t = batchTotals(lines, b.expected_total as number | null);
    return {
      id: b.id as string,
      status: b.status as string,
      expected_total: (b.expected_total as number) ?? null,
      created_at: b.created_at as string,
      bank: bank ? `${bank.code ? bank.code + " — " : ""}${bank.account_name ?? ""}`.trim() || null : null,
      entity: rel<{ name: string }>((b as Record<string, unknown>).entity)?.name ?? null,
      total: t.total,
      count: t.count,
      left_to_apply: t.leftToApply,
    };
  });
}

export type BatchTxn = {
  id: string;
  txn_date: string | null;
  type: string | null;
  amount_gross: number | null;
  reference: string | null;
  property: string | null;
  status: string | null;
};

export type BatchDetail = {
  id: string;
  status: string;
  expected_total: number | null;
  note: string | null;
  bank_account_id: string | null;
  bank: string | null;
  entity: string | null;
  transactions: BatchTxn[];
  total: number;
  count: number;
  left_to_apply: number | null;
};

export async function getBatch(id: string): Promise<BatchDetail | null> {
  const supabase = await createClient();
  const { data: b } = await supabase
    .from("receipt_batch")
    .select("id, status, expected_total, note, bank_account_id, bank_account:bank_account_id(code, account_name), entity:entity_id(name)")
    .eq("id", id)
    .maybeSingle();
  if (!b) return null;

  const { data: txns } = await supabase
    .from("transaction")
    .select("id, txn_date, type, amount_gross, reference, status, property:property_id(address)")
    .eq("batch_id", id)
    .order("txn_date", { ascending: true });

  const transactions: BatchTxn[] = (txns ?? []).map((t) => ({
    id: t.id as string,
    txn_date: (t.txn_date as string) ?? null,
    type: (t.type as string) ?? null,
    amount_gross: t.amount_gross != null ? Number(t.amount_gross) : null,
    reference: (t.reference as string) ?? null,
    property: rel<{ address: string }>((t as Record<string, unknown>).property)?.address ?? null,
    status: (t.status as string) ?? null,
  }));

  const bank = rel<{ code: string | null; account_name: string | null }>((b as Record<string, unknown>).bank_account);
  const t = batchTotals(transactions, b.expected_total as number | null);
  return {
    id: b.id as string,
    status: b.status as string,
    expected_total: (b.expected_total as number) ?? null,
    note: (b.note as string) ?? null,
    bank_account_id: (b.bank_account_id as string) ?? null,
    bank: bank ? `${bank.code ? bank.code + " — " : ""}${bank.account_name ?? ""}`.trim() || null : null,
    entity: rel<{ name: string }>((b as Record<string, unknown>).entity)?.name ?? null,
    transactions,
    total: t.total,
    count: t.count,
    left_to_apply: t.leftToApply,
  };
}

/** Receipts on a bank that aren't in any batch yet — candidates to add. */
export async function listUnbatchedForBank(bankAccountId: string): Promise<BatchTxn[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("transaction")
    .select("id, txn_date, type, amount_gross, reference, status, property:property_id(address)")
    .eq("bank_account_id", bankAccountId)
    .is("batch_id", null)
    .order("txn_date", { ascending: true })
    .limit(200);
  return (data ?? []).map((t) => ({
    id: t.id as string,
    txn_date: (t.txn_date as string) ?? null,
    type: (t.type as string) ?? null,
    amount_gross: t.amount_gross != null ? Number(t.amount_gross) : null,
    reference: (t.reference as string) ?? null,
    property: rel<{ address: string }>((t as Record<string, unknown>).property)?.address ?? null,
    status: (t.status as string) ?? null,
  }));
}
