import { createClient } from "@/lib/supabase/server";

export type SupplierRow = {
  id: string;
  business_name: string;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  type: string | null;
  status: string | null;
  outstanding: number | null;
  preferred: boolean | null;
  notes: string | null;
};

export async function listSuppliers(): Promise<SupplierRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("supplier")
    .select("*")
    .order("created_at", { ascending: false });
  return (data ?? []) as unknown as SupplierRow[];
}

export async function listSupplierOptions(): Promise<
  { value: string; label: string }[]
> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("supplier")
    .select("id, business_name")
    .order("business_name", { ascending: true });
  return (data ?? []).map((s) => ({ value: s.id, label: s.business_name }));
}
