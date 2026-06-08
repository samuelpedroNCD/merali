import { createClient } from "@/lib/supabase/server";

export type NotificationRow = {
  id: string;
  type: string | null;
  message: string | null;
  trigger_source: string | null;
  read_at: string | null;
  created_at: string;
};

export async function listNotifications(staffId: string): Promise<NotificationRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notification")
    .select("id, type, message, trigger_source, read_at, created_at")
    .eq("to_staff_id", staffId)
    .order("created_at", { ascending: false })
    .limit(100);
  return (data ?? []) as unknown as NotificationRow[];
}

export async function unreadCount(staffId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("notification")
    .select("*", { count: "exact", head: true })
    .eq("to_staff_id", staffId)
    .is("read_at", null);
  return count ?? 0;
}
