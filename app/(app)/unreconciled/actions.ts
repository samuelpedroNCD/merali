"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth";
import { logActivity } from "@/lib/data/activity";

const s = (v: unknown) => (v === "" || v === undefined ? null : v);

const Schema = z.object({
  type: z.preprocess(s, z.string().nullable()),
  category: z.preprocess(s, z.string().nullable()),
  property_id: z.preprocess(s, z.string().uuid().nullable()),
  lease_id: z.preprocess(s, z.string().uuid().nullable()),
  nominal_code_id: z.preprocess(s, z.string().uuid().nullable()),
});

export type ActionResult = { ok: true } | { ok: false; error: string };

/** Assign a transaction (property/tenancy/nominal/category/type) and clear its review flag. */
export async function approveTransaction(id: string, input: unknown): Promise<ActionResult> {
  let user;
  try {
    user = await requirePermission("finance", "edit");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const parsed = Schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid data." };

  const supabase = await createClient();
  // Auto-derive the tenancy from the property when there's exactly one active lease.
  let lease_id = parsed.data.lease_id;
  if (!lease_id && parsed.data.property_id) {
    const { data } = await supabase.from("lease").select("id").eq("property_id", parsed.data.property_id).eq("status", "Active");
    if (data && data.length === 1) lease_id = data[0].id as string;
  }

  const { error } = await supabase
    .from("transaction")
    .update({ ...parsed.data, lease_id, needs_review: false })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  await logActivity({ type: "Transaction Approved", objectTable: "transaction", objectId: id, creatorId: user.id });
  revalidatePath("/unreconciled");
  revalidatePath("/nominal");
  revalidatePath("/finances");
  if (lease_id) revalidatePath(`/tenancies/${lease_id}`);
  return { ok: true };
}
