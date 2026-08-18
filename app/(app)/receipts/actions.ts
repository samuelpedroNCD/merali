"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth";
import { logActivity } from "@/lib/data/activity";
import { getBatch } from "@/lib/data/receipt-batches";

const s = (v: unknown) => (v === "" || v === undefined ? null : v);
const num = (v: unknown) => (v === "" || v == null ? null : Number(v));

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

const CreateSchema = z.object({
  bank_account_id: z.preprocess(s, z.string().uuid()),
  expected_total: z.preprocess(num, z.number().nullable()),
  note: z.preprocess(s, z.string().nullable()),
});

export async function createBatch(input: unknown): Promise<ActionResult> {
  let user;
  try {
    user = await requirePermission("finance", "edit");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const parsed = CreateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Choose a bank account for the batch." };

  const supabase = await createClient();
  const { data: bank } = await supabase.from("bank_account").select("entity_id").eq("id", parsed.data.bank_account_id).maybeSingle();
  const { data, error } = await supabase
    .from("receipt_batch")
    .insert({ ...parsed.data, entity_id: bank?.entity_id ?? null, created_by: user.id })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  await logActivity({ type: "Receipt Batch Opened", objectTable: "receipt_batch", objectId: data.id, creatorId: user.id });
  revalidatePath("/receipts");
  return { ok: true, id: data.id };
}

async function assertDraft(supabase: Awaited<ReturnType<typeof createClient>>, batchId: string): Promise<string | null> {
  const { data } = await supabase.from("receipt_batch").select("status").eq("id", batchId).maybeSingle();
  if (!data) return "Batch not found.";
  if (data.status !== "draft") return "This batch is posted and can no longer be changed.";
  return null;
}

export async function addToBatch(batchId: string, txnId: string): Promise<ActionResult> {
  try {
    await requirePermission("finance", "edit");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const supabase = await createClient();
  const guard = await assertDraft(supabase, batchId);
  if (guard) return { ok: false, error: guard };
  const { error } = await supabase.from("transaction").update({ batch_id: batchId }).eq("id", txnId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/receipts/${batchId}`);
  return { ok: true };
}

export async function removeFromBatch(batchId: string, txnId: string): Promise<ActionResult> {
  try {
    await requirePermission("finance", "edit");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const supabase = await createClient();
  const guard = await assertDraft(supabase, batchId);
  if (guard) return { ok: false, error: guard };
  const { error } = await supabase.from("transaction").update({ batch_id: null }).eq("id", txnId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/receipts/${batchId}`);
  return { ok: true };
}

export async function setBatchExpected(id: string, expected: number | null): Promise<ActionResult> {
  try {
    await requirePermission("finance", "edit");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const supabase = await createClient();
  const guard = await assertDraft(supabase, id);
  if (guard) return { ok: false, error: guard };
  const { error } = await supabase.from("receipt_batch").update({ expected_total: expected }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/receipts/${id}`);
  return { ok: true };
}

export async function postBatch(id: string, override = false): Promise<ActionResult> {
  let user;
  try {
    user = await requirePermission("finance", "edit");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const supabase = await createClient();
  const batch = await getBatch(id);
  if (!batch) return { ok: false, error: "Batch not found." };
  if (batch.status !== "draft") return { ok: false, error: "This batch is already posted." };
  if (batch.count === 0) return { ok: false, error: "Add at least one receipt before posting." };
  if (batch.left_to_apply != null && batch.left_to_apply !== 0 && !override) {
    return { ok: false, error: `Batch doesn't match the expected total — £${batch.left_to_apply.toFixed(2)} left to apply.` };
  }

  const { error } = await supabase
    .from("receipt_batch")
    .update({ status: "posted", posted_at: new Date().toISOString(), posted_by: user.id })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  await logActivity({ type: "Receipt Batch Posted", objectTable: "receipt_batch", objectId: id, creatorId: user.id });
  revalidatePath("/receipts");
  revalidatePath(`/receipts/${id}`);
  return { ok: true };
}
