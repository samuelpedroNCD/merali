import { redirect } from "next/navigation";
import { requireUser, can } from "@/lib/auth";
import { listRolesWithPerms, listPermissions } from "@/lib/data/roles";
import { RolesClient } from "./roles-client";

export default async function RolesPage() {
  const user = await requireUser();
  if (!can(user, "roles", "view")) redirect("/dashboard");

  const [roles, permissions] = await Promise.all([
    listRolesWithPerms(),
    listPermissions(),
  ]);

  return (
    <RolesClient
      roles={roles}
      permissions={permissions}
      perms={{
        create: can(user, "roles", "create"),
        edit: can(user, "roles", "edit"),
        remove: can(user, "roles", "delete"),
      }}
    />
  );
}
