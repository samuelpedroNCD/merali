import { createClient } from "@/lib/supabase/server";
import { computeVatReturn, type VatReturn, type VatReturnLine } from "@/lib/finance/vat";

const rel = <T,>(v: unknown): T | null => (Array.isArray(v) ? (v[0] ?? null) : ((v as T) ?? null)) as T | null;

export type VatReturnFilter = { from: string; to: string; entityId?: string | null };

/** VAT return boxes for a period (and optional company), from journal lines. */
export async function getVatReturn(f: VatReturnFilter): Promise<VatReturn> {
  const supabase = await createClient();
  let q = supabase
    .from("journal_line")
    .select("debit, credit, nominal_code(code, class), journal_entry!inner(entry_date, entity_id)")
    .gte("journal_entry.entry_date", f.from)
    .lte("journal_entry.entry_date", f.to);
  if (f.entityId) q = q.eq("journal_entry.entity_id", f.entityId);
  const { data } = await q.limit(50000);

  const lines: VatReturnLine[] = (data ?? []).map((r) => {
    const n = rel<{ code: string | null; class: string | null }>((r as Record<string, unknown>).nominal_code);
    return {
      is_vat_control: n?.code === "2200",
      nominal_class: n?.class ?? null,
      debit: Number(r.debit ?? 0),
      credit: Number(r.credit ?? 0),
    };
  });
  return computeVatReturn(lines);
}

export type VatReturnTxn = {
  id: string;
  txn_date: string | null;
  type: string | null;
  property: string | null;
  amount_net: number | null;
  vat_amount: number | null;
  amount_gross: number | null;
  reference: string | null;
};

/** The VAT-bearing transactions behind the return (period + optional company). */
export async function getVatReturnTransactions(f: VatReturnFilter): Promise<VatReturnTxn[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("transaction")
    .select("id, txn_date, type, amount_net, vat_amount, amount_gross, reference, property:property_id(address), journal_entry:journal_entry_id(entity_id)")
    .gte("txn_date", f.from)
    .lte("txn_date", f.to)
    .order("txn_date", { ascending: true })
    .limit(5000);

  return (data ?? [])
    .filter((t) => {
      if (!f.entityId) return true;
      const je = rel<{ entity_id: string | null }>((t as Record<string, unknown>).journal_entry);
      return je?.entity_id === f.entityId;
    })
    .filter((t) => Number(t.vat_amount ?? 0) !== 0)
    .map((t) => ({
      id: t.id as string,
      txn_date: (t.txn_date as string) ?? null,
      type: (t.type as string) ?? null,
      property: rel<{ address: string }>((t as Record<string, unknown>).property)?.address ?? null,
      amount_net: t.amount_net != null ? Number(t.amount_net) : null,
      vat_amount: t.vat_amount != null ? Number(t.vat_amount) : null,
      amount_gross: t.amount_gross != null ? Number(t.amount_gross) : null,
      reference: (t.reference as string) ?? null,
    }));
}
