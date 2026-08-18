import { createClient } from "@/lib/supabase/server";

const rel = <T,>(v: unknown): T | null => (Array.isArray(v) ? (v[0] ?? null) : ((v as T) ?? null)) as T | null;

export type BankAccountRow = {
  id: string;
  account_name: string | null;
  code: string | null;
  short_ref: string | null;
  entity_id: string | null;
  entity: string | null;
  active: boolean;
  institution: string | null;
  control_nominal_id: string | null;
};

export async function listBankAccounts(): Promise<BankAccountRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("bank_account")
    .select("id, account_name, code, short_ref, entity_id, active, institution, control_nominal_id, entity:entity_id(name)")
    .order("code", { ascending: true });
  return (data ?? []).map((b) => ({
    id: b.id as string,
    account_name: (b.account_name as string) ?? null,
    code: (b.code as string) ?? null,
    short_ref: (b.short_ref as string) ?? null,
    entity_id: (b.entity_id as string) ?? null,
    entity: rel<{ name: string }>((b as Record<string, unknown>).entity)?.name ?? null,
    active: (b.active as boolean) ?? true,
    institution: (b.institution as string) ?? null,
    control_nominal_id: (b.control_nominal_id as string) ?? null,
  }));
}

/** Options for the transaction bank picker. */
export type BankOption = { value: string; label: string; short_ref: string | null };
export async function bankAccountOptions(): Promise<BankOption[]> {
  const rows = await listBankAccounts();
  return rows
    .filter((b) => b.active)
    .map((b) => ({
      value: b.id,
      label: `${b.code ? b.code + " — " : ""}${b.account_name || b.institution || "Bank account"}`,
      short_ref: b.short_ref,
    }));
}

export async function listEntities(): Promise<{ value: string; label: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("entity").select("id, name").eq("active", true).order("name");
  return (data ?? []).map((e) => ({ value: e.id as string, label: e.name as string }));
}
