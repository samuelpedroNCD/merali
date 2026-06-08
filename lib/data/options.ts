import { createClient } from "@/lib/supabase/server";

export type Option = { value: string; label: string };

/** Fetch active option-set values for one or more categories. */
export async function getOptions(
  categories: string[],
): Promise<Record<string, Option[]>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("option_set")
    .select("category, value, label, sort")
    .in("category", categories)
    .eq("active", true)
    .order("sort", { ascending: true });

  const out: Record<string, Option[]> = {};
  for (const c of categories) out[c] = [];
  for (const row of data ?? []) {
    (out[row.category] ??= []).push({ value: row.value, label: row.label });
  }
  return out;
}
