import { redirect } from "next/navigation";
import { requireUser, can } from "@/lib/auth";
import { listBankAccounts, listEntities } from "@/lib/data/bank-accounts";
import { BankAccountsClient } from "./bank-accounts-client";

export default async function BankAccountsPage() {
  const user = await requireUser();
  if (!can(user, "finance", "view")) redirect("/dashboard");

  const [accounts, entities] = await Promise.all([listBankAccounts(), listEntities()]);
  return <BankAccountsClient accounts={accounts} entities={entities} canEdit={can(user, "finance", "edit")} />;
}
