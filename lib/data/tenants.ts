import { createClient } from "@/lib/supabase/server";

export type TenantRow = {
  id: string;
  is_company: boolean | null;
  company_name: string | null;
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
};

export async function listTenants(): Promise<TenantRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tenant")
    .select("*")
    .order("created_at", { ascending: false });
  return (data ?? []) as unknown as TenantRow[];
}

export async function getTenant(id: string): Promise<TenantRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tenant")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (data as unknown as TenantRow) ?? null;
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
