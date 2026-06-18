import { createClient } from "@/lib/supabase/server";
import { decryptFields, TENANT_SECRET_FIELDS, TENANT_CONTACT_SECRET_FIELDS } from "@/lib/crypto/secrets";

export type TenantContact = {
  id: string;
  type: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  relationship: string | null;
  address: string | null;
};

export type TenantRow = {
  id: string;
  is_company: boolean | null;
  company_name: string | null;
  company_address: string | null;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  forwarding_address: string | null;
  position: string | null;
  tenant_code: string | null;
  preferred_contact: string | null;
  tenant_type: string | null;
  status: string | null;
  acquired_date: string | null;
  nok_name: string | null;
  nok_phone: string | null;
  nok_email: string | null;
  nok_address: string | null;
  nok_relationship: string | null;
  guarantor_name: string | null;
  guarantor_email: string | null;
  guarantor_phone: string | null;
  bio: string | null;
  notes: string | null;
  contacts: TenantContact[];
};

const CONTACT_SELECT = "tenant_contact(id, type, name, email, phone, relationship, address)";

// Map the joined tenant_contact rows onto `contacts`, decrypting each row's PII.
function mapTenant(t: Record<string, unknown>): TenantRow {
  const { tenant_contact, ...rest } = t as Record<string, unknown> & { tenant_contact?: TenantContact[] };
  const row = decryptFields(rest as unknown as TenantRow, TENANT_SECRET_FIELDS);
  row.contacts = (tenant_contact ?? []).map((c) => decryptFields(c, TENANT_CONTACT_SECRET_FIELDS));
  return row;
}

export async function listTenants(): Promise<TenantRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tenant")
    .select(`*, ${CONTACT_SELECT}`)
    .order("created_at", { ascending: false });
  return (data ?? []).map((t) => mapTenant(t as Record<string, unknown>));
}

export async function getTenant(id: string): Promise<TenantRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tenant")
    .select(`*, ${CONTACT_SELECT}`)
    .eq("id", id)
    .maybeSingle();
  return data ? mapTenant(data as Record<string, unknown>) : null;
}

/** Tenants for lease/relationship dropdowns. */
export async function listTenantOptions(): Promise<
  { value: string; label: string }[]
> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tenant")
    .select("id, full_name, email")
    .order("full_name", { ascending: true });
  return (data ?? []).map((t) => ({
    value: t.id,
    label: t.full_name || t.email || "Unnamed tenant",
  }));
}
