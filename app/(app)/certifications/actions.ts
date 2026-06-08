"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth";
import { logActivity } from "@/lib/data/activity";

const s = (v: unknown) => (v === "" || v === undefined ? null : v);

const Schema = z.object({
  property_id: z.preprocess(s, z.string().uuid().nullable()),
  type_id: z.preprocess(s, z.string().uuid().nullable()),
  expiry_date: z.preprocess(s, z.string().nullable()),
  document_link: z.preprocess(s, z.string().nullable()),
  notes: z.preprocess(s, z.string().nullable()),
});

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

function withExpiry(d: z.infer<typeof Schema>) {
  const expired = d.expiry_date
    ? d.expiry_date < new Date().toISOString().slice(0, 10)
    : false;
  return { ...d, is_expired: expired };
}

export async function createCertification(input: unknown): Promise<ActionResult> {
  let user;
  try {
    user = await requirePermission("certifications", "create");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const parsed = Schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid certification data." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("certification")
    .insert(withExpiry(parsed.data))
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  await logActivity({
    type: "Certification Created",
    objectTable: "certification",
    objectId: data.id,
    creatorId: user.id,
  });
  revalidatePath("/certifications");
  return { ok: true, id: data.id };
}

export async function updateCertification(id: string, input: unknown): Promise<ActionResult> {
  let user;
  try {
    user = await requirePermission("certifications", "edit");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const parsed = Schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid certification data." };

  const supabase = await createClient();
  const { error } = await supabase.from("certification").update(withExpiry(parsed.data)).eq("id", id);
  if (error) return { ok: false, error: error.message };

  await logActivity({
    type: "Certification Update",
    objectTable: "certification",
    objectId: id,
    creatorId: user.id,
  });
  revalidatePath("/certifications");
  return { ok: true, id };
}

export async function deleteCertification(id: string): Promise<ActionResult> {
  let user;
  try {
    user = await requirePermission("certifications", "delete");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("certification").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  await logActivity({
    type: "Certification Deletion",
    objectTable: "certification",
    objectId: id,
    creatorId: user.id,
  });
  revalidatePath("/certifications");
  return { ok: true };
}
