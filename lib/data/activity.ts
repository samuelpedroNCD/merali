import { createClient } from "@/lib/supabase/server";

/** Write an activity-log entry. Best-effort; never throws to the caller. */
export async function logActivity(opts: {
  type: string;
  objectLabel?: string | null;
  objectTable?: string | null;
  objectId?: string | null;
  creatorId?: string | null;
}) {
  try {
    const supabase = await createClient();
    await supabase.from("activity_log").insert({
      type: opts.type,
      object_label: opts.objectLabel ?? null,
      object_table: opts.objectTable ?? null,
      object_id: opts.objectId ?? null,
      creator_id: opts.creatorId ?? null,
    });
  } catch {
    /* logging must not break the mutation */
  }
}
