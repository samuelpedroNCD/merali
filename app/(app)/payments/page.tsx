import { requireUser, can } from "@/lib/auth";
import { listRentSchedule, effectiveStatus } from "@/lib/data/payments";
import { PaymentsClient, type PaymentRow } from "./payments-client";

export default async function PaymentsPage() {
  const user = await requireUser();
  const schedule = await listRentSchedule();
  const today = new Date();

  const rows: PaymentRow[] = schedule.map((r) => ({
    id: r.id,
    property: r.property?.address ?? null,
    tenant: r.tenant?.full_name ?? null,
    dueDate: r.due_date,
    amountDue: r.amount_due ?? 0,
    amountCollected: r.amount_collected ?? 0,
    status: effectiveStatus(r, today),
  }));

  return (
    <PaymentsClient
      rows={rows}
      canEdit={can(user, "finance", "edit")}
    />
  );
}
