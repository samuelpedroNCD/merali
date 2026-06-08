import { createClient } from "@/lib/supabase/server";

export type StaffRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  email: string;
  phone: string | null;
  bio: string | null;
  is_active: boolean | null;
  role_id: string | null;
  role: string | null;
};

export async function listStaff(): Promise<StaffRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("staff_user")
    .select("id, first_name, last_name, full_name, email, phone, bio, is_active, role_id, role:role_id(name)")
    .order("created_at", { ascending: true });
  return (data ?? []).map((s) => {
    const r = s.role as { name?: string } | { name?: string }[] | null;
    return {
      ...(s as unknown as StaffRow),
      role: (Array.isArray(r) ? r[0]?.name : r?.name) ?? null,
    };
  });
}

export async function listRoleOptions(): Promise<{ value: string; label: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("role").select("id, name").order("name");
  return (data ?? []).map((r) => ({ value: r.id, label: r.name }));
}

export async function listStaffOptions(): Promise<
  { value: string; label: string }[]
> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("staff_user")
    .select("id, full_name, email")
    .eq("is_active", true)
    .order("full_name", { ascending: true });
  return (data ?? []).map((s) => ({
    value: s.id,
    label: s.full_name || s.email,
  }));
}
