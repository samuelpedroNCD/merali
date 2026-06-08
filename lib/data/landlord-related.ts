import { createClient } from "@/lib/supabase/server";

export type LandlordRelated = {
  properties: { id: string; address: string | null; status: string | null; target_rent: number | null }[];
  documents: { id: string; name: string; link: string; expiry: string | null }[];
  finance: { expected: number; collected: number; arrears: number };
};

export async function getLandlordRelated(landlordId: string): Promise<LandlordRelated> {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: props } = await supabase
    .from("property")
    .select("id, address, status, target_rent")
    .eq("landlord_id", landlordId)
    .order("created_at", { ascending: false });

  const propertyIds = (props ?? []).map((p) => p.id as string);

  const [docs, sched] = await Promise.all([
    supabase
      .from("document")
      .select("id, name, external_link, expiry_date")
      .eq("landlord_id", landlordId)
      .order("created_at", { ascending: false }),
    propertyIds.length
      ? supabase
          .from("rent_schedule")
          .select("amount_due, amount_collected, invoice_status, due_date")
          .in("property_id", propertyIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
  ]);

  let expected = 0,
    collected = 0,
    arrears = 0;
  for (const s of sched.data ?? []) {
    const d = Number(s.amount_due ?? 0);
    const c = Number(s.amount_collected ?? 0);
    expected += d;
    collected += c;
    if (s.invoice_status !== "Paid" && (s.due_date as string) < today) arrears += d - c;
  }

  return {
    properties: (props ?? []).map((p) => ({
      id: p.id as string,
      address: (p.address as string) ?? null,
      status: (p.status as string) ?? null,
      target_rent: (p.target_rent as number) ?? null,
    })),
    documents: (docs.data ?? []).map((d) => ({
      id: d.id as string,
      name: d.name as string,
      link: d.external_link as string,
      expiry: (d.expiry_date as string) ?? null,
    })),
    finance: { expected, collected, arrears },
  };
}
