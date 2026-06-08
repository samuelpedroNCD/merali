import { requireUser, can } from "@/lib/auth";
import { listLeases, listPropertyOptions } from "@/lib/data/leases";
import { listTenantOptions } from "@/lib/data/tenants";
import { getOptions } from "@/lib/data/options";
import { nominalOptions } from "@/lib/data/nominals";
import { TenanciesClient } from "./tenancies-client";

export default async function TenanciesPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; renew?: string }>;
}) {
  const user = await requireUser();
  const { edit, renew } = await searchParams;
  const [leases, properties, tenants, options, nominals] = await Promise.all([
    listLeases(),
    listPropertyOptions(),
    listTenantOptions(),
    getOptions(["tenancy_code", "lease_status", "payment_frequency", "deposit_scheme"]),
    nominalOptions(),
  ]);

  return (
    <TenanciesClient
      leases={leases}
      properties={properties}
      tenants={tenants}
      options={options}
      nominals={nominals}
      editId={edit}
      renewId={renew}
      perms={{
        create: can(user, "leases", "create"),
        edit: can(user, "leases", "edit"),
        remove: can(user, "leases", "delete"),
      }}
    />
  );
}
