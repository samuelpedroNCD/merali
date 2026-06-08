import { createClient } from "@/lib/supabase/server";

export type KeyRow = {
  id: string;
  key_code: string | null;
  property_id: string | null;
  held_by_type: string | null;
  status: string | null;
  date_given: string | null;
  date_returned: string | null;
  reference_id: string | null;
  notes: string | null;
  property?: { address: string | null } | null;
  spares_count: number;
};

export type KeyTotals = { total: number; out: number; spare: number; lost: number };

export async function listKeys(): Promise<{ keys: KeyRow[]; totals: KeyTotals }> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("key")
    .select("*, property:property_id(address), key_spare(count)")
    .order("created_at", { ascending: false });

  const keys: KeyRow[] = (data ?? []).map((k) => {
    const { key_spare, ...rest } = k as Record<string, unknown> & {
      key_spare?: { count: number }[];
    };
    return {
      ...(rest as unknown as KeyRow),
      spares_count: key_spare?.[0]?.count ?? 0,
    };
  });

  const totals: KeyTotals = {
    total: keys.length,
    out: keys.filter((k) => (k.status ?? "").toLowerCase() === "out").length,
    spare: keys.reduce((a, k) => a + k.spares_count, 0),
    lost: keys.filter((k) => (k.status ?? "").toLowerCase() === "lost").length,
  };
  return { keys, totals };
}

export type SpareRow = {
  id: string;
  reference: string | null;
  holder_name: string | null;
  held_by_type: string | null;
  status: string | null;
  date_given: string | null;
  date_returned: string | null;
};

export type KeyLogRow = {
  id: string;
  spare_id: string | null;
  is_spare_snapshot: boolean | null;
  action_out_when: string | null;
  action_in_when: string | null;
  holder: string | null;
  held_by_type_snapshot: string | null;
  status_after_return: string | null;
  is_open: boolean | null;
  notes: string | null;
  created_at: string;
  issued_by_name: string | null;
  received_by_name: string | null;
};

export type KeyDetail = {
  key: KeyRow & { property_id: string | null };
  spares: SpareRow[];
  log: KeyLogRow[];
};

export async function getKeyDetail(id: string): Promise<KeyDetail | null> {
  const supabase = await createClient();
  const { data: key } = await supabase
    .from("key")
    .select("*, property:property_id(address)")
    .eq("id", id)
    .maybeSingle();
  if (!key) return null;

  const { data: spares } = await supabase
    .from("key_spare")
    .select("id, reference, holder_name, held_by_type, status, date_given, date_returned")
    .eq("key_id", id)
    .order("created_at", { ascending: true });

  const { data: log } = await supabase
    .from("key_log")
    .select(
      "id, spare_id, is_spare_snapshot, action_out_when, action_in_when, holder, held_by_type_snapshot, status_after_return, is_open, notes, created_at, issued_by:issued_by(full_name), received_by:received_by(full_name)",
    )
    .eq("key_id", id)
    .order("created_at", { ascending: false });

  const name = (rel: unknown) => {
    const r = rel as { full_name?: string } | { full_name?: string }[] | null;
    return (Array.isArray(r) ? r[0]?.full_name : r?.full_name) ?? null;
  };

  return {
    key: { ...(key as unknown as KeyRow), spares_count: spares?.length ?? 0 },
    spares: (spares ?? []) as unknown as SpareRow[],
    log: (log ?? []).map((l) => ({
      id: l.id as string,
      spare_id: (l.spare_id as string) ?? null,
      is_spare_snapshot: (l.is_spare_snapshot as boolean) ?? null,
      action_out_when: (l.action_out_when as string) ?? null,
      action_in_when: (l.action_in_when as string) ?? null,
      holder: (l.holder as string) ?? null,
      held_by_type_snapshot: (l.held_by_type_snapshot as string) ?? null,
      status_after_return: (l.status_after_return as string) ?? null,
      is_open: (l.is_open as boolean) ?? null,
      notes: (l.notes as string) ?? null,
      created_at: l.created_at as string,
      issued_by_name: name(l.issued_by),
      received_by_name: name(l.received_by),
    })),
  };
}
