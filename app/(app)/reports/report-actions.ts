"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";

export type ActionResult = { ok: true } | { ok: false; error: string };

const Schema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  source: z.string().min(1),
  fields: z.array(z.string()).default([]),
  filters: z.record(z.string(), z.unknown()).default({}),
});

export async function saveTemplate(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = Schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid template." };

  const supabase = await createClient();
  const { error } = await supabase.from("report_template").insert({
    name: parsed.data.name,
    source: parsed.data.source,
    fields: parsed.data.fields,
    filters: parsed.data.filters,
    created_by: user.id,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/reports");
  return { ok: true };
}

export async function deleteTemplate(id: string): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("report_template").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/reports");
  return { ok: true };
}
