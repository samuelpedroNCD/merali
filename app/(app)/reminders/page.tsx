import { requireUser, can } from "@/lib/auth";
import { listReminders } from "@/lib/data/reminders";
import { listStaffOptions } from "@/lib/data/staff";
import { listPropertyOptions } from "@/lib/data/leases";
import { RemindersClient } from "./reminders-client";

export default async function RemindersPage() {
  const user = await requireUser();
  const [reminders, staff, properties] = await Promise.all([
    listReminders(),
    listStaffOptions(),
    listPropertyOptions(),
  ]);

  return (
    <RemindersClient
      reminders={reminders}
      staff={staff}
      properties={properties}
      perms={{
        create: can(user, "reminders", "create"),
        edit: can(user, "reminders", "edit"),
        remove: can(user, "reminders", "delete"),
      }}
    />
  );
}
