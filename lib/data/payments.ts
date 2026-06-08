import { createClient } from "@/lib/supabase/server";

export type RentScheduleRow = {
  id: string;
  lease_id: string;
  property_id: string | null;
  tenant_id: string | null;
  due_date: string;
  amount_due: number | null;
  amount_collected: number | null;
  invoice_status: string;
  reconciled: boolean;
  notes: string | null;
  property?: { address: string | null } | null;
  tenant?: { full_name: string | null } | null;
};

/** Effective status: anything unpaid past its due date is Overdue. */
export function effectiveStatus(r: RentScheduleRow, today = new Date()): string {
  if (r.invoice_status === "Paid") return "Paid";
  const collected = Number(r.amount_collected ?? 0);
  const due = Number(r.amount_due ?? 0);
  if (collected > 0 && collected < due) return "Partial";
  const overdue = r.due_date < today.toISOString().slice(0, 10);
  return overdue ? "Overdue" : "Pending";
}

export async function listRentSchedule(): Promise<RentScheduleRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("rent_schedule")
    .select(
      "id, lease_id, property_id, tenant_id, due_date, amount_due, amount_collected, invoice_status, reconciled, notes, property:property_id(address), tenant:tenant_id(full_name)",
    )
    .order("due_date", { ascending: true })
    .limit(1000);
  return (data ?? []) as unknown as RentScheduleRow[];
}
