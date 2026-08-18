"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth";
import { logActivity } from "@/lib/data/activity";

const s = (v: unknown) => (v === "" || v === undefined ? null : v);

const Schema = z.object({
  account_name: z.preprocess(s, z.string().nullable()),
  code: z.preprocess(s, z.string().nullable()),
  short_ref: z.preprocess(s, z.string().nullable()),
  entity_id: z.preprocess(s, z.string().uuid().nullable()),
  active: z.preprocess((v) => v === true || v === "true", z.boolean()).default(true),
});

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

/** Ensure a bank has an Asset control nominal (cash-at-bank), creating one if needed. */
async function ensureControlNominal(
  supabase: Awaited<ReturnType<typeof createClient>>,
  bankId: string,
  name: string | null,
) {
  const { data: bank } = await supabase.from("bank_account").select("control_nominal_id").eq("id", bankId).maybeSingle();
  if (bank?.control_nominal_id) return;
  const code = `BANK-${bankId.slice(0, 8)}`;
  const { data: existing } = await supabase.from("nominal_code").select("id").eq("code", code).maybeSingle();
  let nominalId = existing?.id as string | undefined;
  if (!nominalId) {
    const { data: nom } = await supabase
      .from("nominal_code")
      .insert({ code, name: `Bank: ${name || "account"}`, type: "Both", class: "Asset", is_control: true, system_managed: true, sort: 800 })
      .select("id")
      .single();
    nominalId = nom?.id as string;
  }
  if (nominalId) await supabase.from("bank_account").update({ control_nominal_id: nominalId }).eq("id", bankId);
}

export async function createBankAccount(input: unknown): Promise<ActionResult> {
  let user;
  try {
    user = await requirePermission("finance", "edit");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const parsed = Schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid bank account data." };

  const supabase = await createClient();
  const { data, error } = await supabase.from("bank_account").insert(parsed.data).select("id").single();
  if (error) return { ok: false, error: error.message };
  await ensureControlNominal(supabase, data.id, parsed.data.account_name);

  await logActivity({ type: "Bank Account Created", objectLabel: parsed.data.account_name ?? parsed.data.code ?? "", objectTable: "bank_account", objectId: data.id, creatorId: user.id });
  revalidatePath("/bank-accounts");
  return { ok: true, id: data.id };
}

export async function updateBankAccount(id: string, input: unknown): Promise<ActionResult> {
  let user;
  try {
    user = await requirePermission("finance", "edit");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const parsed = Schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid bank account data." };

  const supabase = await createClient();
  const { error } = await supabase.from("bank_account").update(parsed.data).eq("id", id);
  if (error) return { ok: false, error: error.message };
  await ensureControlNominal(supabase, id, parsed.data.account_name);

  await logActivity({ type: "Bank Account Updated", objectTable: "bank_account", objectId: id, creatorId: user.id });
  revalidatePath("/bank-accounts");
  return { ok: true, id };
}
