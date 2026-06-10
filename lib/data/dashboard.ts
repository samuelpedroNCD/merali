import { createClient } from "@/lib/supabase/server";
import { LEASABLE_CONFIGS } from "@/lib/property-config";

export type DashboardData = {
  totalProperties: number;
  newPropertiesThisMonth: number;
  occupancyRate: number;
  vacantUnits: number;
  openMaintenance: number;
  urgentMaintenance: number;
  rentCollectedThisMonth: number;
  rentDueThisMonth: number;
  rentCollectedPct: number;
  arrearsTotal: number;
  arrearsTenants: number;
  unprotectedDeposits: number;
  unprotectedDepositTotal: number;
  rentBars: { label: string; value: number; current?: boolean }[];
  activity: { type: string; label: string | null; at: string; who: string | null }[];
  certs: { name: string; property: string | null; due: string | null }[];
  renewals: { tenant: string | null; property: string | null; end: string | null }[];
};

function monthRange(year: number, month: number) {
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 1));
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export async function getDashboardData(now = new Date()): Promise<DashboardData> {
  const supabase = await createClient();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const thisMonth = monthRange(y, m);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const countOf = async (table: string, build?: (q: any) => any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = supabase.from(table).select("*", { count: "exact", head: true });
    if (build) q = build(q);
    const { count } = await q;
    return count ?? 0;
  };

  const [
    totalProperties,
    newPropertiesThisMonth,
    leasableCount,
    occupiedCount,
    openMaintenance,
    urgentMaintenance,
  ] = await Promise.all([
    countOf("property", (q) => q.is("parent_property_id", null)),
    countOf("property", (q) =>
      q.is("parent_property_id", null).gte("created_at", thisMonth.start),
    ),
    // Leasable leaves (Units + Standalone Properties) — the denominator for occupancy.
    countOf("property", (q) => q.in("configuration", LEASABLE_CONFIGS as unknown as string[])),
    // distinct active-lease properties (approx: count active leases)
    countOf("lease", (q) => q.eq("status", "Active")),
    countOf("maintenance", (q) => q.neq("status", "Completed")),
    countOf("maintenance", (q) =>
      q.neq("status", "Completed").in("urgency", ["High", "Emergency"]),
    ),
  ]);

  const occupancyRate =
    leasableCount > 0
      ? Math.min(100, Math.round((occupiedCount / leasableCount) * 100))
      : 0;
  const vacantUnits = Math.max(0, leasableCount - occupiedCount);

  // Rent this month
  const { data: thisMonthSched } = await supabase
    .from("rent_schedule")
    .select("amount_due, amount_collected")
    .gte("due_date", thisMonth.start)
    .lt("due_date", thisMonth.end);
  const rentDueThisMonth = (thisMonthSched ?? []).reduce(
    (a, r) => a + Number(r.amount_due ?? 0),
    0,
  );
  const rentCollectedThisMonth = (thisMonthSched ?? []).reduce(
    (a, r) => a + Number(r.amount_collected ?? 0),
    0,
  );
  const rentCollectedPct =
    rentDueThisMonth > 0
      ? Math.round((rentCollectedThisMonth / rentDueThisMonth) * 100)
      : 0;

  // Arrears: overdue unpaid rent across all schedules.
  const todayStr = now.toISOString().slice(0, 10);
  const { data: overdueRows } = await supabase
    .from("rent_schedule")
    .select("amount_due, amount_collected, tenant_id, invoice_status, due_date")
    .neq("invoice_status", "Paid")
    .lt("due_date", todayStr);
  let arrearsTotal = 0;
  const arrearsTenantSet = new Set<string>();
  for (const r of overdueRows ?? []) {
    arrearsTotal += Number(r.amount_due ?? 0) - Number(r.amount_collected ?? 0);
    if (r.tenant_id) arrearsTenantSet.add(r.tenant_id as string);
  }

  // Deposits taken but not yet protected (and not returned) on a live tenancy.
  const { data: depRows } = await supabase
    .from("lease")
    .select("deposit_amount, deposit_protected_date, deposit_returned_date, status")
    .gt("deposit_amount", 0)
    .is("deposit_protected_date", null)
    .is("deposit_returned_date", null);
  let unprotectedDeposits = 0;
  let unprotectedDepositTotal = 0;
  for (const r of depRows ?? []) {
    const st = (r.status as string | null)?.toLowerCase() ?? "";
    if (st === "ended" || st === "terminated" || st === "expired") continue;
    unprotectedDeposits += 1;
    unprotectedDepositTotal += Number(r.deposit_amount ?? 0);
  }

  // Rent bars: collected % per month for the last 6 months
  const sixStart = monthRange(y, m - 5).start;
  const { data: recentSched } = await supabase
    .from("rent_schedule")
    .select("due_date, amount_due, amount_collected")
    .gte("due_date", sixStart)
    .lt("due_date", thisMonth.end);
  const bars: { label: string; value: number; current?: boolean }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - i, 1));
    const r = monthRange(d.getUTCFullYear(), d.getUTCMonth());
    const rows = (recentSched ?? []).filter(
      (s) => s.due_date >= r.start && s.due_date < r.end,
    );
    const due = rows.reduce((a, s) => a + Number(s.amount_due ?? 0), 0);
    const got = rows.reduce((a, s) => a + Number(s.amount_collected ?? 0), 0);
    bars.push({
      label: d.toLocaleString("en-GB", { month: "short" }),
      value: due > 0 ? Math.round((got / due) * 100) : 0,
      current: i === 0,
    });
  }

  // Recent activity
  const { data: acts } = await supabase
    .from("activity_log")
    .select("type, object_label, created_at, creator:creator_id(full_name)")
    .order("created_at", { ascending: false })
    .limit(6);
  const activity = (acts ?? []).map((a) => {
    const creatorRel = a.creator as { full_name?: string } | { full_name?: string }[] | null;
    const who = Array.isArray(creatorRel)
      ? creatorRel[0]?.full_name ?? null
      : creatorRel?.full_name ?? null;
    return {
      type: a.type as string,
      label: (a.object_label as string) ?? null,
      at: a.created_at as string,
      who,
    };
  });

  // Certifications expiring soon (within 30 days as a default window)
  const horizon = new Date(now);
  horizon.setUTCDate(horizon.getUTCDate() + 30);
  const { data: certRows } = await supabase
    .from("certification")
    .select("expiry_date, type:type_id(name), property:property_id(address)")
    .not("expiry_date", "is", null)
    .lte("expiry_date", horizon.toISOString().slice(0, 10))
    .order("expiry_date", { ascending: true })
    .limit(6);
  const certs = (certRows ?? []).map((c) => {
    const t = c.type as { name?: string } | { name?: string }[] | null;
    const p = c.property as { address?: string } | { address?: string }[] | null;
    return {
      name: (Array.isArray(t) ? t[0]?.name : t?.name) ?? "Certification",
      property: (Array.isArray(p) ? p[0]?.address : p?.address) ?? null,
      due: (c.expiry_date as string) ?? null,
    };
  });

  // Lease renewals this month (by renewal_date or end_date)
  const { data: renewRows } = await supabase
    .from("lease")
    .select("end_date, renewal_date, tenant:tenant_id(full_name), property:property_id(address)")
    .or(
      `and(renewal_date.gte.${thisMonth.start},renewal_date.lt.${thisMonth.end}),and(end_date.gte.${thisMonth.start},end_date.lt.${thisMonth.end})`,
    )
    .limit(6);
  const renewals = (renewRows ?? []).map((l) => {
    const t = l.tenant as { full_name?: string } | { full_name?: string }[] | null;
    const p = l.property as { address?: string } | { address?: string }[] | null;
    return {
      tenant: (Array.isArray(t) ? t[0]?.full_name : t?.full_name) ?? null,
      property: (Array.isArray(p) ? p[0]?.address : p?.address) ?? null,
      end: (l.end_date as string) ?? (l.renewal_date as string) ?? null,
    };
  });

  return {
    totalProperties,
    newPropertiesThisMonth,
    occupancyRate,
    vacantUnits,
    openMaintenance,
    urgentMaintenance,
    rentCollectedThisMonth,
    rentDueThisMonth,
    rentCollectedPct,
    unprotectedDeposits,
    unprotectedDepositTotal,
    arrearsTotal,
    arrearsTenants: arrearsTenantSet.size,
    rentBars: bars,
    activity,
    certs,
    renewals,
  };
}
