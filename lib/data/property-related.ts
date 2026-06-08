import { createClient } from "@/lib/supabase/server";

export type PropertyRelated = {
  tenants: { id: string; name: string | null; status: string | null; start: string | null; end: string | null }[];
  documents: { id: string; name: string; link: string; expiry: string | null }[];
  maintenance: { id: string; description: string | null; status: string | null; urgency: string | null }[];
  transactions: { id: string; date: string | null; type: string | null; category: string | null; gross: number }[];
  keys: { id: string; key_code: string | null; status: string | null; held_by_type: string | null }[];
  units: { id: string; unit_number: string | null; status: string | null }[];
  photos: { id: string; url: string; caption: string | null }[];
  inspections: { id: string; type: string; date: string | null; inspector: string | null; notes: string | null; photos: string[] }[];
};

/** Fetch the records shown on a property's detail tabs. */
export async function getPropertyRelated(propertyId: string): Promise<PropertyRelated> {
  const supabase = await createClient();

  const [leases, docs, maint, txns, keys, units, photos, inspections] = await Promise.all([
    supabase
      .from("lease")
      .select("id, start_date, end_date, status, tenant:tenant_id(full_name)")
      .eq("property_id", propertyId)
      .order("created_at", { ascending: false }),
    supabase
      .from("document")
      .select("id, name, external_link, expiry_date")
      .eq("property_id", propertyId)
      .order("created_at", { ascending: false }),
    supabase
      .from("maintenance")
      .select("id, description, status, urgency")
      .eq("property_id", propertyId)
      .order("created_at", { ascending: false }),
    supabase
      .from("transaction")
      .select("id, txn_date, type, category, amount_gross")
      .eq("property_id", propertyId)
      .order("txn_date", { ascending: false })
      .limit(20),
    supabase
      .from("key")
      .select("id, key_code, status, held_by_type")
      .eq("property_id", propertyId)
      .order("created_at", { ascending: false }),
    supabase
      .from("property")
      .select("id, internal_code, status")
      .eq("parent_property_id", propertyId)
      .order("internal_code", { ascending: true }),
    supabase
      .from("property_photo")
      .select("id, url, caption")
      .eq("property_id", propertyId)
      .order("created_at", { ascending: false }),
    supabase
      .from("inspection")
      .select("id, type, inspection_date, notes, photos, inspector:inspector_id(full_name)")
      .eq("property_id", propertyId)
      .order("inspection_date", { ascending: false }),
  ]);

  const name = (rel: unknown) => {
    const r = rel as { full_name?: string } | { full_name?: string }[] | null;
    return (Array.isArray(r) ? r[0]?.full_name : r?.full_name) ?? null;
  };

  return {
    tenants: (leases.data ?? []).map((l) => ({
      id: l.id as string,
      name: name(l.tenant),
      status: (l.status as string) ?? null,
      start: (l.start_date as string) ?? null,
      end: (l.end_date as string) ?? null,
    })),
    documents: (docs.data ?? []).map((d) => ({
      id: d.id as string,
      name: d.name as string,
      link: d.external_link as string,
      expiry: (d.expiry_date as string) ?? null,
    })),
    maintenance: (maint.data ?? []).map((m) => ({
      id: m.id as string,
      description: (m.description as string) ?? null,
      status: (m.status as string) ?? null,
      urgency: (m.urgency as string) ?? null,
    })),
    transactions: (txns.data ?? []).map((t) => ({
      id: t.id as string,
      date: (t.txn_date as string) ?? null,
      type: (t.type as string) ?? null,
      category: (t.category as string) ?? null,
      gross: Number(t.amount_gross ?? 0),
    })),
    keys: (keys.data ?? []).map((k) => ({
      id: k.id as string,
      key_code: (k.key_code as string) ?? null,
      status: (k.status as string) ?? null,
      held_by_type: (k.held_by_type as string) ?? null,
    })),
    units: (units.data ?? []).map((u) => ({
      id: u.id as string,
      unit_number: (u.internal_code as string) ?? null,
      status: (u.status as string) ?? null,
    })),
    photos: (photos.data ?? []).map((ph) => ({
      id: ph.id as string,
      url: ph.url as string,
      caption: (ph.caption as string) ?? null,
    })),
    inspections: (inspections.data ?? []).map((i) => ({
      id: i.id as string,
      type: (i.type as string) ?? "Routine",
      date: (i.inspection_date as string) ?? null,
      inspector: name(i.inspector),
      notes: (i.notes as string) ?? null,
      photos: Array.isArray(i.photos) ? (i.photos as string[]) : [],
    })),
  };
}
