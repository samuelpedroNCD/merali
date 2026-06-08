import { createClient } from "@/lib/supabase/server";

export type CertificationRow = {
  id: string;
  property_id: string | null;
  type_id: string | null;
  expiry_date: string | null;
  is_expired: boolean | null;
  document_link: string | null;
  notes: string | null;
  property?: { address: string | null } | null;
  type?: { name: string | null } | null;
};

export async function listCertifications(): Promise<CertificationRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("certification")
    .select("*, property:property_id(address), type:type_id(name)")
    .order("expiry_date", { ascending: true });
  return (data ?? []) as unknown as CertificationRow[];
}

export async function listCertTypeOptions(): Promise<
  { value: string; label: string }[]
> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("certification_type")
    .select("id, name")
    .order("name", { ascending: true });
  return (data ?? []).map((t) => ({ value: t.id, label: t.name }));
}
