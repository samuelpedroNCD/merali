"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth";
import { logActivity } from "@/lib/data/activity";
import { encryptFields, LANDLORD_SECRET_FIELDS } from "@/lib/crypto/secrets";

const s = (v: unknown) => (v === "" || v === undefined ? null : v);

const Schema = z.object({
  landlord_type: z.preprocess(s, z.string().nullable()),
  entity_name: z.preprocess(s, z.string().nullable()),
  first_name: z.preprocess(s, z.string().nullable()),
  last_name: z.preprocess(s, z.string().nullable()),
  email: z.preprocess(s, z.string().nullable()),
  phone: z.preprocess(s, z.string().nullable()),
  preferred_contact: z.preprocess(s, z.string().nullable()),
  vat_number: z.preprocess(s, z.string().nullable()),
  company_registration_date: z.preprocess(s, z.string().nullable()),
  main_contact_name: z.preprocess(s, z.string().nullable()),
  main_contact_email: z.preprocess(s, z.string().nullable()),
  main_contact_phone: z.preprocess(s, z.string().nullable()),
  director_name: z.preprocess(s, z.string().nullable()),
  director_email: z.preprocess(s, z.string().nullable()),
  director_phone: z.preprocess(s, z.string().nullable()),
  trustee_name: z.preprocess(s, z.string().nullable()),
  trustee_email: z.preprocess(s, z.string().nullable()),
  trustee_phone: z.preprocess(s, z.string().nullable()),
  bank_account_name: z.preprocess(s, z.string().nullable()),
  bank_sort_code: z.preprocess(s, z.string().nullable()),
  bank_account_number: z.preprocess(s, z.string().nullable()),
  bank_name: z.preprocess(s, z.string().nullable()),
  bank_reference: z.preprocess(s, z.string().nullable()),
  notes: z.preprocess(s, z.string().nullable()),
});

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

const isIndividual = (t?: string | null) => !t || t.toLowerCase() === "individual";

function withFullName(data: z.infer<typeof Schema>) {
  // Company/trust landlords have a single entity name; individuals use first+last.
  const full = isIndividual(data.landlord_type)
    ? [data.first_name, data.last_name].filter(Boolean).join(" ").trim()
    : data.entity_name?.trim() || "";
  return { ...data, full_name: full || data.entity_name || "Unnamed landlord" };
}

export async function createLandlord(input: unknown): Promise<ActionResult> {
  let user;
  try {
    user = await requirePermission("landlords", "create");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const parsed = Schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid landlord data." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("landlord")
    .insert(encryptFields(withFullName(parsed.data), LANDLORD_SECRET_FIELDS))
    .select("id, full_name")
    .single();
  if (error) return { ok: false, error: error.message };

  await logActivity({
    type: "Landlord Creation",
    objectLabel: data.full_name,
    objectTable: "landlord",
    objectId: data.id,
    creatorId: user.id,
  });
  revalidatePath("/landlords");
  return { ok: true, id: data.id };
}

export async function updateLandlord(id: string, input: unknown): Promise<ActionResult> {
  let user;
  try {
    user = await requirePermission("landlords", "edit");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const parsed = Schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid landlord data." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("landlord")
    .update(encryptFields(withFullName(parsed.data), LANDLORD_SECRET_FIELDS))
    .eq("id", id)
    .select("id, full_name")
    .single();
  if (error) return { ok: false, error: error.message };

  await logActivity({
    type: "Landlord Update",
    objectLabel: data.full_name,
    objectTable: "landlord",
    objectId: id,
    creatorId: user.id,
  });
  revalidatePath("/landlords");
  return { ok: true, id };
}

export async function deleteLandlord(id: string): Promise<ActionResult> {
  let user;
  try {
    user = await requirePermission("landlords", "delete");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("landlord").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  await logActivity({
    type: "Landlord Deletion",
    objectTable: "landlord",
    objectId: id,
    creatorId: user.id,
  });
  revalidatePath("/landlords");
  return { ok: true };
}
