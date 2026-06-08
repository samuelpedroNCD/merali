"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth";
import { logActivity } from "@/lib/data/activity";

const s = (v: unknown) => (v === "" || v === undefined ? null : v);

// Category label (option_set document_linked_to) → FK column on `document`.
const FK_COLUMN: Record<string, string> = {
  Property: "property_id",
  Tenant: "tenant_id",
  Landlord: "landlord_id",
  Lease: "lease_id",
  Maintenance: "maintenance_id",
  Certification: "certification_id",
  Supplier: "supplier_id",
  Staff: "staff_id",
};

const Schema = z.object({
  name: z.string().min(1, "Name is required"),
  external_link: z
    .string()
    .min(1, "Link is required")
    .refine((v) => /^https?:\/\/.+/.test(v.trim()), "Link must start with http:// or https://"),
  linked_to: z.preprocess(s, z.string().nullable()),
  entity_id: z.preprocess(s, z.string().uuid().nullable()),
  expiry_date: z.preprocess(s, z.string().nullable()),
  tag: z.preprocess(s, z.string().nullable()),
});

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

/** Records of a given category for the document's "related record" dropdown. */
export async function getEntityOptions(
  category: string,
): Promise<{ value: string; label: string }[]> {
  await requirePermission("documents", "view");
  const supabase = await createClient();
  const pick = async (table: string, sel: string, label: (r: Record<string, unknown>) => string) => {
    const { data } = await supabase.from(table).select(sel).limit(500);
    return ((data as unknown as Record<string, unknown>[]) ?? []).map((r) => ({
      value: r.id as string,
      label: label(r) || "—",
    }));
  };
  switch (category) {
    case "Property": return pick("property", "id, address, internal_code", (r) => (r.address as string) || (r.internal_code as string));
    case "Tenant": return pick("tenant", "id, full_name, email", (r) => (r.full_name as string) || (r.email as string));
    case "Landlord": return pick("landlord", "id, full_name", (r) => r.full_name as string);
    case "Lease": return pick("lease", "id, tenancy_code, start_date", (r) => `${(r.tenancy_code as string) || "Lease"} · ${(r.start_date as string) || ""}`);
    case "Maintenance": return pick("maintenance", "id, description", (r) => (r.description as string) || "Job");
    case "Certification": return pick("certification", "id, expiry_date", (r) => `Certification · ${(r.expiry_date as string) || ""}`);
    case "Supplier": return pick("supplier", "id, business_name", (r) => r.business_name as string);
    case "Staff": return pick("staff_user", "id, full_name, email", (r) => (r.full_name as string) || (r.email as string));
    default: return [];
  }
}

export async function createDocument(input: unknown): Promise<ActionResult> {
  let user;
  try {
    user = await requirePermission("documents", "create");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const parsed = Schema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid data." };

  const { entity_id, ...rest } = parsed.data;
  const fk = rest.linked_to ? FK_COLUMN[rest.linked_to] : undefined;
  const row: Record<string, unknown> = { ...rest, uploaded_by: user.id };
  if (fk && entity_id) row[fk] = entity_id;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("document")
    .insert(row)
    .select("id, name")
    .single();
  if (error) return { ok: false, error: error.message };

  await logActivity({
    type: "Document Upload",
    objectLabel: data.name,
    objectTable: "document",
    objectId: data.id,
    creatorId: user.id,
  });
  revalidatePath("/documents");
  return { ok: true, id: data.id };
}

export async function deleteDocument(id: string): Promise<ActionResult> {
  let user;
  try {
    user = await requirePermission("documents", "delete");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("document").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  await logActivity({
    type: "Document Deletion",
    objectTable: "document",
    objectId: id,
    creatorId: user.id,
  });
  revalidatePath("/documents");
  return { ok: true };
}
