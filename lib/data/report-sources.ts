import { createClient } from "@/lib/supabase/server";

export type ReportField = { key: string; label: string };
export type ReportFilters = {
  dateFrom?: string;
  dateTo?: string;
  property_id?: string;
  status?: string;
  search?: string;
};
export type ReportSourceDef = {
  key: string;
  label: string;
  fields: ReportField[];
  hasDate: boolean;
  hasProperty: boolean;
  run: (filters: ReportFilters) => Promise<Record<string, unknown>[]>;
};

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);
const addr = (p: unknown) => (one(p as { address?: string }) ?? {}).address ?? null;

async function sb() {
  return createClient();
}

// ---- TRANSACTIONS -------------------------------------------------------
async function runTransactions(f: ReportFilters) {
  const supabase = await sb();
  let q = supabase
    .from("transaction")
    .select("txn_date, type, category, amount_net, vat_amount, amount_gross, status, reference, property:property_id(address), nominal:nominal_code_id(code, name)")
    .order("txn_date", { ascending: false })
    .limit(5000);
  if (f.dateFrom) q = q.gte("txn_date", f.dateFrom);
  if (f.dateTo) q = q.lte("txn_date", f.dateTo);
  if (f.property_id) q = q.eq("property_id", f.property_id);
  if (f.status) q = q.eq("type", f.status); // status filter reused for type on this source
  const { data } = await q;
  return (data ?? []).map((t) => {
    const n = one(t.nominal as { code?: string; name?: string });
    return {
      date: t.txn_date, type: t.type, category: t.category,
      nominal: n ? `${n.code} ${n.name}` : "",
      property: addr(t.property),
      net: t.amount_net, vat: t.vat_amount, gross: t.amount_gross,
      status: t.status, reference: t.reference,
    };
  });
}

// ---- ARREARS (rent_schedule, past due unpaid) ---------------------------
async function runArrears(f: ReportFilters) {
  const supabase = await sb();
  const today = new Date().toISOString().slice(0, 10);
  let q = supabase
    .from("rent_schedule")
    .select("due_date, amount_due, amount_collected, invoice_status, tenant:tenant_id(full_name), property:property_id(address)")
    .neq("invoice_status", "Paid")
    .lt("due_date", f.dateTo || today)
    .order("due_date", { ascending: true })
    .limit(5000);
  if (f.dateFrom) q = q.gte("due_date", f.dateFrom);
  if (f.property_id) q = q.eq("property_id", f.property_id);
  const { data } = await q;
  return (data ?? []).map((r) => {
    const due = Number(r.amount_due ?? 0), col = Number(r.amount_collected ?? 0);
    return {
      tenant: (one(r.tenant as { full_name?: string }) ?? {}).full_name ?? null,
      property: addr(r.property),
      due_date: r.due_date, amount_due: due, collected: col, outstanding: due - col,
      status: r.invoice_status,
    };
  });
}

// ---- PROPERTIES / OCCUPANCY --------------------------------------------
async function runProperties(f: ReportFilters) {
  const supabase = await sb();
  let q = supabase
    .from("property")
    .select("address, internal_code, configuration, class, property_type, status, town, post_code, target_rent, landlord:landlord_id(full_name)")
    .order("address", { ascending: true })
    .limit(5000);
  if (f.property_id) q = q.eq("id", f.property_id);
  if (f.status) q = q.eq("status", f.status);
  if (f.search) q = q.or(`address.ilike.%${f.search}%,internal_code.ilike.%${f.search}%,post_code.ilike.%${f.search}%`);
  const { data } = await q;
  return (data ?? []).map((p) => ({
    address: p.address, internal_code: p.internal_code, configuration: p.configuration,
    class: p.class, type: p.property_type, status: p.status, town: p.town, post_code: p.post_code,
    target_rent: p.target_rent, landlord: (one(p.landlord as { full_name?: string }) ?? {}).full_name ?? null,
  }));
}

