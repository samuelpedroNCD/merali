"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth";
import { logActivity } from "@/lib/data/activity";
import { rankMatches, type ScheduleCandidate } from "@/lib/finance/reconcile";

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
  txn: { amount: number; date: string | null; reference: string | null };
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
    .select("amount_gross, txn_date, reference, property_id")
    .eq("id", txnId)
    .maybeSingle();
  if (!txn) return null;

  // Unpaid schedule rows, optionally scoped to the txn's property.
  let q = supabase
    .from("rent_schedule")
    .select("id, due_date, amount_due, amount_collected, invoice_status, property:property_id(address), tenant:tenant_id(full_name)")
    .neq("invoice_status", "Paid")
    .limit(200);
  if (txn.property_id) q = q.eq("property_id", txn.property_id);
  const { data: rows } = await q;

  const candidates: ScheduleCandidate[] = (rows ?? []).map((r) => ({
    id: r.id as string,
    due_date: r.due_date as string,
    amount_due: Number(r.amount_due ?? 0),
    amount_collected: Number(r.amount_collected ?? 0),
    invoice_status: (r.invoice_status as string) ?? "Pending",
  }));

  const ranked = rankMatches(
    Number(txn.amount_gross ?? 0),
    (txn.txn_date as string) ?? new Date().toISOString().slice(0, 10),
    candidates,
  );

  const byId = new Map((rows ?? []).map((r) => [r.id as string, r]));
  const label = (rel: unknown, key: string) => {
    const v = rel as Record<string, string> | Record<string, string>[] | null;
    return (Array.isArray(v) ? v[0]?.[key] : v?.[key]) ?? null;
  };

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
        score: m.score,
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

  const { data: sched } = await supabase
    .from("rent_schedule")
    .select("amount_due, lease_id")
    .eq("id", scheduleId)
    .maybeSingle();
  if (!sched) return { ok: false, error: "Schedule row not found." };

  const { error: e1 } = await supabase
    .from("transaction")
    .update({ reconciled_with: scheduleId, linked_invoice_id: scheduleId, lease_id: sched.lease_id, needs_review: false })
    .eq("id", txnId);
  if (e1) return { ok: false, error: e1.message };

  const { error: e2 } = await supabase
    .from("rent_schedule")
    .update({ amount_collected: sched.amount_due, invoice_status: "Paid", reconciled: true })
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
