import { redirect } from "next/navigation";
import { requireUser, can } from "@/lib/auth";
import { listBatches } from "@/lib/data/receipt-batches";
import { bankAccountOptions } from "@/lib/data/bank-accounts";
import { ReceiptsClient } from "./receipts-client";

export default async function ReceiptsPage() {
  const user = await requireUser();
  if (!can(user, "finance", "view")) redirect("/dashboard");

  const [batches, banks] = await Promise.all([listBatches(), bankAccountOptions()]);
  return <ReceiptsClient batches={batches} banks={banks} canEdit={can(user, "finance", "edit")} />;
}
