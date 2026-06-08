"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth";
import { logActivity } from "@/lib/data/activity";

const s = (v: unknown) => (v === "" || v === undefined ? null : v);

const Schema = z.object({
  content: z.preprocess(s, z.string().nullable()),
  alert_date: z.preprocess(s, z.string().nullable()),
  alert_time: z.preprocess(s, z.string().nullable()),
  recurrence: z.preprocess((v) => (v ? v : "None"), z.string()),
  recurrence_until: z.preprocess(s, z.string().nullable()),
  property_id: z.preprocess(s, z.string().uuid().nullable()),
  assignees: z.array(z.string().uuid()).default([]),
});

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

async function setAssignees(
  supabase: Awaited<ReturnType<typeof createClient>>,
  reminderId: string,
  ids: string[],
) {
  await supabase.from("reminder_assignee").delete().eq("reminder_id", reminderId);
  if (ids.length) {
    await supabase
      .from("reminder_assignee")
      .insert(ids.map((staff_id) => ({ reminder_id: reminderId, staff_id })));
  }
}

export async function createReminder(input: unknown): Promise<ActionResult> {
  let user;
  try {
    user = await requirePermission("reminders", "create");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const parsed = Schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid reminder data." };

  const supabase = await createClient();
  const { assignees, ...rest } = parsed.data;
  const { data, error } = await supabase
    .from("reminder")
    .insert({ ...rest, created_by: user.id, status: "Pending" })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  await setAssignees(supabase, data.id, assignees);
  await logActivity({
    type: "Reminder Created",
    objectTable: "reminder",
    objectId: data.id,
    creatorId: user.id,
  });
  revalidatePath("/reminders");
  return { ok: true, id: data.id };
}

export async function updateReminder(id: string, input: unknown): Promise<ActionResult> {
  try {
    await requirePermission("reminders", "edit");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const parsed = Schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid reminder data." };

  const supabase = await createClient();
  const { assignees, ...rest } = parsed.data;
  const { error } = await supabase.from("reminder").update(rest).eq("id", id);
  if (error) return { ok: false, error: error.message };
  await setAssignees(supabase, id, assignees);
  revalidatePath("/reminders");
  return { ok: true, id };
}

export async function deleteReminder(id: string): Promise<ActionResult> {
  let user;
  try {
    user = await requirePermission("reminders", "delete");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("reminder").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  await logActivity({
    type: "Reminder Deletion",
    objectTable: "reminder",
    objectId: id,
    creatorId: user.id,
  });
  revalidatePath("/reminders");
  return { ok: true };
}
