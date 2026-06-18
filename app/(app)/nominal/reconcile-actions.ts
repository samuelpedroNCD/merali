"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth";
import { logActivity } from "@/lib/data/activity";
import { rankMatches, applyPayment, paymentTolerance, displayScore, type ScheduleCandidate } from "@/lib/finance/reconcile";

export type Suggestion = {
  id: string;
  due_date: string;
  amount_due: number;
  outstanding: number;
  property: string | null;
  tenant: string | null;
  score: number;
};

export type Instalment = {
  id: string;
  due_date: string;
  outstanding: number;
  property: string | null;
  tenant: string | null;
};

export type SuggestionsResult = {
  txn: { amount: number; date: string | null; reference: string | null; type: string | null };
  suggestions: Suggestion[];
  // Every unpaid instalment (scoped to the txn's property when set), for the
  // manual picker when no suggestion is correct.
  allInstalments: Instalment[];
};

export async function fetchSuggestions(txnId: string): Promise<SuggestionsResult | null> {
  await requirePermission("finance", "edit");
  const supabase = await createClient();

  const { data: txn } = await supabase
    .from("transaction")
    .select("amount_gross, txn_date, reference, property_id, type")
    .eq("id", txnId)
    .maybeSingle();
  if (!txn) return null;

  // Unpaid schedule rows, optionally scoped to the txn's property.
  let q = supabase
    .from("rent_schedule")
    .select("id, due_date, amount_due, amount_collected, invoice_status, property:property_id(address, internal_code), tenant:tenant_id(full_name)")
    .neq("invoice_status", "Paid")
    .limit(200);
  if (txn.property_id) q = q.eq("property_id", txn.property_id);
  const { data: rows } = await q;

  const byId = new Map((rows ?? []).map((r) => [r.id as string, r]));
  const label = (rel: unknown, key: string) => {
    const v = rel as Record<string, string> | Record<string, string>[] | null;
    return (Array.isArray(v) ? v[0]?.[key] : v?.[key]) ?? null;
  };

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
    Number(txn.amount_gross ?? 0),
    (txn.txn_date as string) ?? new Date().toISOString().slice(0, 10),
    candidates,
    (txn.reference as string) ?? null,
  );

  const allInstalments: Instalment[] = (rows ?? [])
    .map((r) => ({
      id: r.id as string,
      due_date: r.due_date as string,
      outstanding: Number(r.amount_due ?? 0) - Number(r.amount_collected ?? 0),
      property: label((r as Record<string, unknown>).property, "address"),
      tenant: label((r as Record<string, unknown>).tenant, "full_name"),
    }))
    .sort((a, b) => b.due_date.localeCompare(a.due_date));

  return {
    txn: {
      amount: Number(txn.amount_gross ?? 0),
      date: (txn.txn_date as string) ?? null,
      reference: (txn.reference as string) ?? null,
      type: (txn.type as string) ?? null,
    },
    allInstalments,
    suggestions: ranked.slice(0, 8).map((m) => {
      const row = byId.get(m.candidate.id)!;
      return {
        id: m.candidate.id,
        due_date: m.candidate.due_date,
        amount_due: m.candidate.amount_due,
        outstanding: m.candidate.amount_due - m.candidate.amount_collected,
        property: label((row as Record<string, unknown>).property, "address"),
        tenant: label((row as Record<string, unknown>).tenant, "full_name"),
        score: displayScore(m.score),
      };
    }),
  };
}

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function reconcileTransaction(
  txnId: string,
  scheduleId: string,
): Promise<ActionResult> {
  let user;
  try {
    user = await requirePermission("finance", "edit");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const supabase = await createClient();

  const { data: txn } = await supabase
    .from("transaction")
    .select("type, amount_gross, reconciled_with")
    .eq("id", txnId)
    .maybeSingle();
  if (!txn) return { ok: false, error: "Transaction not found." };
  if (txn.type !== "Income") {
    return { ok: false, error: "Only income can be matched to rent. Use Approve to assign an expense." };
  }
  if (txn.reconciled_with) {
    return { ok: false, error: "This transaction is already reconciled — unmatch it first." };
  }

  const { data: sched } = await supabase
    .from("rent_schedule")
    .select("amount_due, amount_collected, lease_id")
    .eq("id", scheduleId)
    .maybeSingle();
  if (!sched) return { ok: false, error: "Schedule row not found." };

  const amountDue = Number(sched.amount_due ?? 0);
  const prevCollected = Number(sched.amount_collected ?? 0);
  if (amountDue - prevCollected <= paymentTolerance(amountDue)) {
    return { ok: false, error: "That instalment is already settled — pick another, or use Approve." };
  }

  // Record the actual payment: accumulate and decide Partial vs Paid.
  const { collected, status } = applyPayment(amountDue, prevCollected, Number(txn.amount_gross ?? 0));

  const { error: e1 } = await supabase
    .from("transaction")
    .update({ reconciled_with: scheduleId, linked_invoice_id: scheduleId, lease_id: sched.lease_id, needs_review: false })
    .eq("id", txnId);
  if (e1) return { ok: false, error: e1.message };

  const { error: e2 } = await supabase
    .from("rent_schedule")
    .update({ amount_collected: collected, invoice_status: status, reconciled: true })
    .eq("id", scheduleId);
  if (e2) return { ok: false, error: e2.message };

  await logActivity({
    type: "Transaction Reconciled",
    objectTable: "transaction",
    objectId: txnId,
    creatorId: user.id,
  });
  revalidatePath("/nominal");
  revalidatePath("/finances");
  revalidatePath("/payments");
  if (sched.lease_id) revalidatePath(`/tenancies/${sched.lease_id}`);
  return { ok: true };
}

/**
 * Reverse a reconciliation: unlink the transaction (back to the review queue)
 * and recompute the instalment from whatever transactions remain linked to it.
 */
export async function unreconcileTransaction(txnId: string): Promise<ActionResult> {
  let user;
  try {
    user = await requirePermission("finance", "edit");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const supabase = await createClient();

  const { data: txn } = await supabase
    .from("transaction")
    .select("reconciled_with")
    .eq("id", txnId)
    .maybeSingle();
  if (!txn) return { ok: false, error: "Transaction not found." };
  const scheduleId = txn.reconciled_with as string | null;

  const { error: e1 } = await supabase
    .from("transaction")
    .update({ reconciled_with: null, linked_invoice_id: null, lease_id: null, needs_review: true })
    .eq("id", txnId);
  if (e1) return { ok: false, error: e1.message };

  let leaseId: string | null = null;
  if (scheduleId) {
    const { data: sched } = await supabase
      .from("rent_schedule")
      .select("amount_due, lease_id")
      .eq("id", scheduleId)
      .maybeSingle();
    leaseId = (sched?.lease_id as string) ?? null;
    // Recompute collected from the transactions still linked to this instalment.
    const { data: linked } = await supabase
      .from("transaction")
      .select("amount_gross")
      .eq("reconciled_with", scheduleId);
    const collected = (linked ?? []).reduce((a, t) => a + Number(t.amount_gross ?? 0), 0);
    const amountDue = Number(sched?.amount_due ?? 0);
    const status = collected <= 0 ? "Pending" : collected + paymentTolerance(amountDue) >= amountDue ? "Paid" : "Partial";
    await supabase
      .from("rent_schedule")
      .update({ amount_collected: collected, invoice_status: status, reconciled: collected > 0 })
      .eq("id", scheduleId);
  }

  await logActivity({
    type: "Transaction Unreconciled",
    objectTable: "transaction",
    objectId: txnId,
    creatorId: user.id,
  });
  revalidatePath("/nominal");
  revalidatePath("/finances");
  revalidatePath("/payments");
  revalidatePath("/unreconciled");
  if (leaseId) revalidatePath(`/tenancies/${leaseId}`);
  return { ok: true };
}

export async function dismissReview(txnId: string): Promise<ActionResult> {
  try {
    await requirePermission("finance", "edit");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("transaction")
    .update({ needs_review: false })
    .eq("id", txnId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/nominal");
  return { ok: true };
}
