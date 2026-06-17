"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth";
import { logActivity } from "@/lib/data/activity";
import { isChildConfig, isContainerConfig, isTopLevelConfig } from "@/lib/property-config";

const emptyToNull = (v: unknown) =>
  v === "" || v === undefined ? null : v;

/**
 * Friendly, app-level hierarchy checks (the DB trigger is the hard backstop).
 * Crucially also enforces that a Sub-building/Unit HAS a parent — the trigger
 * permits orphans, so this is what actually closes the orphan-unit hole.
 * Returns an error message, or null when valid.
 */
async function hierarchyError(
  supabase: Awaited<ReturnType<typeof createClient>>,
  configuration: string | null,
  parentId: string | null,
  selfId?: string,
): Promise<string | null> {
  if (parentId) {
    if (isTopLevelConfig(configuration))
      return `A "${configuration}" is a top-level property and cannot have a parent.`;
    if (selfId && parentId === selfId) return "A property cannot be its own parent.";
    const { data: parent } = await supabase
      .from("property")
      .select("configuration")
      .eq("id", parentId)
      .maybeSingle();
    if (!parent) return "The selected parent property was not found.";
    if (!isContainerConfig(parent.configuration as string | null))
      return `A ${parent.configuration ?? "property"} cannot contain other properties — choose a building or sub-building.`;
  } else if (isChildConfig(configuration)) {
    return `A "${configuration}" must belong to a parent — choose a building or sub-building.`;
  }
  return null;
}

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
  parent_property_id: z.preprocess(emptyToNull, z.string().uuid().nullable()),
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
  titles: z.array(z.object({
    doc_date: z.preprocess(emptyToNull, z.string().nullable()),
    tenure: z.preprocess(emptyToNull, z.string().nullable()),
    title_number: z.preprocess(emptyToNull, z.string().nullable()),
  })).default([]),
});

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

/** Replace a property's title documents (Date / Tenure / Title number). */
async function setPropertyTitles(
  supabase: Awaited<ReturnType<typeof createClient>>,
  propertyId: string,
  titles: { doc_date: string | null; tenure: string | null; title_number: string | null }[],
) {
  await supabase.from("property_title").delete().eq("property_id", propertyId);
  const rows = titles.filter((t) => t.doc_date || t.tenure || t.title_number);
  if (rows.length) {
    await supabase.from("property_title").insert(rows.map((t) => ({ property_id: propertyId, ...t })));
  }
}

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
  const hErr = await hierarchyError(supabase, parsed.data.configuration, parsed.data.parent_property_id);
  if (hErr) return { ok: false, error: hErr };

  const { titles, ...rest } = parsed.data;
  const { data, error } = await supabase
    .from("property")
    .insert(rest)
    .select("id, address, internal_code")
    .single();

  if (error) return { ok: false, error: error.message };

  await setPropertyTitles(supabase, data.id, titles);
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
  const hErr = await hierarchyError(supabase, parsed.data.configuration, parsed.data.parent_property_id, id);
  if (hErr) return { ok: false, error: hErr };

  const { titles, ...rest } = parsed.data;
  const { data, error } = await supabase
    .from("property")
    .update(rest)
    .eq("id", id)
    .select("id, address, internal_code")
    .single();

  if (error) return { ok: false, error: error.message };

  await setPropertyTitles(supabase, id, titles);

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

  // Guard: don't silently orphan children (the FK is ON DELETE SET NULL).
  const { count } = await supabase
    .from("property")
    .select("id", { count: "exact", head: true })
    .eq("parent_property_id", id);
  if (count && count > 0) {
    return {
      ok: false,
      error: `This property contains ${count} sub-${count === 1 ? "property" : "properties"} (sub-buildings or units). Delete or move them first.`,
    };
  }

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
