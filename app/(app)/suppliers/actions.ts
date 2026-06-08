"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth";
import { logActivity } from "@/lib/data/activity";

const s = (v: unknown) => (v === "" || v === undefined ? null : v);

const Schema = z.object({
  business_name: z.string().min(1, "Business name is required"),
  primary_contact_name: z.preprocess(s, z.string().nullable()),
  primary_contact_email: z.preprocess(s, z.string().nullable()),
  type: z.preprocess(s, z.string().nullable()),
  status: z.preprocess(s, z.string().nullable()),
  outstanding: z.preprocess(
    (v) => (v === "" || v == null ? null : Number(v)),
    z.number().nullable(),
  ),
  preferred: z.preprocess((v) => v === "true" || v === true, z.boolean()),
  notes: z.preprocess(s, z.string().nullable()),
});

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

export async function createSupplier(input: unknown): Promise<ActionResult> {
  let user;
  try {
    user = await requirePermission("suppliers", "create");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const parsed = Schema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid data." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("supplier")
    .insert(parsed.data)
    .select("id, business_name")
    .single();
  if (error) return { ok: false, error: error.message };

  await logActivity({
    type: "Supplier Creation",
    objectLabel: data.business_name,
    objectTable: "supplier",
    objectId: data.id,
    creatorId: user.id,
  });
  revalidatePath("/suppliers");
  return { ok: true, id: data.id };
}

export async function updateSupplier(id: string, input: unknown): Promise<ActionResult> {
  let user;
  try {
    user = await requirePermission("suppliers", "edit");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const parsed = Schema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid data." };

  const supabase = await createClient();
  const { error } = await supabase.from("supplier").update(parsed.data).eq("id", id);
  if (error) return { ok: false, error: error.message };

  await logActivity({
    type: "Supplier Update",
    objectTable: "supplier",
    objectId: id,
    creatorId: user.id,
  });
  revalidatePath("/suppliers");
  return { ok: true, id };
}

export async function deleteSupplier(id: string): Promise<ActionResult> {
  let user;
  try {
    user = await requirePermission("suppliers", "delete");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("supplier").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  await logActivity({
    type: "Supplier Deletion",
    objectTable: "supplier",
    objectId: id,
    creatorId: user.id,
  });
  revalidatePath("/suppliers");
  return { ok: true };
}
