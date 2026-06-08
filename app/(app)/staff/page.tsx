import { requireUser, can } from "@/lib/auth";
import { listStaff, listRoleOptions } from "@/lib/data/staff";
import { StaffClient } from "./staff-client";

export default async function StaffPage() {
  const user = await requireUser();
  const [staff, roles] = await Promise.all([listStaff(), listRoleOptions()]);

  return (
    <StaffClient
      staff={staff}
      roles={roles}
      perms={{
        create: can(user, "staff", "create"),
        edit: can(user, "staff", "edit"),
      }}
    />
  );
}
