"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth";
import { logActivity } from "@/lib/data/activity";
import { syncRentSchedule } from "@/lib/finance/rentSchedule";
import { tenancyStatus, statusToStored } from "@/lib/tenancy-status";

const s = (v: unknown) => (v === "" || v === undefined ? null : v);

const Schema = z.object({
  property_id: z.preprocess(s, z.string().uuid().nullable()),
  unit_id: z.preprocess(s, z.string().uuid().nullable()),
  tenant_ids: z.array(z.string().uuid()).default([]),
  lead_tenant_id: z.preprocess(s, z.string().uuid().nullable()),
  tenancy_code: z.preprocess(s, z.string().nullable()),
  tenancy_type: z.preprocess(s, z.string().nullable()),
  tenancy_class: z.preprocess(s, z.string().nullable()),
  term_type: z.preprocess(s, z.string().nullable()),
  start_date: z.preprocess(s, z.string().nullable()),
  end_date: z.preprocess(s, z.string().nullable()),
  commencement_date: z.preprocess(s, z.string().nullable()),
  rent_commencement_date: z.preprocess(s, z.string().nullable()),
  deposit_received: z.preprocess((v) => v === true || v === "true", z.boolean()).default(false),
  move_in_date: z.preprocess(s, z.string().nullable()),
  renewal_date: z.preprocess(s, z.string().nullable()),
  rent_amount: z.preprocess(
    (v) => (v === "" || v == null ? null : Number(v)),
    z.number().nonnegative().nullable(),
  ),
  payment_frequency: z.preprocess(s, z.string().nullable()),
  status: z.preprocess(s, z.string().nullable()),
  rent_nominal_id: z.preprocess(s, z.string().uuid().nullable()),
  deposit_amount: z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().nonnegative().nullable()),
  deposit_scheme: z.preprocess(s, z.string().nullable()),
  deposit_reference: z.preprocess(s, z.string().nullable()),
  deposit_protected_date: z.preprocess(s, z.string().nullable()),
  deposit_returned_date: z.preprocess(s, z.string().nullable()),
  exclude_from_reminders: z.preprocess((v) => v === true || v === "true", z.boolean()).default(false),
  reviews: z.array(z.object({
    effective_date: z.string().min(1),
    new_amount: z.preprocess((v) => Number(v), z.number().nonnegative()),
  })).default([]),
  notes: z.preprocess(s, z.string().nullable()),
});

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

/** Split the parsed form into lease columns (+ derived lead tenant_id), tenant list and rent reviews. */
function splitLease(parsed: z.infer<typeof Schema>) {
  const { tenant_ids, lead_tenant_id, reviews, ...rest } = parsed;
  const lead = lead_tenant_id && tenant_ids.includes(lead_tenant_id)
    ? lead_tenant_id
    : tenant_ids[0] ?? null;
  // Status is derived from the tenancy dates (Current/Past/Future → Active/Pending/Ended).
  return { leaseData: { ...rest, tenant_id: lead, status: statusToStored(tenancyStatus(rest)) }, tenantIds: tenant_ids, lead, reviews };
}

/** Replace a lease's rent reviews. */
async function setLeaseReviews(
  supabase: Awaited<ReturnType<typeof createClient>>,
  leaseId: string,
  reviews: { effective_date: string; new_amount: number }[],
) {
  await supabase.from("rent_review").delete().eq("lease_id", leaseId);
  if (reviews.length) {
    await supabase.from("rent_review").insert(reviews.map((r) => ({ lease_id: leaseId, ...r })));
  }
}

/** Replace a lease's tenant links. */
async function setLeaseTenants(
  supabase: Awaited<ReturnType<typeof createClient>>,
  leaseId: string,
  tenantIds: string[],
  lead: string | null,
) {
  await supabase.from("lease_tenant").delete().eq("lease_id", leaseId);
  if (tenantIds.length) {
    await supabase.from("lease_tenant").insert(
      tenantIds.map((tid) => ({ lease_id: leaseId, tenant_id: tid, is_lead: tid === lead })),
    );
  }
}

export async function createLease(input: unknown): Promise<ActionResult> {
  let user;
  try {
    user = await requirePermission("leases", "create");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const parsed = Schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid lease data." };
  const { leaseData, tenantIds, lead, reviews } = splitLease(parsed.data);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lease")
    .insert(leaseData)
    .select("*")
    .single();
  if (error) return { ok: false, error: error.message };

  await setLeaseTenants(supabase, data.id, tenantIds, lead);
  await setLeaseReviews(supabase, data.id, reviews);
  await syncRentSchedule(supabase, data, reviews);
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
  const { leaseData, tenantIds, lead, reviews } = splitLease(parsed.data);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lease")
    .update(leaseData)
    .eq("id", id)
    .select("*")
    .single();
  if (error) return { ok: false, error: error.message };

  await setLeaseTenants(supabase, id, tenantIds, lead);
  await setLeaseReviews(supabase, id, reviews);
  await syncRentSchedule(supabase, data, reviews);
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
