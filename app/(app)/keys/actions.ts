"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requirePermission, requireUser } from "@/lib/auth";
import { logActivity } from "@/lib/data/activity";
import { getKeyDetail, type KeyDetail } from "@/lib/data/keys";

export async function fetchKeyDetail(id: string): Promise<KeyDetail | null> {
  await requireUser();
  return getKeyDetail(id);
}

const s = (v: unknown) => (v === "" || v === undefined ? null : v);

const Schema = z.object({
  key_code: z.preprocess(s, z.string().nullable()),
  property_id: z.preprocess(s, z.string().uuid().nullable()),
  held_by_type: z.preprocess(s, z.string().nullable()),
  status: z.preprocess(s, z.string().nullable()),
  date_given: z.preprocess(s, z.string().nullable()),
  date_returned: z.preprocess(s, z.string().nullable()),
  reference_id: z.preprocess(s, z.string().nullable()),
  notes: z.preprocess(s, z.string().nullable()),
});

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

export async function createKey(input: unknown): Promise<ActionResult> {
  let user;
  try {
    user = await requirePermission("keys", "create");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const parsed = Schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid key data." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("key")
    .insert(parsed.data)
    .select("id, key_code")
    .single();
  if (error) return { ok: false, error: error.message };

  await logActivity({
    type: "Key Created",
    objectLabel: data.key_code,
    objectTable: "key",
    objectId: data.id,
    creatorId: user.id,
  });
  revalidatePath("/keys");
  return { ok: true, id: data.id };
}

export async function updateKey(id: string, input: unknown): Promise<ActionResult> {
  let user;
  try {
    user = await requirePermission("keys", "edit");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const parsed = Schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid key data." };

  const supabase = await createClient();
  const { error } = await supabase.from("key").update(parsed.data).eq("id", id);
  if (error) return { ok: false, error: error.message };

  await logActivity({
    type: "Key Updated",
    objectTable: "key",
    objectId: id,
    creatorId: user.id,
  });
  revalidatePath("/keys");
  return { ok: true, id };
}

export async function addSpare(keyId: string, reference: string): Promise<ActionResult> {
  try {
    await requirePermission("keys", "edit");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("key_spare")
    .insert({ key_id: keyId, reference: reference || null, status: "In Office" });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/keys");
  return { ok: true };
}

export async function updateSpare(
  spareId: string,
  input: { reference?: string },
): Promise<ActionResult> {
  try {
    await requirePermission("keys", "edit");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("key_spare")
    .update({ reference: input.reference || null })
    .eq("id", spareId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/keys");
  return { ok: true };
}

export async function deleteSpare(spareId: string): Promise<ActionResult> {
  try {
    await requirePermission("keys", "edit");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("key_spare").delete().eq("id", spareId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/keys");
  return { ok: true };
}

// ---------------------------------------------------------------------
// Issue / Return — write the key_log audit trail
// ---------------------------------------------------------------------
const today = () => new Date().toISOString().slice(0, 10);

const IssueSchema = z.object({
  held_by_type: z.preprocess(s, z.string().nullable()),
  holder: z.preprocess(s, z.string().nullable()),
  date_given: z.preprocess(s, z.string().nullable()),
  notes: z.preprocess(s, z.string().nullable()),
});
const ReturnSchema = z.object({
  date_returned: z.preprocess(s, z.string().nullable()),
  status_after: z.preprocess(s, z.string().nullable()),
  notes: z.preprocess(s, z.string().nullable()),
});

export async function issueKey(keyId: string, input: unknown): Promise<ActionResult> {
  let user;
  try {
    user = await requirePermission("keys", "edit");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const d = IssueSchema.safeParse(input);
  if (!d.success) return { ok: false, error: "Invalid issue data." };
  const supabase = await createClient();
  const when = d.data.date_given || today();

  const { data: key } = await supabase.from("key").select("property_id").eq("id", keyId).maybeSingle();
  await supabase
    .from("key")
    .update({ status: "Out", held_by_type: d.data.held_by_type, date_given: when, date_returned: null })
    .eq("id", keyId);
  const { error } = await supabase.from("key_log").insert({
    key_id: keyId,
    property_id: key?.property_id ?? null,
    action_out_when: when,
    holder: d.data.holder,
    held_by_type_snapshot: d.data.held_by_type,
    is_spare_snapshot: false,
    issued_by: user.id,
    is_open: true,
    notes: d.data.notes,
  });
  if (error) return { ok: false, error: error.message };

  await logActivity({ type: "Key Issued", objectTable: "key", objectId: keyId, creatorId: user.id });
  revalidatePath("/keys");
  return { ok: true };
}

export async function returnKey(keyId: string, input: unknown): Promise<ActionResult> {
  let user;
  try {
    user = await requirePermission("keys", "edit");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const d = ReturnSchema.safeParse(input);
  if (!d.success) return { ok: false, error: "Invalid return data." };
  const supabase = await createClient();
  const when = d.data.date_returned || today();
  const statusAfter = d.data.status_after || "In Office";

  await supabase.from("key").update({ status: statusAfter, date_returned: when }).eq("id", keyId);

  // Close the open issue row if present, else insert a closed record.
  const { data: open } = await supabase
    .from("key_log")
    .select("id")
    .eq("key_id", keyId)
    .is("spare_id", null)
    .eq("is_open", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (open) {
    await supabase
      .from("key_log")
      .update({
        action_in_when: when,
        received_by: user.id,
        status_after_return: statusAfter,
        is_open: false,
        notes: d.data.notes,
      })
      .eq("id", open.id);
  } else {
    const { data: key } = await supabase.from("key").select("property_id").eq("id", keyId).maybeSingle();
    await supabase.from("key_log").insert({
      key_id: keyId,
      property_id: key?.property_id ?? null,
      action_in_when: when,
      received_by: user.id,
      status_after_return: statusAfter,
      is_spare_snapshot: false,
      is_open: false,
      notes: d.data.notes,
    });
  }

  await logActivity({ type: "Key Returned", objectTable: "key", objectId: keyId, creatorId: user.id });
  revalidatePath("/keys");
  return { ok: true };
}

export async function issueSpare(
  keyId: string,
  spareId: string,
  input: unknown,
): Promise<ActionResult> {
  let user;
  try {
    user = await requirePermission("keys", "edit");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const d = IssueSchema.safeParse(input);
  if (!d.success) return { ok: false, error: "Invalid issue data." };
  const supabase = await createClient();
  const when = d.data.date_given || today();
  const { data: key } = await supabase.from("key").select("property_id").eq("id", keyId).maybeSingle();

  await supabase
    .from("key_spare")
    .update({ status: "Out", held_by_type: d.data.held_by_type, holder_name: d.data.holder, date_given: when, date_returned: null })
    .eq("id", spareId);
  const { error } = await supabase.from("key_log").insert({
    key_id: keyId,
    spare_id: spareId,
    property_id: key?.property_id ?? null,
    action_out_when: when,
    holder: d.data.holder,
    held_by_type_snapshot: d.data.held_by_type,
    is_spare_snapshot: true,
    issued_by: user.id,
    is_open: true,
    notes: d.data.notes,
  });
  if (error) return { ok: false, error: error.message };
  await logActivity({ type: "Spare Key Issued", objectTable: "key", objectId: keyId, creatorId: user.id });
  revalidatePath("/keys");
  return { ok: true };
}

export async function returnSpare(
  keyId: string,
  spareId: string,
  input: unknown,
): Promise<ActionResult> {
  let user;
  try {
    user = await requirePermission("keys", "edit");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const d = ReturnSchema.safeParse(input);
  if (!d.success) return { ok: false, error: "Invalid return data." };
  const supabase = await createClient();
  const when = d.data.date_returned || today();
  const statusAfter = d.data.status_after || "In Office";

  await supabase
    .from("key_spare")
    .update({ status: statusAfter, date_returned: when })
    .eq("id", spareId);

  const { data: open } = await supabase
    .from("key_log")
    .select("id")
    .eq("spare_id", spareId)
    .eq("is_open", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (open) {
    await supabase
      .from("key_log")
      .update({ action_in_when: when, received_by: user.id, status_after_return: statusAfter, is_open: false, notes: d.data.notes })
      .eq("id", open.id);
  } else {
    const { data: key } = await supabase.from("key").select("property_id").eq("id", keyId).maybeSingle();
    await supabase.from("key_log").insert({
      key_id: keyId,
      spare_id: spareId,
      property_id: key?.property_id ?? null,
      action_in_when: when,
      received_by: user.id,
      status_after_return: statusAfter,
      is_spare_snapshot: true,
      is_open: false,
      notes: d.data.notes,
    });
  }
  await logActivity({ type: "Spare Key Returned", objectTable: "key", objectId: keyId, creatorId: user.id });
  revalidatePath("/keys");
  return { ok: true };
}

export async function deleteKey(id: string): Promise<ActionResult> {
  let user;
  try {
    user = await requirePermission("keys", "delete");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("key").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  await logActivity({
    type: "Key Deletion",
    objectTable: "key",
    objectId: id,
    creatorId: user.id,
  });
  revalidatePath("/keys");
  return { ok: true };
}
