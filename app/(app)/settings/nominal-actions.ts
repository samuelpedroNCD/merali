"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth";

export type ActionResult = { ok: true } | { ok: false; error: string };

const Schema = z.object({
  code: z.string().trim().min(1, "Code is required."),
  name: z.string().trim().min(1, "Name is required."),
  type: z.enum(["Income", "Expense", "Both"]).default("Expense"),
});

export async function saveNominal(id: string | null, input: unknown): Promise<ActionResult> {
  try {
    await requirePermission("settings", "edit");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const parsed = Schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid nominal." };

  const supabase = await createClient();
  const error = id
    ? (await supabase.from("nominal_code").update(parsed.data).eq("id", id)).error
    : (await supabase.from("nominal_code").insert(parsed.data)).error;
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings");
  return { ok: true };
}

export async function setNominalActive(id: string, active: boolean): Promise<ActionResult> {
  try {
    await requirePermission("settings", "edit");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("nominal_code").update({ active }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings");
  return { ok: true };
}
