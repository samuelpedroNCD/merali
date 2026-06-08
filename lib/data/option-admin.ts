import { createClient } from "@/lib/supabase/server";

export type OptionValue = {
  id: string;
  category: string;
  value: string;
  label: string;
  sort: number;
  active: boolean;
};

export type OptionCategory = { category: string; values: OptionValue[] };

export { CATEGORY_LABELS } from "@/lib/option-categories";

export async function listOptionSets(): Promise<OptionCategory[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("option_set")
    .select("id, category, value, label, sort, active")
    .order("category", { ascending: true })
    .order("sort", { ascending: true });

  const map = new Map<string, OptionValue[]>();
  for (const r of (data ?? []) as OptionValue[]) {
    if (!map.has(r.category)) map.set(r.category, []);
    map.get(r.category)!.push(r);
  }
  return [...map.entries()].map(([category, values]) => ({ category, values }));
}
