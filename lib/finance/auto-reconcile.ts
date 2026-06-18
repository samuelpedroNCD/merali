import type { SupabaseClient } from "@supabase/supabase-js";
import { rankMatches, applyPayment, type ScheduleCandidate } from "@/lib/finance/reconcile";

const AUTO_THRESHOLD = 90; // only auto-link very confident, unambiguous matches

/**
 * Auto-reconcile high-confidence, unambiguous bank payments to rent.
 * Conservative: only links when the best match scores ≥90 AND no other
 * candidate is close (≥80). Everything else stays in the needs-review queue
 * for a human. Returns how many were auto-reconciled.
 */
export async function autoReconcile(supabase: SupabaseClient): Promise<number> {
  const { data: txns } = await supabase
    .from("transaction")
    .select("id, amount_gross, txn_date, property_id, reference")
    .eq("needs_review", true)
    .eq("type", "Income")
    .limit(200);

  let reconciled = 0;

  for (const t of txns ?? []) {
    let q = supabase
      .from("rent_schedule")
      .select("id, due_date, amount_due, amount_collected, invoice_status, lease_id, property:property_id(internal_code), tenant:tenant_id(full_name)")
      .neq("invoice_status", "Paid")
      .limit(200);
    if (t.property_id) q = q.eq("property_id", t.property_id);
    const { data: rows } = await q;

    const label = (rel: unknown, key: string) => {
      const v = rel as Record<string, string> | Record<string, string>[] | null;
      return (Array.isArray(v) ? v[0]?.[key] : v?.[key]) ?? null;
    };
    const leaseById = new Map<string, string | null>((rows ?? []).map((r) => [r.id as string, (r.lease_id as string) ?? null]));
    const candidates: ScheduleCandidate[] = (rows ?? []).map((r) => ({
      id: r.id as string,
      due_date: r.due_date as string,
      amount_due: Number(r.amount_due ?? 0),
      amount_collected: Number(r.amount_collected ?? 0),
      invoice_status: (r.invoice_status as string) ?? "Pending",
      tenant_name: label((r as Record<string, unknown>).tenant, "full_name"),
      property_code: label((r as Record<string, unknown>).property, "internal_code"),
    }));

    const ranked = rankMatches(
      Number(t.amount_gross ?? 0),
      (t.txn_date as string) ?? new Date().toISOString().slice(0, 10),
      candidates,
      (t.reference as string) ?? null,
    );
    const best = ranked[0];
    const runnerUp = ranked[1];
    if (!best || best.score < AUTO_THRESHOLD) continue;
    if (runnerUp && runnerUp.score >= 80) continue; // ambiguous → leave for human

    const { collected, status } = applyPayment(
      best.candidate.amount_due,
      best.candidate.amount_collected,
      Number(t.amount_gross ?? 0),
    );
    await supabase
      .from("transaction")
      .update({ reconciled_with: best.candidate.id, linked_invoice_id: best.candidate.id, lease_id: leaseById.get(best.candidate.id) ?? null, needs_review: false })
      .eq("id", t.id);
    await supabase
      .from("rent_schedule")
      .update({ amount_collected: collected, invoice_status: status, reconciled: true })
      .eq("id", best.candidate.id);
    reconciled++;
  }

  return reconciled;
}
