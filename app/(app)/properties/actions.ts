"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth";
import { logActivity } from "@/lib/data/activity";

const emptyToNull = (v: unknown) =>
  v === "" || v === undefined ? null : v;

const PropertySchema = z.object({
  address: z.preprocess(emptyToNull, z.string().nullable()),
  flat: z.preprocess(emptyToNull, z.string().nullable()),
  town: z.preprocess(emptyToNull, z.string().nullable()),
  post_code: z.preprocess(emptyToNull, z.string().nullable()),
  country: z.preprocess(emptyToNull, z.string().nullable()),
  area: z.preprocess(emptyToNull, z.string().nullable()),
  internal_code: z.preprocess(emptyToNull, z.string().nullable()),
  configuration: z.preprocess(emptyToNull, z.string().nullable()),
  class: z.preprocess(emptyToNull, z.string().nullable()),
  property_type: z.preprocess(emptyToNull, z.string().nullable()),
  status: z.preprocess(emptyToNull, z.string().nullable()),
  tenancy_class: z.preprocess(emptyToNull, z.string().nullable()),
  property_tax: z.preprocess(emptyToNull, z.string().nullable()),
  bedrooms: z.preprocess(
    (v) => (v === "" || v == null ? null : Number(v)),
    z.number().int().nonnegative().nullable(),
  ),
  landlord_id: z.preprocess(emptyToNull, z.string().uuid().nullable()),
  date_acquired: z.preprocess(emptyToNull, z.string().nullable()),
  leasehold_register_number: z.preprocess(emptyToNull, z.string().nullable()),
  target_rent: z.preprocess(
    (v) => (v === "" || v == null ? null : Number(v)),
    z.number().nonnegative().nullable(),
  ),
  target_rent_month: z.preprocess(emptyToNull, z.string().nullable()),
  google_place_id: z.preprocess(emptyToNull, z.string().nullable()).optional(),
  notes: z.preprocess(emptyToNull, z.string().nullable()),
});

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

export async function createProperty(input: unknown): Promise<ActionResult> {
  let user;
  try {
    user = await requirePermission("properties", "create");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const parsed = PropertySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid property data." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("property")
    .insert(parsed.data)
    .select("id, address, internal_code")
    .single();

  if (error) return { ok: false, error: error.message };

  await logActivity({
    type: "Property Creation",
    objectLabel: data.address || data.internal_code,
    objectTable: "property",
    objectId: data.id,
    creatorId: user.id,
  });
  revalidatePath("/properties");
  return { ok: true, id: data.id };
}

export async function updateProperty(
  id: string,
  input: unknown,
): Promise<ActionResult> {
  let user;
  try {
    user = await requirePermission("properties", "edit");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const parsed = PropertySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid property data." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("property")
    .update(parsed.data)
    .eq("id", id)
    .select("id, address, internal_code")
    .single();

  if (error) return { ok: false, error: error.message };

  await logActivity({
    type: "Property Update",
    objectLabel: data.address || data.internal_code,
    objectTable: "property",
    objectId: id,
    creatorId: user.id,
  });
  revalidatePath("/properties");
  revalidatePath(`/properties/${id}`);
  return { ok: true, id };
}

export async function deleteProperty(id: string): Promise<ActionResult> {
  let user;
  try {
    user = await requirePermission("properties", "delete"); // Admin-only
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("property").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  await logActivity({
    type: "Property Deletion",
    objectTable: "property",
    objectId: id,
    creatorId: user.id,
  });
  revalidatePath("/properties");
  return { ok: true };
}
