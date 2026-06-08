"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function addOptionValue(category: string, value: string): Promise<ActionResult> {
  try {
    await requirePermission("settings", "edit");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const v = value.trim();
  if (!v) return { ok: false, error: "Value is required." };

  const supabase = await createClient();
  const { data: max } = await supabase
    .from("option_set")
    .select("sort")
    .eq("category", category)
    .order("sort", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("option_set").insert({
    category,
    value: v,
    label: v,
    sort: (max?.sort ?? 0) + 1,
    active: true,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings");
  return { ok: true };
}

export async function renameOptionValue(id: string, label: string): Promise<ActionResult> {
  try {
    await requirePermission("settings", "edit");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("option_set")
    .update({ label: label.trim() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings");
  return { ok: true };
}

export async function setOptionActive(id: string, active: boolean): Promise<ActionResult> {
  try {
    await requirePermission("settings", "edit");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("option_set").update({ active }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings");
  return { ok: true };
}
