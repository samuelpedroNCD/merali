import { redirect } from "next/navigation";
import { requireUser, can } from "@/lib/auth";
import { listUnreconciledTransactions } from "@/lib/data/transactions";
import { listPropertyOptions, listLeaseOptions } from "@/lib/data/leases";
import { nominalOptions } from "@/lib/data/nominals";
import { getOptions } from "@/lib/data/options";
import { UnreconciledClient } from "./unreconciled-client";

export default async function UnreconciledPage() {
  const user = await requireUser();
  if (!can(user, "finance", "view")) redirect("/dashboard");

  const [transactions, properties, leases, nominals, options] = await Promise.all([
    listUnreconciledTransactions(),
    listPropertyOptions(),
    listLeaseOptions(),
    nominalOptions(),
    getOptions(["transaction_type", "transaction_category"]),
  ]);

  return (
    <UnreconciledClient
      transactions={transactions}
      properties={properties}
      leases={leases}
      nominals={nominals}
      options={options}
      canEdit={can(user, "finance", "edit")}
    />
  );
}
