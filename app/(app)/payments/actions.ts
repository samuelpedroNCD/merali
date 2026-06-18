"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth";
import { logActivity } from "@/lib/data/activity";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function markPaid(id: string): Promise<ActionResult> {
  let user;
  try {
    user = await requirePermission("finance", "edit");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("rent_schedule")
    .select("amount_due")
    .eq("id", id)
    .maybeSingle();
  if (!row) return { ok: false, error: "Schedule row not found." };

  const { error } = await supabase
    .from("rent_schedule")
    .update({ amount_collected: row.amount_due, invoice_status: "Paid" })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  await logActivity({
    type: "Rent Marked Paid",
    objectTable: "rent_schedule",
    objectId: id,
    creatorId: user.id,
  });
  revalidatePath("/payments");
  revalidatePath("/finances");
  return { ok: true };
}

export async function markUnpaid(id: string): Promise<ActionResult> {
  try {
    await requirePermission("finance", "edit");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("rent_schedule")
    .update({ amount_collected: 0, invoice_status: "Pending", reconciled: false })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  // Release any transactions reconciled to this instalment back to the review
  // queue, so nothing is left pointing at a now-unpaid line.
  await supabase
    .from("transaction")
    .update({ reconciled_with: null, linked_invoice_id: null, needs_review: true })
    .eq("reconciled_with", id);

  revalidatePath("/payments");
  revalidatePath("/finances");
  revalidatePath("/unreconciled");
  return { ok: true };
}
