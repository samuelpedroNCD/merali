import { requireUser, can } from "@/lib/auth";
import { listTransactions, getLedgerTotals } from "@/lib/data/transactions";
import { listPropertyOptions, listLeaseOptions } from "@/lib/data/leases";
import { getOptions } from "@/lib/data/options";
import { nominalOptions } from "@/lib/data/nominals";
import { bankAccountOptions } from "@/lib/data/bank-accounts";
import { NominalClient } from "./nominal-client";

export default async function NominalPage() {
  const user = await requireUser();
  const [transactions, totals, properties, leases, options, nominals, banks] = await Promise.all([
    listTransactions(),
    getLedgerTotals(),
    listPropertyOptions(),
    listLeaseOptions(),
    getOptions(["transaction_type", "transaction_category", "vat_rate", "invoice_status"]),
    nominalOptions(),
    bankAccountOptions(),
  ]);

  return (
    <NominalClient
      transactions={transactions}
      totals={totals}
      properties={properties}
      leases={leases}
      options={options}
      nominals={nominals}
      banks={banks}
      perms={{
        create: can(user, "finance", "create"),
        edit: can(user, "finance", "edit"),
        remove: can(user, "finance", "delete"),
      }}
    />
  );
}
