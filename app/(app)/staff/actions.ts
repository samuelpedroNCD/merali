"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requirePermission } from "@/lib/auth";
import { logActivity } from "@/lib/data/activity";

const s = (v: unknown) => (v === "" || v === undefined ? null : v);

const Schema = z.object({
  first_name: z.preprocess(s, z.string().nullable()),
  last_name: z.preprocess(s, z.string().nullable()),
  email: z.string().email("Valid email required"),
  phone: z.preprocess(s, z.string().nullable()),
  role_id: z.preprocess(s, z.string().uuid().nullable()),
  bio: z.preprocess(s, z.string().nullable()),
});

export type InviteResult =
  | { ok: true; id: string; tempPassword?: string }
  | { ok: false; error: string };
export type ActionResult = { ok: true } | { ok: false; error: string };

function tempPassword() {
  // Readable temporary password the admin can share.
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let p = "";
  for (let i = 0; i < 5; i++) p += chars[Math.floor(((Date.now() >> i) % chars.length))];
  return `Merali-${p}${(Date.now() % 1000).toString().padStart(3, "0")}!`;
}

const fullName = (d: z.infer<typeof Schema>) =>
  [d.first_name, d.last_name].filter(Boolean).join(" ").trim() || d.email;

/** Invite a new staff member: create the auth user + profile. */
export async function inviteStaff(input: unknown): Promise<InviteResult> {
  let actor;
  try {
    actor = await requirePermission("staff", "create");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const parsed = Schema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid data." };

  let admin;
  try {
    admin = createServiceClient();
  } catch {
    return { ok: false, error: "Service role key not configured." };
  }

  const pw = tempPassword();
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: pw,
    email_confirm: true,
    user_metadata: { full_name: fullName(parsed.data) },
  });
  if (createErr) return { ok: false, error: createErr.message };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("staff_user")
    .insert({
      user_id: created.user.id,
      email: parsed.data.email,
      first_name: parsed.data.first_name,
      last_name: parsed.data.last_name,
      phone: parsed.data.phone,
      role_id: parsed.data.role_id,
      bio: parsed.data.bio,
      is_active: true,
    })
    .select("id")
    .single();
  if (error) {
    // roll back the auth user if the profile failed
    await admin.auth.admin.deleteUser(created.user.id);
    return { ok: false, error: error.message };
  }

  await logActivity({
    type: "Staff Invited",
    objectLabel: parsed.data.email,
    objectTable: "staff_user",
    objectId: data.id,
    creatorId: actor.id,
  });
  revalidatePath("/staff");
  return { ok: true, id: data.id, tempPassword: pw };
}

export async function updateStaff(id: string, input: unknown): Promise<ActionResult> {
  try {
    await requirePermission("staff", "edit");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const parsed = Schema.partial({ email: true }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid data." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("staff_user")
    .update({
      first_name: parsed.data.first_name ?? null,
      last_name: parsed.data.last_name ?? null,
      phone: parsed.data.phone ?? null,
      role_id: parsed.data.role_id ?? null,
      bio: parsed.data.bio ?? null,
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/staff");
  return { ok: true };
}

export async function setStaffActive(id: string, active: boolean): Promise<ActionResult> {
  try {
    await requirePermission("staff", "edit");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("staff_user").update({ is_active: active }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/staff");
  return { ok: true };
}
