"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth";
import { logActivity } from "@/lib/data/activity";

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

export async function createRole(name: string, description: string): Promise<ActionResult> {
  let user;
  try {
    user = await requirePermission("roles", "create");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  if (!name.trim()) return { ok: false, error: "Role name is required." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("role")
    .insert({ name: name.trim(), description: description.trim() || null, is_system: false })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  await logActivity({ type: "Role Created", objectLabel: name, objectTable: "role", objectId: data.id, creatorId: user.id });
  revalidatePath("/roles");
  return { ok: true, id: data.id };
}

/** Toggle a single permission on a role. */
export async function setRolePermission(
  roleId: string,
  permissionId: string,
  on: boolean,
): Promise<ActionResult> {
  try {
    await requirePermission("roles", "edit");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const supabase = await createClient();
  if (on) {
    const { error } = await supabase
      .from("role_permission")
      .upsert({ role_id: roleId, permission_id: permissionId }, { onConflict: "role_id,permission_id" });
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase
      .from("role_permission")
      .delete()
      .eq("role_id", roleId)
      .eq("permission_id", permissionId);
    if (error) return { ok: false, error: error.message };
  }
  revalidatePath("/roles");
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteRole(roleId: string): Promise<ActionResult> {
  let user;
  try {
    user = await requirePermission("roles", "delete"); // Admin-only
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const supabase = await createClient();
  const { data: role } = await supabase.from("role").select("is_system, name").eq("id", roleId).maybeSingle();
  if (role?.is_system) return { ok: false, error: "System roles cannot be deleted." };

  const { count } = await supabase
    .from("staff_user")
    .select("*", { count: "exact", head: true })
    .eq("role_id", roleId);
  if ((count ?? 0) > 0) return { ok: false, error: "Role is assigned to staff; reassign them first." };

  const { error } = await supabase.from("role").delete().eq("id", roleId);
  if (error) return { ok: false, error: error.message };
  await logActivity({ type: "Role Deletion", objectLabel: role?.name, objectTable: "role", objectId: roleId, creatorId: user.id });
  revalidatePath("/roles");
  return { ok: true };
}
