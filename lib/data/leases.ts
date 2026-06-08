import { createClient } from "@/lib/supabase/server";

export type LeaseRow = {
  id: string;
  property_id: string | null;
  unit_id: string | null;
  tenant_id: string | null;
  tenancy_code: string | null;
  start_date: string | null;
  end_date: string | null;
  move_in_date: string | null;
  renewal_date: string | null;
  rent_amount: number | null;
  payment_frequency: string | null;
  status: string | null;
  notes: string | null;
  property?: { id: string; address: string | null } | null;
  tenant?: { id: string; full_name: string | null } | null;
};

export type LeaseScheduleRow = {
  id: string;
  due_date: string;
  amount_due: number;
  amount_collected: number;
  invoice_status: string;
};

export async function getLease(id: string): Promise<LeaseRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("lease")
    .select("*, property:property_id(id, address), tenant:tenant_id(id, full_name)")
    .eq("id", id)
    .maybeSingle();
  return (data as unknown as LeaseRow) ?? null;
}

export async function getLeaseSchedule(id: string): Promise<LeaseScheduleRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("rent_schedule")
    .select("id, due_date, amount_due, amount_collected, invoice_status")
    .eq("lease_id", id)
    .order("due_date", { ascending: true });
  return (data ?? []) as unknown as LeaseScheduleRow[];
}

export async function listLeases(): Promise<LeaseRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("lease")
    .select(
      "*, property:property_id(id, address), tenant:tenant_id(id, full_name)",
    )
    .order("created_at", { ascending: false });
  return (data ?? []) as unknown as LeaseRow[];
}

/** Properties for lease selectors (label = address). */
export async function listPropertyOptions(): Promise<
  { value: string; label: string }[]
> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("property")
    .select("id, address, internal_code")
    .order("created_at", { ascending: false });
  return (data ?? []).map((p) => ({
    value: p.id,
    label: p.address || p.internal_code || "Untitled property",
  }));
}
