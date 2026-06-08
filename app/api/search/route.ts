import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type SearchHit = {
  type: "Property" | "Tenant" | "Landlord" | "Supplier";
  label: string;
  sublabel: string | null;
  href: string;
};

export async function GET(request: NextRequest) {
  await requireUser();
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ hits: [] });

  const supabase = await createClient();
  const like = `%${q}%`;

  const [props, tenants, landlords, suppliers] = await Promise.all([
    supabase.from("property").select("id, address, internal_code, town").or(`address.ilike.${like},internal_code.ilike.${like},town.ilike.${like}`).limit(6),
    supabase.from("tenant").select("id, full_name, email").or(`full_name.ilike.${like},email.ilike.${like}`).limit(6),
    supabase.from("landlord").select("id, full_name, email").or(`full_name.ilike.${like},email.ilike.${like}`).limit(6),
    supabase.from("supplier").select("id, business_name").ilike("business_name", like).limit(4),
  ]);

  const hits: SearchHit[] = [];
  for (const p of props.data ?? [])
    hits.push({ type: "Property", label: (p.address as string) || (p.internal_code as string) || "Property", sublabel: (p.town as string) ?? null, href: `/properties/${p.id}` });
  for (const t of tenants.data ?? [])
    hits.push({ type: "Tenant", label: (t.full_name as string) || (t.email as string) || "Tenant", sublabel: (t.email as string) ?? null, href: `/tenants/${t.id}` });
  for (const l of landlords.data ?? [])
    hits.push({ type: "Landlord", label: (l.full_name as string) || "Landlord", sublabel: (l.email as string) ?? null, href: `/landlords/${l.id}` });
  for (const s of suppliers.data ?? [])
    hits.push({ type: "Supplier", label: s.business_name as string, sublabel: null, href: `/suppliers` });

  return NextResponse.json({ hits });
}
