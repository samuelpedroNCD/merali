"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth";
import { logActivity } from "@/lib/data/activity";
import { computeVatFromGross } from "@/lib/finance/vat";

const s = (v: unknown) => (v === "" || v === undefined ? null : v);
const num = (v: unknown) => (v === "" || v == null ? null : Number(v));

const Schema = z.object({
  type: z.preprocess(s, z.string().nullable()),
  category: z.preprocess(s, z.string().nullable()),
  amount_gross: z.preprocess(num, z.number().nonnegative().nullable()),
  vat_rate: z.preprocess((v) => (v === "" || v == null ? 0 : Number(v)), z.number().min(0)),
  txn_date: z.preprocess(s, z.string().nullable()),
  property_id: z.preprocess(s, z.string().uuid().nullable()),
  nominal_code_id: z.preprocess(s, z.string().uuid().nullable()),
  status: z.preprocess(s, z.string().nullable()),
  reference: z.preprocess(s, z.string().nullable()),
  receipt_link: z.preprocess(s, z.string().nullable()),
  notes: z.preprocess(s, z.string().nullable()),
});

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

function buildRow(d: z.infer<typeof Schema>) {
  const gross = d.amount_gross ?? 0;
  const { net, vat } = computeVatFromGross(gross, d.vat_rate);
  return {
    type: d.type,
    category: d.category,
    amount_gross: gross,
    vat_rate: d.vat_rate,
    vat_amount: vat,
    amount_net: net,
    txn_date: d.txn_date,
    property_id: d.property_id,
    nominal_code_id: d.nominal_code_id,
    status: d.status,
    reference: d.reference,
    receipt_link: d.receipt_link,
    notes: d.notes,
    manual_entry: true,
  };
}

export async function createTransaction(input: unknown): Promise<ActionResult> {
  let user;
  try {
    user = await requirePermission("finance", "create");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const parsed = Schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid transaction data." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transaction")
    .insert(buildRow(parsed.data))
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  await logActivity({
    type: "Transaction Creation",
    objectLabel: `${parsed.data.type} · £${parsed.data.amount_gross}`,
    objectTable: "transaction",
    objectId: data.id,
    creatorId: user.id,
  });
  revalidatePath("/nominal");
  revalidatePath("/finances");
  return { ok: true, id: data.id };
}

export async function updateTransaction(id: string, input: unknown): Promise<ActionResult> {
  let user;
  try {
    user = await requirePermission("finance", "edit");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const parsed = Schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid transaction data." };

  const supabase = await createClient();
  const { error } = await supabase.from("transaction").update(buildRow(parsed.data)).eq("id", id);
  if (error) return { ok: false, error: error.message };

  await logActivity({
    type: "Transaction Update",
    objectTable: "transaction",
    objectId: id,
    creatorId: user.id,
  });
  revalidatePath("/nominal");
  revalidatePath("/finances");
  return { ok: true, id };
}

export async function deleteTransaction(id: string): Promise<ActionResult> {
  let user;
  try {
    user = await requirePermission("finance", "delete");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("transaction").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  await logActivity({
    type: "Transaction Deletion",
    objectTable: "transaction",
    objectId: id,
    creatorId: user.id,
  });
  revalidatePath("/nominal");
  revalidatePath("/finances");
  return { ok: true };
}
