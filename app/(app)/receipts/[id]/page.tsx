import { notFound, redirect } from "next/navigation";
import { requireUser, can } from "@/lib/auth";
import { getBatch, listUnbatchedForBank } from "@/lib/data/receipt-batches";
import { bankAccountOptions } from "@/lib/data/bank-accounts";
import { listPropertyOptions, listLeaseOptions } from "@/lib/data/leases";
import { nominalOptions } from "@/lib/data/nominals";
import { listRecentNarratives } from "@/lib/data/transactions";
import { BatchDetailClient } from "./batch-detail-client";

export default async function BatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!can(user, "finance", "view")) redirect("/dashboard");
  const { id } = await params;

  const batch = await getBatch(id);
  if (!batch) notFound();

  const [banks, properties, leases, nominals, narratives, unbatched] = await Promise.all([
    bankAccountOptions(),
    listPropertyOptions(),
    listLeaseOptions(),
    nominalOptions(),
    listRecentNarratives(),
    batch.bank_account_id ? listUnbatchedForBank(batch.bank_account_id) : Promise.resolve([]),
  ]);
  const shortRef = banks.find((b) => b.value === batch.bank_account_id)?.short_ref ?? null;

  return (
    <BatchDetailClient
      batch={batch}
      unbatched={unbatched}
      properties={properties}
      leases={leases}
      nominals={nominals}
      narratives={narratives}
      shortRef={shortRef}
      canEdit={can(user, "finance", "edit")}
    />
  );
}
