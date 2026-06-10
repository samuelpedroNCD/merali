"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth";
import { logActivity } from "@/lib/data/activity";
import { addableChildConfigs, CONFIG_UNIT } from "@/lib/property-config";

export type ActionResult = { ok: true } | { ok: false; error: string };

async function parent(supabase: Awaited<ReturnType<typeof createClient>>, parentId: string) {
  const { data } = await supabase
    .from("property")
    .select("address, town, post_code, country, area, internal_code, landlord_id, configuration")
    .eq("id", parentId)
    .maybeSingle();
  return data;
}

/** A child property row that inherits the parent's address/landlord. */
function childRow(
  p: Record<string, unknown>,
  parentId: string,
  configuration: string,
  label: string,
) {
  return {
    parent_property_id: parentId,
    configuration,
    internal_code: label,
    flat: label,
    address: p.address ?? null,
    town: p.town ?? null,
    post_code: p.post_code ?? null,
    country: p.country ?? "United Kingdom",
    area: p.area ?? null,
    landlord_id: p.landlord_id ?? null,
    // Only leaf units carry an occupancy status; containers don't.
    status: configuration === CONFIG_UNIT ? "Vacant" : null,
  };
}

/** Add a single child (Unit or Sub-building) under a container property. */
export async function addChild(
  parentId: string,
  configuration: string,
  label: string,
): Promise<ActionResult> {
  let user;
  try {
    user = await requirePermission("units", "create");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  if (!label.trim()) return { ok: false, error: "A name or number is required." };
  const supabase = await createClient();
  const p = await parent(supabase, parentId);
  if (!p) return { ok: false, error: "Parent property not found." };
  const allowed = addableChildConfigs(p.configuration as string | null);
  if (!allowed.includes(configuration)) {
    return { ok: false, error: `A ${p.configuration ?? "property"} can't contain a ${configuration}.` };
  }

  const { error } = await supabase.from("property").insert(childRow(p, parentId, configuration, label.trim()));
  if (error) return { ok: false, error: error.message };
  await logActivity({ type: `${configuration} Created`, objectTable: "property", objectId: parentId, creatorId: user.id });
  revalidatePath(`/properties/${parentId}`);
  revalidatePath("/properties");
  return { ok: true };
}

export async function addUnit(parentId: string, unitNumber: string): Promise<ActionResult> {
  return addChild(parentId, CONFIG_UNIT, unitNumber);
}

export async function autoGenerateUnits(
  parentId: string,
  count: number,
  prefix: string,
): Promise<ActionResult> {
  let user;
  try {
    user = await requirePermission("units", "create");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const n = Math.max(1, Math.min(100, Math.floor(count)));
  const supabase = await createClient();
  const p = await parent(supabase, parentId);
  if (!p) return { ok: false, error: "Parent property not found." };
  if (!addableChildConfigs(p.configuration as string | null).includes(CONFIG_UNIT)) {
    return { ok: false, error: `A ${p.configuration ?? "property"} cannot contain units.` };
  }

  const rows = Array.from({ length: n }, (_, i) => childRow(p, parentId, CONFIG_UNIT, `${prefix.trim()}${i + 1}`));
  const { error } = await supabase.from("property").insert(rows);
  if (error) return { ok: false, error: error.message };
  await logActivity({ type: "Units Generated", objectLabel: `${n} units`, objectTable: "property", objectId: parentId, creatorId: user.id });
  revalidatePath(`/properties/${parentId}`);
  revalidatePath("/properties");
  return { ok: true };
}

export async function deleteUnit(unitId: string, parentId: string): Promise<ActionResult> {
  try {
    await requirePermission("units", "delete");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const supabase = await createClient();

  // Don't orphan a sub-building's own children.
  const { count } = await supabase
    .from("property")
    .select("id", { count: "exact", head: true })
    .eq("parent_property_id", unitId);
  if (count && count > 0) {
    return { ok: false, error: `This contains ${count} ${count === 1 ? "property" : "properties"} — delete or move them first.` };
  }

  const { error } = await supabase.from("property").delete().eq("id", unitId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/properties/${parentId}`);
  revalidatePath("/properties");
  return { ok: true };
}
