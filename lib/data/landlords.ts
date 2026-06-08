import { createClient } from "@/lib/supabase/server";

export type LandlordRow = {
  id: string;
  landlord_type: string | null;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  preferred_contact: string | null;
  company_registration_date: string | null;
  vat_number: string | null;
  main_contact_name: string | null;
  main_contact_email: string | null;
  main_contact_phone: string | null;
  director_name: string | null;
  director_email: string | null;
  director_phone: string | null;
  trustee_name: string | null;
  trustee_email: string | null;
  trustee_phone: string | null;
  bio: string | null;
  notes: string | null;
  property_count?: number;
};

export async function listLandlords(): Promise<LandlordRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("landlord")
    .select("*, property(count)")
    .order("created_at", { ascending: false });
  return (data ?? []).map((l) => {
    const { property, ...rest } = l as Record<string, unknown> & {
      property?: { count: number }[];
    };
    return {
      ...(rest as unknown as LandlordRow),
      property_count: property?.[0]?.count ?? 0,
    };
  });
}

export async function getLandlord(id: string): Promise<LandlordRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("landlord")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (data as unknown as LandlordRow) ?? null;
}
