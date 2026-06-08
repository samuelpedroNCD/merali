import { requireUser, can } from "@/lib/auth";
import { listSuppliers } from "@/lib/data/suppliers";
import { getOptions } from "@/lib/data/options";
import { SuppliersClient } from "./suppliers-client";

export default async function SuppliersPage() {
  const user = await requireUser();
  const [suppliers, options] = await Promise.all([
    listSuppliers(),
    getOptions(["supplier_type", "supplier_status"]),
  ]);

  return (
    <SuppliersClient
      suppliers={suppliers}
      options={options}
      perms={{
        create: can(user, "suppliers", "create"),
        edit: can(user, "suppliers", "edit"),
        remove: can(user, "suppliers", "delete"),
      }}
    />
  );
}
