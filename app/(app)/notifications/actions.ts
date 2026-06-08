"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";

export async function markRead(id: string) {
  const user = await requireUser();
  const supabase = await createClient();
  await supabase
    .from("notification")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("to_staff_id", user.id);
  revalidatePath("/notifications");
  revalidatePath("/", "layout");
  return { ok: true as const };
}

export async function markAllRead() {
  const user = await requireUser();
  const supabase = await createClient();
  await supabase
    .from("notification")
    .update({ read_at: new Date().toISOString() })
    .eq("to_staff_id", user.id)
    .is("read_at", null);
  revalidatePath("/notifications");
  revalidatePath("/", "layout");
  return { ok: true as const };
}

/** Manually run the notification triggers (admin convenience). */
export async function runNotificationTriggers() {
  await requireUser();
  const { createServiceClient } = await import("@/lib/supabase/service");
  const { runTriggers } = await import("@/lib/notifications/triggers");
  const result = await runTriggers(createServiceClient());
  revalidatePath("/notifications");
  return { ok: true as const, ...result };
}
