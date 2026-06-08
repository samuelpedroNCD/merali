import { createClient } from "@/lib/supabase/server";

export type TenantRelated = {
  leases: {
    id: string;
    property: string | null;
    propertyId: string | null;
    rent: number | null;
    start: string | null;
    end: string | null;
    status: string | null;
  }[];
  documents: { id: string; name: string; link: string; expiry: string | null }[];
  finance: { due: number; collected: number; arrears: number };
};

export async function getTenantRelated(tenantId: string): Promise<TenantRelated> {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const [leases, docs, sched] = await Promise.all([
    supabase
      .from("lease")
      .select("id, rent_amount, start_date, end_date, status, property:property_id(id, address)")
      .eq("tenant_id", tenantId)
      .order("start_date", { ascending: false }),
    supabase
      .from("document")
      .select("id, name, external_link, expiry_date")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false }),
    supabase
      .from("rent_schedule")
      .select("amount_due, amount_collected, invoice_status, due_date")
      .eq("tenant_id", tenantId),
  ]);

  const prop = (rel: unknown) => {
    const r = rel as { id?: string; address?: string } | { id?: string; address?: string }[] | null;
    return Array.isArray(r) ? r[0] : r;
  };

  let due = 0,
    collected = 0,
    arrears = 0;
  for (const s of sched.data ?? []) {
    const d = Number(s.amount_due ?? 0);
    const c = Number(s.amount_collected ?? 0);
    due += d;
    collected += c;
    if (s.invoice_status !== "Paid" && (s.due_date as string) < today) arrears += d - c;
  }

  return {
    leases: (leases.data ?? []).map((l) => {
      const p = prop(l.property);
      return {
        id: l.id as string,
        property: p?.address ?? null,
        propertyId: p?.id ?? null,
        rent: l.rent_amount as number,
        start: (l.start_date as string) ?? null,
        end: (l.end_date as string) ?? null,
        status: (l.status as string) ?? null,
      };
    }),
    documents: (docs.data ?? []).map((d) => ({
      id: d.id as string,
      name: d.name as string,
      link: d.external_link as string,
      expiry: (d.expiry_date as string) ?? null,
    })),
    finance: { due, collected, arrears },
  };
}
