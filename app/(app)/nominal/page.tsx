import { requireUser, can } from "@/lib/auth";
import { listTransactions, getLedgerTotals } from "@/lib/data/transactions";
import { listPropertyOptions } from "@/lib/data/leases";
import { getOptions } from "@/lib/data/options";
import { NominalClient } from "./nominal-client";

export default async function NominalPage() {
  const user = await requireUser();
  const [transactions, totals, properties, options] = await Promise.all([
    listTransactions(),
    getLedgerTotals(),
    listPropertyOptions(),
    getOptions(["transaction_type", "transaction_category", "vat_rate", "invoice_status"]),
  ]);

  return (
    <NominalClient
      transactions={transactions}
      totals={totals}
      properties={properties}
      options={options}
      perms={{
        create: can(user, "finance", "create"),
        edit: can(user, "finance", "edit"),
        remove: can(user, "finance", "delete"),
      }}
    />
  );
}
