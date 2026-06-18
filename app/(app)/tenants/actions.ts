"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth";
import { logActivity } from "@/lib/data/activity";
import { encryptFields, TENANT_CONTACT_SECRET_FIELDS } from "@/lib/crypto/secrets";

const s = (v: unknown) => (v === "" || v === undefined ? null : v);

const Schema = z.object({
  is_company: z.preprocess((v) => v === true || v === "true", z.boolean()).default(false),
  company_name: z.preprocess(s, z.string().nullable()),
  company_address: z.preprocess(s, z.string().nullable()),
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
  notes: z.preprocess(s, z.string().nullable()),
  contacts: z.array(z.object({
    type: z.preprocess(s, z.string().nullable()),
    name: z.preprocess(s, z.string().nullable()),
    email: z.preprocess(s, z.string().nullable()),
    phone: z.preprocess(s, z.string().nullable()),
    relationship: z.preprocess(s, z.string().nullable()),
    address: z.preprocess(s, z.string().nullable()),
  })).default([]),
});

type Contact = z.infer<typeof Schema>["contacts"][number];

/** Replace a tenant's contacts (Emergency / Guarantor), encrypting their PII. */
async function setTenantContacts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  contacts: Contact[],
) {
  await supabase.from("tenant_contact").delete().eq("tenant_id", tenantId);
  const rows = contacts.filter((c) => c.name || c.email || c.phone || c.address);
  if (rows.length) {
    await supabase.from("tenant_contact").insert(
      rows.map((c) => ({ tenant_id: tenantId, ...encryptFields(c, TENANT_CONTACT_SECRET_FIELDS) })),
    );
  }
}

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

const fullName = (d: z.infer<typeof Schema>) =>
  (d.is_company
    ? d.company_name?.trim()
    : [d.first_name, d.last_name].filter(Boolean).join(" ").trim()) ||
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
  const { contacts, ...rest } = parsed.data;
  const { data, error } = await supabase
    .from("tenant")
    .insert({ ...rest, full_name: fullName(parsed.data) })
    .select("id, full_name")
    .single();
  if (error) return { ok: false, error: error.message };
  await setTenantContacts(supabase, data.id, contacts);

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
  const { contacts, ...rest } = parsed.data;
  const { data, error } = await supabase
    .from("tenant")
    .update({ ...rest, full_name: fullName(parsed.data) })
    .eq("id", id)
    .select("id, full_name")
    .single();
  if (error) return { ok: false, error: error.message };
  await setTenantContacts(supabase, id, contacts);

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