async function runOccupancy(f: ReportFilters) {
  const supabase = await sb();
  const today = new Date().toISOString().slice(0, 10);
  let propsQ = supabase.from("property").select("id, address, internal_code, configuration, status").neq("configuration", "Building").order("address").limit(5000);
  if (f.property_id) propsQ = propsQ.eq("id", f.property_id);
  const [{ data: props }, { data: leases }] = await Promise.all([
    propsQ,
    supabase.from("lease").select("property_id, end_date, status, tenant:tenant_id(full_name)").or(`end_date.is.null,end_date.gte.${today}`),
  ]);
  const active = new Map<string, { tenant: string | null; end: string | null }>();
  for (const l of leases ?? []) {
    if ((l.status ?? "").toLowerCase() === "ended" || (l.status ?? "").toLowerCase() === "terminated") continue;
    active.set(l.property_id as string, { tenant: (one(l.tenant as { full_name?: string }) ?? {}).full_name ?? null, end: (l.end_date as string) ?? null });
  }
  let rows = (props ?? []).map((p) => {
    const a = active.get(p.id as string);
    return {
      property: p.address || p.internal_code, configuration: p.configuration,
      occupancy: a ? "Occupied" : "Vacant",
      current_tenant: a?.tenant ?? "", lease_end: a?.end ?? "",
    };
  });
  if (f.status) rows = rows.filter((r) => r.occupancy.toLowerCase() === f.status!.toLowerCase());
  if (f.property_id) rows = rows; // occupancy is portfolio-wide; property filter not applied here
  return rows;
}

// ---- TENANCIES ----------------------------------------------------------
async function runTenancies(f: ReportFilters) {
  const supabase = await sb();
  let q = supabase
    .from("lease")
    .select("tenancy_code, start_date, end_date, rent_amount, payment_frequency, status, deposit_amount, deposit_scheme, property:property_id(address), lease_tenant(tenant:tenant_id(full_name))")
    .order("created_at", { ascending: false })
    .limit(5000);
  if (f.property_id) q = q.eq("property_id", f.property_id);
  if (f.status) q = q.eq("status", f.status);
  const { data } = await q;
  return (data ?? []).map((l) => {
    const tenants = ((l.lease_tenant ?? []) as { tenant: { full_name?: string } | { full_name?: string }[] | null }[])
      .map((x) => (one(x.tenant as { full_name?: string }) ?? {}).full_name).filter(Boolean).join(", ");
    return {
      code: l.tenancy_code, property: addr(l.property), tenants,
      start: l.start_date, end: l.end_date, rent: l.rent_amount, frequency: l.payment_frequency,
      status: l.status, deposit: l.deposit_amount, deposit_scheme: l.deposit_scheme,
    };
  });
}

// ---- MAINTENANCE --------------------------------------------------------
async function runMaintenance(f: ReportFilters) {
  const supabase = await sb();
  let q = supabase
    .from("maintenance")
    .select("description, status, urgency, planned_date, completion_date, cost, property:property_id(address), staff:assigned_staff_id(full_name), supplier:supplier_id(business_name)")
    .order("created_at", { ascending: false })
    .limit(5000);
  if (f.property_id) q = q.eq("property_id", f.property_id);
  if (f.status) q = q.eq("status", f.status);
  if (f.dateFrom) q = q.gte("planned_date", f.dateFrom);
  if (f.dateTo) q = q.lte("planned_date", f.dateTo);
  const { data } = await q;
  return (data ?? []).map((m) => ({
    property: addr(m.property), description: m.description, status: m.status, urgency: m.urgency,
    assigned: (one(m.staff as { full_name?: string }) ?? {}).full_name ?? null,
    supplier: (one(m.supplier as { business_name?: string }) ?? {}).business_name ?? null,
    cost: m.cost, planned: m.planned_date, completed: m.completion_date,
  }));
}

