import { createClient } from "@/lib/supabase/server";

export type LogRow = {
  id: string;
  type: string;
  object_label: string | null;
  object_table: string | null;
  creator: string | null;
  created_at: string;
};

export async function listLogs(limit = 300): Promise<LogRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("activity_log")
    .select("id, type, object_label, object_table, created_at, creator:creator_id(full_name)")
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map((l) => {
    const c = l.creator as { full_name?: string } | { full_name?: string }[] | null;
    return {
      id: l.id as string,
      type: l.type as string,
      object_label: (l.object_label as string) ?? null,
      object_table: (l.object_table as string) ?? null,
      creator: (Array.isArray(c) ? c[0]?.full_name : c?.full_name) ?? null,
      created_at: l.created_at as string,
    };
  });
}
