import { createClient } from "@/lib/supabase/server";
import { CONFIG_SUBBUILDING, CONFIG_UNIT, isLeasableConfig } from "@/lib/property-config";

export type PropertyRelated = {
  tenants: { id: string; name: string | null; status: string | null; start: string | null; end: string | null }[];
  documents: { id: string; name: string; link: string; expiry: string | null }[];
  maintenance: { id: string; description: string | null; status: string | null; urgency: string | null }[];
  transactions: { id: string; date: string | null; type: string | null; category: string | null; gross: number }[];
  keys: { id: string; key_code: string | null; status: string | null; held_by_type: string | null }[];
  units: { id: string; unit_number: string | null; status: string | null; configuration: string | null; address: string | null }[];
  utilities: { id: string; utility_type: string | null; supplier: string | null; meter_location: string | null; stop_tap_location: string | null; serial_number: string | null; notes: string | null }[];
  parent: { id: string; address: string | null } | null;
  photos: { id: string; url: string; caption: string | null }[];
  inspections: { id: string; type: string; date: string | null; inspector: string | null; notes: string | null; photos: string[] }[];
};

/** Fetch the records shown on a property's detail tabs. */
export async function getPropertyRelated(propertyId: string): Promise<PropertyRelated> {
  const supabase = await createClient();

  const [leases, docs, maint, txns, keys, units, photos, inspections, self, utils] = await Promise.all([
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
      .select("id, internal_code, status, configuration, address")
      .eq("parent_property_id", propertyId)
      .order("configuration", { ascending: true })
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
    supabase
      .from("property")
      .select("parent:parent_property_id(id, address, internal_code)")
      .eq("id", propertyId)
      .maybeSingle(),
    supabase
      .from("utility")
      .select("id, utility_type, supplier, meter_location, stop_tap_location, serial_number, notes")
      .eq("property_id", propertyId)
      .order("created_at", { ascending: true }),
  ]);

  const parentRel = (self.data as { parent?: unknown } | null)?.parent;
  const parentObj = (Array.isArray(parentRel) ? parentRel[0] : parentRel) as
    | { id: string; address: string | null; internal_code: string | null }
    | null
    | undefined;
  const parent = parentObj ? { id: parentObj.id, address: parentObj.address || parentObj.internal_code } : null;

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
      configuration: (u.configuration as string) ?? null,
      address: (u.address as string) ?? null,
    })),
    parent,
    utilities: (utils.data ?? []) as PropertyRelated["utilities"],
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

export type Ancestor = { id: string; label: string; configuration: string | null };

/**
 * The chain of parent properties from the root down to (but not including) the
 * given property, for a hierarchy breadcrumb. Walks `parent_property_id` upwards
 * (capped to avoid loops) and returns root → … → immediate parent.
 */
export async function getAncestors(propertyId: string): Promise<Ancestor[]> {
  const supabase = await createClient();
  const chain: Ancestor[] = [];
  const seen = new Set<string>([propertyId]);

  // Start from the property's parent.
  let cursor: string | null = null;
  const { data: start } = await supabase
    .from("property")
    .select("parent_property_id")
    .eq("id", propertyId)
    .maybeSingle();
  cursor = (start?.parent_property_id as string) ?? null;

  while (cursor && !seen.has(cursor) && chain.length < 20) {
    seen.add(cursor);
    const { data }: { data: { id: string; address: string | null; internal_code: string | null; configuration: string | null; parent_property_id: string | null } | null } =
      await supabase
        .from("property")
        .select("id, address, internal_code, configuration, parent_property_id")
        .eq("id", cursor)
        .maybeSingle();
    if (!data) break;
    chain.unshift({
      id: data.id,
      label: data.address || data.internal_code || "Property",
      configuration: data.configuration ?? null,
    });
    cursor = data.parent_property_id ?? null;
  }
  return chain;
}

type DescendantRow = { id: string; configuration: string | null; status: string | null };

/** All descendants of a property (breadth-first; the tree is shallow). */
async function getDescendants(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rootId: string,
): Promise<DescendantRow[]> {
  const out: DescendantRow[] = [];
  const seen = new Set<string>([rootId]);
  let frontier = [rootId];
  while (frontier.length && out.length < 5000) {
    const { data } = await supabase
      .from("property")
      .select("id, configuration, status, parent_property_id")
      .in("parent_property_id", frontier);
    const next: string[] = [];
    for (const r of data ?? []) {
      const id = r.id as string;
      if (seen.has(id)) continue; // cycle guard (trigger prevents these anyway)
      seen.add(id);
      out.push({ id, configuration: (r.configuration as string) ?? null, status: (r.status as string) ?? null });
      next.push(id);
    }
    frontier = next;
  }
  return out;
}

export type PropertyRollup = {
  subBuildings: number;
  units: number;
  leasable: number;
  occupied: number;
  vacant: number;
  occupancyRate: number;
  income: number;
  expense: number;
  net: number;
  openMaintenance: number;
};

/**
 * Aggregate a container's whole subtree: total units/sub-buildings, occupancy
 * over leasable leaves, and finance (income/expense/net) + open maintenance
 * across the property and all its descendants. Returns null for a leaf with no
 * descendants (nothing to roll up).
 */
export async function getPropertyRollup(propertyId: string): Promise<PropertyRollup | null> {
  const supabase = await createClient();
  const descendants = await getDescendants(supabase, propertyId);
  if (descendants.length === 0) return null;

  const allIds = [propertyId, ...descendants.map((d) => d.id)];
  const leasableIds = descendants.filter((d) => isLeasableConfig(d.configuration)).map((d) => d.id);
  const subBuildings = descendants.filter((d) => d.configuration === CONFIG_SUBBUILDING).length;
  const units = descendants.filter((d) => d.configuration === CONFIG_UNIT).length;

  const today = new Date().toISOString().slice(0, 10);
  const [{ data: txns }, leasesRes, maintRes] = await Promise.all([
    supabase.from("transaction").select("type, amount_gross").in("property_id", allIds).limit(10000),
    leasableIds.length
      ? supabase.from("lease").select("property_id, status, end_date").in("property_id", leasableIds)
      : Promise.resolve({ data: [] as { property_id: string; status: string | null; end_date: string | null }[] }),
    supabase.from("maintenance").select("id", { count: "exact", head: true }).in("property_id", allIds).neq("status", "Completed"),
  ]);

  let income = 0;
  let expense = 0;
  for (const t of txns ?? []) {
    const g = Number(t.amount_gross ?? 0);
    if ((t.type as string) === "Income") income += g;
    else expense += g;
  }

  const occ = new Set<string>();
  for (const l of leasesRes.data ?? []) {
    const st = ((l.status as string) ?? "").toLowerCase();
    if (st === "ended" || st === "terminated" || st === "expired") continue;
    if (l.end_date && (l.end_date as string) < today) continue;
    occ.add(l.property_id as string);
  }
  const leasable = leasableIds.length;
  const occupied = occ.size;
  const vacant = Math.max(0, leasable - occupied);

  return {
    subBuildings,
    units,
    leasable,
    occupied,
    vacant,
    occupancyRate: leasable > 0 ? Math.round((occupied / leasable) * 100) : 0,
    income,
    expense,
    net: income - expense,
    openMaintenance: (maintRes as { count: number | null }).count ?? 0,
  };
}
