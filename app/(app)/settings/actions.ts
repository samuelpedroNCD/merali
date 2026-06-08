"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";

export type ActionResult = { ok: true } | { ok: false; error: string };

const ProfileSchema = z.object({
  first_name: z.string().trim().nullable().optional(),
  last_name: z.string().trim().nullable().optional(),
  phone: z.string().trim().nullable().optional(),
});

export async function updateProfile(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = ProfileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid profile data." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("staff_user")
    .update({
      first_name: parsed.data.first_name || null,
      last_name: parsed.data.last_name || null,
      phone: parsed.data.phone || null,
    })
    .eq("id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings");
  revalidatePath("/", "layout");
  return { ok: true };
}

const PrefsSchema = z.object({
  notify_email: z.boolean(),
  notify_certifications: z.boolean(),
  notify_renewals: z.boolean(),
  notify_overdue: z.boolean(),
  notify_ending: z.boolean(),
});

export async function updateNotificationPrefs(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = PrefsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid notification settings." };

  const supabase = await createClient();
  const { error } = await supabase.from("staff_user").update(parsed.data).eq("id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings");
  return { ok: true };
}

export async function changePassword(password: string): Promise<ActionResult> {
  await requireUser();
  if (!password || password.length < 8)
    return { ok: false, error: "Password must be at least 8 characters." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function updateAvatar(url: string): Promise<ActionResult> {
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("staff_user")
    .update({ profile_picture: url || null })
    .eq("id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings");
  revalidatePath("/", "layout");
  return { ok: true };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function changeEmail(email: string): Promise<ActionResult> {
  await requireUser();
  if (!EMAIL_RE.test(email.trim()))
    return { ok: false, error: "Enter a valid email address." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ email });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
