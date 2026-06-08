import { notFound } from "next/navigation";
import { requireUser, can } from "@/lib/auth";
import { getLease, getLeaseSchedule, getLeaseTransactions } from "@/lib/data/leases";
import { LeaseDetail } from "./lease-detail";

export default async function LeaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const [lease, schedule, ledger] = await Promise.all([
    getLease(id),
    getLeaseSchedule(id),
    getLeaseTransactions(id),
  ]);
  if (!lease) notFound();
  return <LeaseDetail lease={lease} schedule={schedule} ledger={ledger} canCreate={can(user, "leases", "create")} />;
}
