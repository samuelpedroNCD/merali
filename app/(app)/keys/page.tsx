import { requireUser, can } from "@/lib/auth";
import { listKeys } from "@/lib/data/keys";
import { listPropertyOptions } from "@/lib/data/leases";
import { getOptions } from "@/lib/data/options";
import { KeysClient } from "./keys-client";

export default async function KeysPage() {
  const user = await requireUser();
  const [{ keys, totals }, properties, options] = await Promise.all([
    listKeys(),
    listPropertyOptions(),
    getOptions(["key_status", "held_by_type"]),
  ]);

  return (
    <KeysClient
      keys={keys}
      totals={totals}
      properties={properties}
      options={options}
      perms={{
        create: can(user, "keys", "create"),
        edit: can(user, "keys", "edit"),
        remove: can(user, "keys", "delete"),
      }}
    />
  );
}
