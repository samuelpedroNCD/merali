import { createClient } from "@/lib/supabase/server";

export type Permission = { id: string; module: string; action: string };
export type RoleWithPerms = {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  permissionIds: string[];
};

export async function listPermissions(): Promise<Permission[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("permission").select("id, module, action");
  return (data ?? []) as Permission[];
}

export async function listRolesWithPerms(): Promise<RoleWithPerms[]> {
  const supabase = await createClient();
  const { data: roles } = await supabase
    .from("role")
    .select("id, name, description, is_system, role_permission(permission_id)")
    .order("name", { ascending: true });

  return (roles ?? []).map((r) => {
    const rp = (r.role_permission ?? []) as { permission_id: string }[];
    return {
      id: r.id as string,
      name: r.name as string,
      description: (r.description as string) ?? null,
      is_system: Boolean(r.is_system),
      permissionIds: rp.map((x) => x.permission_id),
    };
  });
}

export { MODULE_ORDER, ACTIONS } from "@/lib/roles-constants";