export const SOURCES: ReportSourceDef[] = [
  {
    key: "transactions", label: "Transactions (finance)", hasDate: true, hasProperty: true,
    fields: [
      { key: "date", label: "Date" }, { key: "type", label: "Type" }, { key: "category", label: "Category" },
      { key: "nominal", label: "Nominal" }, { key: "property", label: "Property" }, { key: "net", label: "Net" },
      { key: "vat", label: "VAT" }, { key: "gross", label: "Gross" }, { key: "status", label: "Status" }, { key: "reference", label: "Reference" },
    ],
    run: runTransactions,
  },
  {
    key: "arrears", label: "Rent arrears", hasDate: false, hasProperty: true,
    fields: [
      { key: "tenant", label: "Tenant" }, { key: "property", label: "Property" }, { key: "due_date", label: "Due date" },
      { key: "amount_due", label: "Amount due" }, { key: "collected", label: "Collected" }, { key: "outstanding", label: "Outstanding" }, { key: "status", label: "Status" },
    ],
    run: runArrears,
  },
  {
    key: "properties", label: "Properties (full report)", hasDate: false, hasProperty: true,
    fields: [
      { key: "address", label: "Address" }, { key: "internal_code", label: "Code" }, { key: "configuration", label: "Configuration" },
      { key: "class", label: "Class" }, { key: "type", label: "Type" }, { key: "status", label: "Status" },
      { key: "town", label: "Town" }, { key: "post_code", label: "Post code" }, { key: "target_rent", label: "Target rent" }, { key: "landlord", label: "Landlord" },
    ],
    run: runProperties,
  },
  {
    key: "occupancy", label: "Occupancy", hasDate: false, hasProperty: false,
    fields: [
      { key: "property", label: "Property" }, { key: "configuration", label: "Configuration" },
      { key: "occupancy", label: "Occupancy" }, { key: "current_tenant", label: "Current tenant" }, { key: "lease_end", label: "Lease end" },
    ],
    run: runOccupancy,
  },
  {
    key: "tenancies", label: "Tenancies", hasDate: false, hasProperty: true,
    fields: [
      { key: "code", label: "Code" }, { key: "property", label: "Property" }, { key: "tenants", label: "Tenants" },
      { key: "start", label: "Start" }, { key: "end", label: "End" }, { key: "rent", label: "Rent" }, { key: "frequency", label: "Frequency" },
      { key: "status", label: "Status" }, { key: "deposit", label: "Deposit" }, { key: "deposit_scheme", label: "Deposit scheme" },
    ],
    run: runTenancies,
  },
  {
    key: "maintenance", label: "Maintenance", hasDate: true, hasProperty: true,
    fields: [
      { key: "property", label: "Property" }, { key: "description", label: "Description" }, { key: "status", label: "Status" },
      { key: "urgency", label: "Urgency" }, { key: "assigned", label: "Assigned to" }, { key: "supplier", label: "Supplier" },
      { key: "cost", label: "Cost" }, { key: "planned", label: "Planned" }, { key: "completed", label: "Completed" },
    ],
    run: runMaintenance,
  },
];

export const SOURCE_META = SOURCES.map((s) => ({ key: s.key, label: s.label, fields: s.fields, hasDate: s.hasDate, hasProperty: s.hasProperty }));
export type SourceMeta = (typeof SOURCE_META)[number];

/** Run a report: returns header labels + rows (arrays) for the chosen fields. */
export async function runReport(
  sourceKey: string,
  fieldKeys: string[],
  filters: ReportFilters,
): Promise<{ header: string[]; rows: unknown[][] }> {
  const src = SOURCES.find((s) => s.key === sourceKey);
  if (!src) return { header: [], rows: [] };
  const fields = src.fields.filter((f) => fieldKeys.includes(f.key));
  const use = fields.length ? fields : src.fields;
  const data = await src.run(filters);
  const header = use.map((f) => f.label);
  const rows = data.map((row) => use.map((f) => row[f.key] ?? ""));
  return { header, rows };
}
