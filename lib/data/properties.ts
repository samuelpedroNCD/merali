import { createClient } from "@/lib/supabase/server";
import { CONTAINER_CONFIGS } from "@/lib/property-config";

export type PropertyRow = {
  id: string;
  address: string | null;
  flat: string | null;
  town: string | null;
  post_code: string | null;
  country: string | null;
  area: string | null;
  internal_code: string | null;
  configuration: string | null;
  class: string | null;
  property_type: string | null;
  status: string | null;
  tenancy_class: string | null;
  property_tax: string | null;
  bedrooms: number | null;
  parent_property_id: string | null;
  landlord_id: string | null;
  assigned_manager_id: string | null;
  date_acquired: string | null;
  leasehold_register_number: string | null;
  target_rent: number | null;
  target_rent_month: string | null;
  notes: string | null;
  landlord?: { id: string; full_name: string | null } | null;
  titles: { id: string; doc_date: string | null; tenure: string | null; title_number: string | null }[];
};

/** List properties (newest first) with landlord name. */
export async function listProperties(search?: string): Promise<PropertyRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("property")
    .select(
      "id, address, flat, town, post_code, country, area, internal_code, configuration, class, property_type, status, tenancy_class, property_tax, bedrooms, parent_property_id, landlord_id, assigned_manager_id, date_acquired, leasehold_register_number, target_rent, target_rent_month, notes, landlord:landlord_id(id, full_name), property_title(id, doc_date, tenure, title_number)",
    )
    .order("created_at", { ascending: false });

  if (search?.trim()) {
    const s = `%${search.trim()}%`;
    query = query.or(`address.ilike.${s},internal_code.ilike.${s},town.ilike.${s}`);
  }

  const { data } = await query;
  return (data ?? []).map((p) => {
    const { property_title, ...rest } = p as Record<string, unknown> & { property_title?: PropertyRow["titles"] };
    return { ...(rest as unknown as PropertyRow), titles: property_title ?? [] };
  });
}

export async function getProperty(id: string): Promise<PropertyRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("property")
    .select("*, landlord:landlord_id(id, full_name), property_title(id, doc_date, tenure, title_number)")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const { property_title, ...rest } = data as Record<string, unknown> & { property_title?: PropertyRow["titles"] };
  return { ...(rest as unknown as PropertyRow), titles: property_title ?? [] };
}

/**
 * Container properties (Buildings + Sub-buildings) that can be chosen as a parent
 * when creating/editing a Unit or Sub-building. Excludes the property itself
 * (passed as `excludeId`) so it can't become its own parent.
 */
export async function listContainerOptions(
  excludeId?: string,
): Promise<{ value: string; label: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("property")
    .select("id, address, internal_code, configuration")
    .in("configuration", CONTAINER_CONFIGS as unknown as string[])
    .order("address", { ascending: true });
  return (data ?? [])
    .filter((p) => p.id !== excludeId)
    .map((p) => ({
      value: p.id as string,
      label: `${p.address || p.internal_code || "Property"} · ${p.configuration}`,
    }));
}

/** Landlords for the ownership dropdown. */
export async function listLandlordOptions(): Promise<
  { value: string; label: string }[]
> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("landlord")
    .select("id, full_name, main_contact_name")
    .order("full_name", { ascending: true });
  return (data ?? []).map((l) => ({
    value: l.id,
    label: l.full_name || l.main_contact_name || "Unnamed landlord",
  }));
}
