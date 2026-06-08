import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type SearchHit = {
  type: "Property" | "Tenant" | "Landlord" | "Supplier" | "Key";
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

  const [props, tenants, landlords, suppliers, keys] = await Promise.all([
    supabase.from("property").select("id, address, internal_code, town, post_code").or(`address.ilike.${like},internal_code.ilike.${like},town.ilike.${like},post_code.ilike.${like}`).limit(6),
    supabase.from("tenant").select("id, full_name, email").or(`full_name.ilike.${like},email.ilike.${like}`).limit(6),
    supabase.from("landlord").select("id, full_name, email").or(`full_name.ilike.${like},email.ilike.${like}`).limit(6),
    supabase.from("supplier").select("id, business_name").ilike("business_name", like).limit(4),
    supabase.from("key").select("id, key_code, reference_id, property:property_id(address)").or(`key_code.ilike.${like},reference_id.ilike.${like}`).limit(6),
  ]);

  const hits: SearchHit[] = [];
  for (const p of props.data ?? [])
    hits.push({ type: "Property", label: (p.address as string) || (p.internal_code as string) || "Property", sublabel: [(p.town as string), (p.post_code as string)].filter(Boolean).join(" · ") || null, href: `/properties/${p.id}` });
  for (const t of tenants.data ?? [])
    hits.push({ type: "Tenant", label: (t.full_name as string) || (t.email as string) || "Tenant", sublabel: (t.email as string) ?? null, href: `/tenants/${t.id}` });
  for (const l of landlords.data ?? [])
    hits.push({ type: "Landlord", label: (l.full_name as string) || "Landlord", sublabel: (l.email as string) ?? null, href: `/landlords/${l.id}` });
  for (const s of suppliers.data ?? [])
    hits.push({ type: "Supplier", label: s.business_name as string, sublabel: null, href: `/suppliers` });
  for (const k of keys.data ?? []) {
    const prop = (Array.isArray(k.property) ? k.property[0] : k.property) as { address?: string } | null;
    hits.push({ type: "Key", label: (k.key_code as string) || "Key", sublabel: prop?.address ?? (k.reference_id as string) ?? null, href: `/keys` });
  }

  return NextResponse.json({ hits });
}
