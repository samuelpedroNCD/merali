"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requirePermission, requireUser } from "@/lib/auth";
import { logActivity } from "@/lib/data/activity";
import { listComments, type CommentRow } from "@/lib/data/maintenance";

export async function fetchComments(maintenanceId: string): Promise<CommentRow[]> {
  await requireUser();
  return listComments(maintenanceId);
}

export async function addComment(
  maintenanceId: string,
  message: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  let user;
  try {
    user = await requirePermission("maintenance", "edit");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  if (!message.trim()) return { ok: false, error: "Comment is empty." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("maintenance_comment")
    .insert({ maintenance_id: maintenanceId, author_id: user.id, message: message.trim() });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/maintenance");
  return { ok: true };
}

const s = (v: unknown) => (v === "" || v === undefined ? null : v);
const num = (v: unknown) => (v === "" || v == null ? null : Number(v));

const Schema = z.object({
  description: z.preprocess(s, z.string().nullable()),
  status: z.preprocess(s, z.string().nullable()),
  urgency: z.preprocess(s, z.string().nullable()),
  type: z.preprocess(s, z.string().nullable()),
  property_id: z.preprocess(s, z.string().uuid().nullable()),
  planned_date: z.preprocess(s, z.string().nullable()),
  completion_date: z.preprocess(s, z.string().nullable()),
  assigned_staff_id: z.preprocess(s, z.string().uuid().nullable()),
  supplier_id: z.preprocess(s, z.string().uuid().nullable()),
  cost: z.preprocess(num, z.number().nullable()),
  response_time: z.preprocess(s, z.string().nullable()),
  resolution_time: z.preprocess(s, z.string().nullable()),
  notes: z.preprocess(s, z.string().nullable()),
});

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

export async function createMaintenance(input: unknown): Promise<ActionResult> {
  let user;
  try {
    user = await requirePermission("maintenance", "create");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const parsed = Schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid maintenance data." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("maintenance")
    .insert({ ...parsed.data, submitted_by: user.id })
    .select("id, description")
    .single();
  if (error) return { ok: false, error: error.message };

  await logActivity({
    type: "Maintenance Created",
    objectLabel: data.description,
    objectTable: "maintenance",
    objectId: data.id,
    creatorId: user.id,
  });
  revalidatePath("/maintenance");
  return { ok: true, id: data.id };
}

export async function updateMaintenance(id: string, input: unknown): Promise<ActionResult> {
  let user;
  try {
    user = await requirePermission("maintenance", "edit");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const parsed = Schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid maintenance data." };

  const supabase = await createClient();
  const { error } = await supabase.from("maintenance").update(parsed.data).eq("id", id);
  if (error) return { ok: false, error: error.message };

  await logActivity({
    type: "Maintenance Update",
    objectTable: "maintenance",
    objectId: id,
    creatorId: user.id,
  });
  revalidatePath("/maintenance");
  return { ok: true, id };
}

export async function setMaintenanceStatus(id: string, status: string): Promise<ActionResult> {
  try {
    await requirePermission("maintenance", "edit");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const supabase = await createClient();
  const patch: Record<string, unknown> = { status };
  if (status === "Completed") patch.completion_date = new Date().toISOString().slice(0, 10);
  const { error } = await supabase.from("maintenance").update(patch).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/maintenance");
  return { ok: true, id };
}

export async function deleteMaintenance(id: string): Promise<ActionResult> {
  let user;
  try {
    user = await requirePermission("maintenance", "delete");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("maintenance").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  await logActivity({
    type: "Maintenance Deletion",
    objectTable: "maintenance",
    objectId: id,
    creatorId: user.id,
  });
  revalidatePath("/maintenance");
  return { ok: true };
}
