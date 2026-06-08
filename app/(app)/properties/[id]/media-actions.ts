"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth";
import { logActivity } from "@/lib/data/activity";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function addPhoto(
  propertyId: string,
  input: { url: string; path?: string; caption?: string },
): Promise<ActionResult> {
  let user;
  try {
    user = await requirePermission("properties", "edit");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  if (!input.url) return { ok: false, error: "No file uploaded." };
  const supabase = await createClient();
  const { error } = await supabase.from("property_photo").insert({
    property_id: propertyId,
    url: input.url,
    path: input.path ?? null,
    caption: input.caption || null,
    uploaded_by: user.id,
  });
  if (error) return { ok: false, error: error.message };
  await logActivity({ type: "Property Update", objectTable: "property", objectId: propertyId, objectLabel: "Photo added", creatorId: user.id });
  revalidatePath(`/properties/${propertyId}`);
  return { ok: true };
}

export async function deletePhoto(propertyId: string, photoId: string): Promise<ActionResult> {
  try {
    await requirePermission("properties", "edit");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("property_photo").delete().eq("id", photoId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/properties/${propertyId}`);
  return { ok: true };
}

const InspectionSchema = z.object({
  type: z.enum(["Move-in", "Move-out", "Routine"]),
  inspection_date: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  photos: z.array(z.string()).default([]),
});

export async function addInspection(propertyId: string, input: unknown): Promise<ActionResult> {
  let user;
  try {
    user = await requirePermission("properties", "edit");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const parsed = InspectionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid inspection data." };
  const supabase = await createClient();
  const { error } = await supabase.from("inspection").insert({
    property_id: propertyId,
    type: parsed.data.type,
    inspection_date: parsed.data.inspection_date || null,
    notes: parsed.data.notes || null,
    photos: parsed.data.photos,
    inspector_id: user.id,
  });
  if (error) return { ok: false, error: error.message };
  await logActivity({ type: "Property Update", objectTable: "property", objectId: propertyId, objectLabel: `${parsed.data.type} inspection`, creatorId: user.id });
  revalidatePath(`/properties/${propertyId}`);
  return { ok: true };
}

export async function deleteInspection(propertyId: string, inspectionId: string): Promise<ActionResult> {
  try {
    await requirePermission("properties", "edit");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("inspection").delete().eq("id", inspectionId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/properties/${propertyId}`);
  return { ok: true };
}
