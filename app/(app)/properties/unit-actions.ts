"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth";
import { logActivity } from "@/lib/data/activity";

export type ActionResult = { ok: true } | { ok: false; error: string };

async function parent(supabase: Awaited<ReturnType<typeof createClient>>, parentId: string) {
  const { data } = await supabase
    .from("property")
    .select("address, town, post_code, country, area, internal_code, landlord_id, configuration")
    .eq("id", parentId)
    .maybeSingle();
  return data;
}

function unitRow(p: Record<string, unknown>, parentId: string, number: string) {
  return {
    parent_property_id: parentId,
    configuration: "Unit",
    internal_code: number,
    flat: number,
    address: p.address ?? null,
    town: p.town ?? null,
    post_code: p.post_code ?? null,
    country: p.country ?? "United Kingdom",
    area: p.area ?? null,
    landlord_id: p.landlord_id ?? null,
    status: "Vacant",
  };
}

export async function addUnit(parentId: string, unitNumber: string): Promise<ActionResult> {
  let user;
  try {
    user = await requirePermission("units", "create");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  if (!unitNumber.trim()) return { ok: false, error: "Unit number is required." };
  const supabase = await createClient();
  const p = await parent(supabase, parentId);
  if (!p) return { ok: false, error: "Parent property not found." };
  if (p.configuration === "Unit") return { ok: false, error: "A unit cannot contain units." };

  const { error } = await supabase.from("property").insert(unitRow(p, parentId, unitNumber.trim()));
  if (error) return { ok: false, error: error.message };
  await logActivity({ type: "Unit Created", objectTable: "property", objectId: parentId, creatorId: user.id });
  revalidatePath(`/properties/${parentId}`);
  revalidatePath("/properties");
  return { ok: true };
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
  if (p.configuration === "Unit") return { ok: false, error: "A unit cannot contain units." };

  const rows = Array.from({ length: n }, (_, i) => unitRow(p, parentId, `${prefix.trim()}${i + 1}`));
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
  const { error } = await supabase.from("property").delete().eq("id", unitId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/properties/${parentId}`);
  return { ok: true };
}
