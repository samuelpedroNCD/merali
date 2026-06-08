"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth";

export type ActionResult = { ok: true } | { ok: false; error: string };

const s = (v: unknown) => (v === "" || v === undefined ? null : v);

const Schema = z.object({
  utility_type: z.string().min(1, "Utility type is required."),
  supplier: z.preprocess(s, z.string().nullable()),
  meter_location: z.preprocess(s, z.string().nullable()),
  stop_tap_location: z.preprocess(s, z.string().nullable()),
  serial_number: z.preprocess(s, z.string().nullable()),
  notes: z.preprocess(s, z.string().nullable()),
});

export async function saveUtility(
  propertyId: string,
  utilityId: string | null,
  input: unknown,
): Promise<ActionResult> {
  try {
    await requirePermission("properties", "edit");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const parsed = Schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid utility." };

  const supabase = await createClient();
  const error = utilityId
    ? (await supabase.from("utility").update(parsed.data).eq("id", utilityId)).error
    : (await supabase.from("utility").insert({ ...parsed.data, property_id: propertyId })).error;
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/properties/${propertyId}`);
  return { ok: true };
}

export async function deleteUtility(propertyId: string, utilityId: string): Promise<ActionResult> {
  try {
    await requirePermission("properties", "edit");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("utility").delete().eq("id", utilityId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/properties/${propertyId}`);
  return { ok: true };
}
