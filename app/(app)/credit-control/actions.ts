"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth";
import { logActivity } from "@/lib/data/activity";

export type ActionResult = { ok: true } | { ok: false; error: string };

/** Turn automated arrears chasing on/off for one tenancy (the WS14 off-switch). */
export async function setChasing(leaseId: string, enabled: boolean): Promise<ActionResult> {
  let user;
  try {
    user = await requirePermission("finance", "edit");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("lease").update({ chasing_enabled: enabled }).eq("id", leaseId);
  if (error) return { ok: false, error: error.message };

  await logActivity({
    type: enabled ? "Chasing Enabled" : "Chasing Paused",
    objectTable: "lease",
    objectId: leaseId,
    creatorId: user.id,
  });
  revalidatePath("/credit-control");
  return { ok: true };
}
