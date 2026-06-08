import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = {
  id: string;
  userId: string;
  name: string;
  email: string;
  roleId: string | null;
  roleName: string;
  avatarUrl: string | null;
  permissions: Set<string>; // "module:action"
};

/**
 * Resolve the signed-in staff user + their permission set.
 * Returns null when there is no valid session / profile.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: staff } = await supabase
    .from("staff_user")
    .select("id, first_name, last_name, full_name, email, role_id, profile_picture, role:role_id(name)")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!staff) return null;

  const roleId: string | null = staff.role_id ?? null;
  const permissions = new Set<string>();
  if (roleId) {
    const { data: perms } = await supabase
      .from("role_permission")
      .select("permission:permission_id(module, action)")
      .eq("role_id", roleId);
    for (const row of perms ?? []) {
      const rel = (row as unknown as {
        permission: { module: string; action: string } | { module: string; action: string }[] | null;
      }).permission;
      const p = Array.isArray(rel) ? rel[0] : rel;
      if (p) permissions.add(`${p.module}:${p.action}`);
    }
  }

  const roleRel = staff.role as { name?: string } | { name?: string }[] | null;
  const roleName = Array.isArray(roleRel)
    ? roleRel[0]?.name ?? ""
    : roleRel?.name ?? "";

  return {
    id: staff.id,
    userId: user.id,
    name: staff.full_name?.trim() || staff.email,
    email: staff.email,
    roleId,
    roleName,
    avatarUrl: (staff as { profile_picture?: string }).profile_picture ?? null,
    permissions,
  };
}

/** Require a session; redirect to login otherwise. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export function can(user: CurrentUser, module: string, action: string) {
  return user.permissions.has(`${module}:${action}`);
}

/** Require a session + a specific permission; throws if not allowed. */
export async function requirePermission(
  module: string,
  action: "view" | "create" | "edit" | "delete",
): Promise<CurrentUser> {
  const user = await requireUser();
  if (!can(user, module, action)) {
    throw new Error(`Not authorised: ${module}:${action}`);
  }
  return user;
}
