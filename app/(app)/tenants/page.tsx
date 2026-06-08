import { requireUser, can } from "@/lib/auth";
import { listTenants } from "@/lib/data/tenants";
import { getOptions } from "@/lib/data/options";
import { TenantsClient } from "./tenants-client";

export default async function TenantsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const user = await requireUser();
  const { edit } = await searchParams;
  const [tenants, options] = await Promise.all([
    listTenants(),
    getOptions(["tenant_type", "tenant_status", "preferred_contact", "nok_relationship"]),
  ]);

  return (
    <TenantsClient
      tenants={tenants}
      options={options}
      editId={edit}
      perms={{
        create: can(user, "tenants", "create"),
        edit: can(user, "tenants", "edit"),
        remove: can(user, "tenants", "delete"),
      }}
    />
  );
}
