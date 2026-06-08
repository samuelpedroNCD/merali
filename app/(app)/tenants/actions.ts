"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth";
import { logActivity } from "@/lib/data/activity";

const s = (v: unknown) => (v === "" || v === undefined ? null : v);

const Schema = z.object({
  first_name: z.preprocess(s, z.string().nullable()),
  last_name: z.preprocess(s, z.string().nullable()),
  email: z.preprocess(s, z.string().nullable()),
  phone: z.preprocess(s, z.string().nullable()),
  forwarding_address: z.preprocess(s, z.string().nullable()),
  position: z.preprocess(s, z.string().nullable()),
  tenant_code: z.preprocess(s, z.string().nullable()),
  preferred_contact: z.preprocess(s, z.string().nullable()),
  tenant_type: z.preprocess(s, z.string().nullable()),
  status: z.preprocess(s, z.string().nullable()),
  acquired_date: z.preprocess(s, z.string().nullable()),
  nok_name: z.preprocess(s, z.string().nullable()),
  nok_phone: z.preprocess(s, z.string().nullable()),
  nok_email: z.preprocess(s, z.string().nullable()),
  nok_address: z.preprocess(s, z.string().nullable()),
  nok_relationship: z.preprocess(s, z.string().nullable()),
  guarantor_name: z.preprocess(s, z.string().nullable()),
  guarantor_email: z.preprocess(s, z.string().nullable()),
  guarantor_phone: z.preprocess(s, z.string().nullable()),
  notes: z.preprocess(s, z.string().nullable()),
});

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

const fullName = (d: z.infer<typeof Schema>) =>
  [d.first_name, d.last_name].filter(Boolean).join(" ").trim() ||
  d.email ||
  "Unnamed tenant";

export async function createTenant(input: unknown): Promise<ActionResult> {
  let user;
  try {
    user = await requirePermission("tenants", "create");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const parsed = Schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid tenant data." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tenant")
    .insert({ ...parsed.data, full_name: fullName(parsed.data) })
    .select("id, full_name")
    .single();
  if (error) return { ok: false, error: error.message };

  await logActivity({
    type: "Tenant Creation",
    objectLabel: data.full_name,
    objectTable: "tenant",
    objectId: data.id,
    creatorId: user.id,
  });
  revalidatePath("/tenants");
  return { ok: true, id: data.id };
}

export async function updateTenant(id: string, input: unknown): Promise<ActionResult> {
  let user;
  try {
    user = await requirePermission("tenants", "edit");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const parsed = Schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid tenant data." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tenant")
    .update({ ...parsed.data, full_name: fullName(parsed.data) })
    .eq("id", id)
    .select("id, full_name")
    .single();
  if (error) return { ok: false, error: error.message };

  await logActivity({
    type: "Tenant Update",
    objectLabel: data.full_name,
    objectTable: "tenant",
    objectId: id,
    creatorId: user.id,
  });
  revalidatePath("/tenants");
  return { ok: true, id };
}

export async function deleteTenant(id: string): Promise<ActionResult> {
  let user;
  try {
    user = await requirePermission("tenants", "delete");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("tenant").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  await logActivity({
    type: "Tenant Deletion",
    objectTable: "tenant",
    objectId: id,
    creatorId: user.id,
  });
  revalidatePath("/tenants");
  return { ok: true };
}
