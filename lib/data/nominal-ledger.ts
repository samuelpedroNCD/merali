import { createClient } from "@/lib/supabase/server";
import { aggregateTrialBalance, type TBInputLine, type TrialBalance } from "@/lib/finance/trial-balance";

const rel = <T,>(v: unknown): T | null => (Array.isArray(v) ? (v[0] ?? null) : ((v as T) ?? null)) as T | null;

/**
 * Trial balance as at a date, from journal lines (WS11).
 * - No filter → all-company; the two column totals are equal (balanced).
 * - `landlordId` → that landlord's activity by nominal (may not self-balance).
 * - `entityId` → per-entity (self-balances once WS1 populates entity_id).
 */
export async function getTrialBalance(opts: {
  asOf: string;
  landlordId?: string | null;
  entityId?: string | null;
}): Promise<TrialBalance> {
  const supabase = await createClient();
  let q = supabase
    .from("journal_line")
    .select("debit, credit, landlord_id, nominal_code(id, code, name, class), journal_entry!inner(entry_date, entity_id)")
    .lte("journal_entry.entry_date", opts.asOf);
  if (opts.landlordId) q = q.eq("landlord_id", opts.landlordId);
  if (opts.entityId) q = q.eq("journal_entry.entity_id", opts.entityId);
  const { data } = await q.limit(50000);

  const lines: TBInputLine[] = (data ?? []).flatMap((r) => {
    const n = rel<{ id: string; code: string; name: string; class: string | null }>((r as Record<string, unknown>).nominal_code);
    if (!n) return [];
    return [{
      nominal_id: n.id,
      code: n.code,
      name: n.name,
      nominal_class: n.class,
      debit: Number(r.debit ?? 0),
      credit: Number(r.credit ?? 0),
    }];
  });
  return aggregateTrialBalance(lines);
}

export type NominalActivityRow = {
  entry_date: string | null;
  description: string | null;
  source: string | null;
  debit: number;
  credit: number;
  running: number;
};

export type NominalActivity = {
  code: string;
  name: string;
  rows: NominalActivityRow[];
  closing: number;
};

/** One nominal's journal lines over time, with a running balance (debit − credit). */
export async function getNominalActivity(
  nominalId: string,
  opts: { from?: string | null; to?: string | null; landlordId?: string | null } = {},
): Promise<NominalActivity | null> {
  const supabase = await createClient();
  const { data: nom } = await supabase.from("nominal_code").select("code, name").eq("id", nominalId).maybeSingle();
  if (!nom) return null;

  let q = supabase
    .from("journal_line")
    .select("debit, credit, landlord_id, journal_entry!inner(entry_date, description, source)")
    .eq("nominal_code_id", nominalId);
  if (opts.from) q = q.gte("journal_entry.entry_date", opts.from);
  if (opts.to) q = q.lte("journal_entry.entry_date", opts.to);
  if (opts.landlordId) q = q.eq("landlord_id", opts.landlordId);
  const { data } = await q.limit(50000);

  const raw = (data ?? []).map((r) => {
    const e = rel<{ entry_date: string; description: string | null; source: string | null }>((r as Record<string, unknown>).journal_entry);
    return {
      entry_date: e?.entry_date ?? null,
      description: e?.description ?? null,
      source: e?.source ?? null,
      debit: Number(r.debit ?? 0),
      credit: Number(r.credit ?? 0),
    };
  });
  raw.sort((a, b) => (a.entry_date ?? "").localeCompare(b.entry_date ?? ""));

  let running = 0;
  const rows: NominalActivityRow[] = raw.map((r) => {
    running = Math.round((running + r.debit - r.credit) * 100) / 100;
    return { ...r, running };
  });
  return { code: nom.code as string, name: nom.name as string, rows, closing: running };
}
