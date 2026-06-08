"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth";
import { logActivity } from "@/lib/data/activity";
import { syncRentSchedule } from "@/lib/finance/rentSchedule";

const s = (v: unknown) => (v === "" || v === undefined ? null : v);

const Schema = z.object({
  property_id: z.preprocess(s, z.string().uuid().nullable()),
  unit_id: z.preprocess(s, z.string().uuid().nullable()),
  tenant_id: z.preprocess(s, z.string().uuid().nullable()),
  tenancy_code: z.preprocess(s, z.string().nullable()),
  start_date: z.preprocess(s, z.string().nullable()),
  end_date: z.preprocess(s, z.string().nullable()),
  move_in_date: z.preprocess(s, z.string().nullable()),
  renewal_date: z.preprocess(s, z.string().nullable()),
  rent_amount: z.preprocess(
    (v) => (v === "" || v == null ? null : Number(v)),
    z.number().nonnegative().nullable(),
  ),
  payment_frequency: z.preprocess(s, z.string().nullable()),
  status: z.preprocess(s, z.string().nullable()),
  notes: z.preprocess(s, z.string().nullable()),
});

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

export async function createLease(input: unknown): Promise<ActionResult> {
  let user;
  try {
    user = await requirePermission("leases", "create");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const parsed = Schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid lease data." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lease")
    .insert(parsed.data)
    .select("*")
    .single();
  if (error) return { ok: false, error: error.message };

  await syncRentSchedule(supabase, data);
  await logActivity({
    type: "Lease Creation",
    objectTable: "lease",
    objectId: data.id,
    creatorId: user.id,
  });
  revalidatePath("/tenancies");
  revalidatePath("/payments");
  return { ok: true, id: data.id };
}

export async function updateLease(id: string, input: unknown): Promise<ActionResult> {
  let user;
  try {
    user = await requirePermission("leases", "edit");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const parsed = Schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid lease data." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lease")
    .update(parsed.data)
    .eq("id", id)
    .select("*")
    .single();
  if (error) return { ok: false, error: error.message };

  await syncRentSchedule(supabase, data);
  await logActivity({
    type: "Lease Update",
    objectTable: "lease",
    objectId: id,
    creatorId: user.id,
  });
  revalidatePath("/tenancies");
  revalidatePath("/payments");
  return { ok: true, id };
}

export async function deleteLease(id: string): Promise<ActionResult> {
  let user;
  try {
    user = await requirePermission("leases", "delete");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("lease").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  await logActivity({
    type: "Lease Deletion",
    objectTable: "lease",
    objectId: id,
    creatorId: user.id,
  });
  revalidatePath("/tenancies");
  revalidatePath("/payments");
  return { ok: true };
}
