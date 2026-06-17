import { createClient } from "@/lib/supabase/server";

export type LeaseRow = {
  id: string;
  property_id: string | null;
  unit_id: string | null;
  tenant_id: string | null;
  tenancy_code: string | null;
  tenancy_class: string | null;
  start_date: string | null;
  end_date: string | null;
  move_in_date: string | null;
  renewal_date: string | null;
  rent_amount: number | null;
  payment_frequency: string | null;
  status: string | null;
  notes: string | null;
  rent_nominal_id: string | null;
  deposit_amount: number | null;
  deposit_scheme: string | null;
  deposit_reference: string | null;
  deposit_protected_date: string | null;
  deposit_returned_date: string | null;
  exclude_from_reminders: boolean | null;
  property?: { id: string; address: string | null } | null;
  tenant?: { id: string; full_name: string | null } | null;
  tenants: { id: string; name: string | null; is_lead: boolean }[];
  reviews: { effective_date: string; new_amount: number }[];
};

const SELECT =
  "*, property:property_id(id, address), tenant:tenant_id(id, full_name), lease_tenant(is_lead, tenant:tenant_id(id, full_name)), rent_review(effective_date, new_amount)";

function mapLease(row: Record<string, unknown>): LeaseRow {
  const lt = (row.lease_tenant ?? []) as {
    is_lead: boolean;
    tenant: { id: string; full_name: string | null } | { id: string; full_name: string | null }[] | null;
  }[];
  const tenants = lt
    .map((x) => {
      const t = Array.isArray(x.tenant) ? x.tenant[0] : x.tenant;
      return t ? { id: t.id, name: t.full_name, is_lead: x.is_lead } : null;
    })
    .filter(Boolean) as LeaseRow["tenants"];
  const reviews = ((row.rent_review ?? []) as { effective_date: string; new_amount: number }[])
    .map((r) => ({ effective_date: r.effective_date, new_amount: Number(r.new_amount) }))
    .sort((a, b) => a.effective_date.localeCompare(b.effective_date));
  const { lease_tenant, rent_review, ...rest } = row;
  void lease_tenant; void rent_review;
  return { ...(rest as unknown as LeaseRow), tenants, reviews };
}

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
    .select(SELECT)
    .eq("id", id)
    .maybeSingle();
  return data ? mapLease(data as Record<string, unknown>) : null;
}

export type LeaseTxnRow = {
  id: string;
  txn_date: string | null;
  type: string | null;
  category: string | null;
  amount_gross: number | null;
  status: string | null;
  nominal: string | null;
};

/** Transactions linked to a tenancy (its ledger). */
export async function getLeaseTransactions(id: string): Promise<LeaseTxnRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("transaction")
    .select("id, txn_date, type, category, amount_gross, status, nominal:nominal_code_id(code, name)")
    .eq("lease_id", id)
    .order("txn_date", { ascending: false })
    .limit(500);
  return (data ?? []).map((t) => {
    const n = (Array.isArray(t.nominal) ? t.nominal[0] : t.nominal) as { code?: string; name?: string } | null;
    return {
      id: t.id as string,
      txn_date: (t.txn_date as string) ?? null,
      type: (t.type as string) ?? null,
      category: (t.category as string) ?? null,
      amount_gross: t.amount_gross != null ? Number(t.amount_gross) : null,
      status: (t.status as string) ?? null,
      nominal: n ? `${n.code} ${n.name}` : null,
    };
  });
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

export type LeaseOption = { value: string; label: string; property_id: string | null; active: boolean };

/** Tenancies for a transaction's "Tenancy" picker (label = lead tenant · property). */
export async function listLeaseOptions(): Promise<LeaseOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("lease")
    .select("id, status, property_id, property:property_id(address), tenant:tenant_id(full_name), lease_tenant(is_lead, tenant:tenant_id(full_name))")
    .order("created_at", { ascending: false });
  const pick = (rel: unknown, key: string) => {
    const v = rel as Record<string, string> | Record<string, string>[] | null;
    return (Array.isArray(v) ? v[0]?.[key] : v?.[key]) ?? null;
  };
  return (data ?? []).map((l) => {
    const lts = (l.lease_tenant ?? []) as { is_lead: boolean; tenant: unknown }[];
    const lead = lts.find((x) => x.is_lead) ?? lts[0];
    const name = (lead ? pick(lead.tenant, "full_name") : null) || pick(l.tenant, "full_name") || "Tenancy";
    const addr = pick(l.property, "address");
    return {
      value: l.id as string,
      label: addr ? `${name} · ${addr}` : name,
      property_id: (l.property_id as string) ?? null,
      active: ((l.status as string) ?? "").toLowerCase() === "active",
    };
  });
}

export async function listLeases(): Promise<LeaseRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("lease")
    .select(SELECT)
    .order("created_at", { ascending: false });
  return (data ?? []).map((r) => mapLease(r as Record<string, unknown>));
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
