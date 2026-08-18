import { notFound, redirect } from "next/navigation";
import { requireUser, can } from "@/lib/auth";
import { getBatch, listUnbatchedForBank } from "@/lib/data/receipt-batches";
import { bankAccountOptions } from "@/lib/data/bank-accounts";
import { listPropertyOptions } from "@/lib/data/leases";
import { nominalOptions } from "@/lib/data/nominals";
import { BatchDetailClient } from "./batch-detail-client";

export default async function BatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!can(user, "finance", "view")) redirect("/dashboard");
  const { id } = await params;

  const batch = await getBatch(id);
  if (!batch) notFound();

  const [banks, properties, nominals, unbatched] = await Promise.all([
    bankAccountOptions(),
    listPropertyOptions(),
    nominalOptions(),
    batch.bank_account_id ? listUnbatchedForBank(batch.bank_account_id) : Promise.resolve([]),
  ]);
  const shortRef = banks.find((b) => b.value === batch.bank_account_id)?.short_ref ?? null;

  return (
    <BatchDetailClient
      batch={batch}
      unbatched={unbatched}
      properties={properties}
      nominals={nominals}
      shortRef={shortRef}
      canEdit={can(user, "finance", "edit")}
    />
  );
}
