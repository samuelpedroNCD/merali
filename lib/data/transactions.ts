import { createClient } from "@/lib/supabase/server";

export type TransactionRow = {
  id: string;
  type: string | null;
  category: string | null;
  amount_net: number | null;
  vat_rate: number | null;
  vat_amount: number | null;
  amount_gross: number | null;
  txn_date: string | null;
  property_id: string | null;
  nominal_code_id: string | null;
  status: string | null;
  reference: string | null;
  notes: string | null;
  receipt_link: string | null;
  needs_review: boolean | null;
  plaid_institution: string | null;
  property?: { id: string; address: string | null } | null;
};

export async function listTransactions(): Promise<TransactionRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("transaction")
    .select("*, property:property_id(id, address)")
    .order("txn_date", { ascending: false })
    .limit(500);
  return (data ?? []) as unknown as TransactionRow[];
}

export type LedgerTotals = { credits: number; debits: number; net: number };

export async function getLedgerTotals(): Promise<LedgerTotals> {
  const supabase = await createClient();
  const { data } = await supabase.from("transaction").select("type, amount_gross");
  let credits = 0;
  let debits = 0;
  for (const r of data ?? []) {
    const amt = Number(r.amount_gross ?? 0);
    if (r.type === "Income") credits += amt;
    else debits += amt;
  }
  return { credits, debits, net: credits - debits };
}
