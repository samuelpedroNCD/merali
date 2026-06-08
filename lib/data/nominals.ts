import { createClient } from "@/lib/supabase/server";

export type NominalCode = {
  id: string;
  code: string;
  name: string;
  type: string; // Income | Expense | Both
  active: boolean;
  sort: number;
};

export async function listNominalCodes(includeInactive = false): Promise<NominalCode[]> {
  const supabase = await createClient();
  let q = supabase.from("nominal_code").select("id, code, name, type, active, sort").order("sort", { ascending: true }).order("code", { ascending: true });
  if (!includeInactive) q = q.eq("active", true);
  const { data } = await q;
  return (data ?? []) as NominalCode[];
}

/** Options for selects: value = id, label = "code — name". */
export async function nominalOptions(): Promise<{ value: string; label: string; type: string }[]> {
  const codes = await listNominalCodes(false);
  return codes.map((c) => ({ value: c.id, label: `${c.code} — ${c.name}`, type: c.type }));
}
