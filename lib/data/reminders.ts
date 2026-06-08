import { createClient } from "@/lib/supabase/server";

export type ReminderRow = {
  id: string;
  content: string | null;
  alert_date: string | null;
  alert_time: string | null;
  status: string | null;
  sent: boolean | null;
  recurrence: string | null;
  recurrence_until: string | null;
  property_id: string | null;
  property_name: string | null;
  assignees: { id: string; name: string }[];
};

export async function listReminders(): Promise<ReminderRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("reminder")
    .select(
      "id, content, alert_date, alert_time, status, sent, recurrence, recurrence_until, property_id, property:property_id(address), reminder_assignee(staff:staff_id(id, full_name))",
    )
    .order("alert_date", { ascending: true });

  return (data ?? []).map((r) => {
    const ra = (r.reminder_assignee ?? []) as {
      staff: { id: string; full_name: string | null } | { id: string; full_name: string | null }[] | null;
    }[];
    const assignees = ra
      .map((x) => (Array.isArray(x.staff) ? x.staff[0] : x.staff))
      .filter(Boolean)
      .map((s) => ({ id: s!.id, name: s!.full_name ?? "" }));
    const prop = Array.isArray(r.property) ? r.property[0] : r.property;
    return {
      id: r.id as string,
      content: (r.content as string) ?? null,
      alert_date: (r.alert_date as string) ?? null,
      alert_time: (r.alert_time as string) ?? null,
      status: (r.status as string) ?? null,
      sent: (r.sent as boolean) ?? null,
      recurrence: (r.recurrence as string) ?? null,
      recurrence_until: (r.recurrence_until as string) ?? null,
      property_id: (r.property_id as string) ?? null,
      property_name: (prop?.address as string) ?? null,
      assignees,
    };
  });
}
