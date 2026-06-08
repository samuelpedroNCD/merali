import { notFound } from "next/navigation";
import { requireUser, can } from "@/lib/auth";
import { getLease, getLeaseSchedule } from "@/lib/data/leases";
import { LeaseDetail } from "./lease-detail";

export default async function LeaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const [lease, schedule] = await Promise.all([getLease(id), getLeaseSchedule(id)]);
  if (!lease) notFound();
  return <LeaseDetail lease={lease} schedule={schedule} canCreate={can(user, "leases", "create")} />;
}
