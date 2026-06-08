import { createClient } from "@/lib/supabase/server";

export type MaintenanceRow = {
  id: string;
  description: string | null;
  status: string | null;
  urgency: string | null;
  type: string | null;
  property_id: string | null;
  planned_date: string | null;
  completion_date: string | null;
  assigned_staff_id: string | null;
  supplier_id: string | null;
  cost: number | null;
  response_time: string | null;
  resolution_time: string | null;
  notes: string | null;
  property?: { address: string | null } | null;
  supplier?: { business_name: string | null } | null;
  staff?: { full_name: string | null } | null;
};

export { MAINTENANCE_STATUSES } from "@/lib/maintenance-statuses";

export type CommentRow = {
  id: string;
  message: string | null;
  created_at: string;
  author: string | null;
};

export async function listComments(maintenanceId: string): Promise<CommentRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("maintenance_comment")
    .select("id, message, created_at, author:author_id(full_name)")
    .eq("maintenance_id", maintenanceId)
    .order("created_at", { ascending: true });
  return (data ?? []).map((c) => {
    const a = c.author as { full_name?: string } | { full_name?: string }[] | null;
    return {
      id: c.id as string,
      message: (c.message as string) ?? null,
      created_at: c.created_at as string,
      author: (Array.isArray(a) ? a[0]?.full_name : a?.full_name) ?? null,
    };
  });
}

export async function listMaintenance(): Promise<MaintenanceRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("maintenance")
    .select(
      "*, property:property_id(address), supplier:supplier_id(business_name), staff:assigned_staff_id(full_name)",
    )
    .order("created_at", { ascending: false });
  return (data ?? []) as unknown as MaintenanceRow[];
}
