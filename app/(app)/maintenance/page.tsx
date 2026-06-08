import { requireUser, can } from "@/lib/auth";
import { listMaintenance } from "@/lib/data/maintenance";
import { listPropertyOptions } from "@/lib/data/leases";
import { listSupplierOptions } from "@/lib/data/suppliers";
import { listStaffOptions } from "@/lib/data/staff";
import { getOptions } from "@/lib/data/options";
import { MaintenanceClient } from "./maintenance-client";

export default async function MaintenancePage() {
  const user = await requireUser();
  const [jobs, properties, suppliers, staff, options] = await Promise.all([
    listMaintenance(),
    listPropertyOptions(),
    listSupplierOptions(),
    listStaffOptions(),
    getOptions(["maintenance_status", "maintenance_urgency", "maintenance_type"]),
  ]);

  return (
    <MaintenanceClient
      jobs={jobs}
      properties={properties}
      suppliers={suppliers}
      staff={staff}
      options={options}
      perms={{
        create: can(user, "maintenance", "create"),
        edit: can(user, "maintenance", "edit"),
        remove: can(user, "maintenance", "delete"),
      }}
    />
  );
}
