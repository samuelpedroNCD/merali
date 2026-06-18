"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Check, Undo2, Loader2 } from "lucide-react";
import { Topbar } from "@/components/shell/topbar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/input";
import { FilterSelect } from "@/components/ui/filter-select";
import { gbp, fmtDate } from "@/lib/utils";
import { invoiceStatusTone as tone } from "@/lib/badge-tones";
import { markPaid, markUnpaid } from "./actions";

export type PaymentRow = {
  id: string;
  property: string | null;
  tenant: string | null;
  dueDate: string;
  amountDue: number;
  amountCollected: number;
  status: string;
};

export function PaymentsClient({
  rows,
  canEdit,
}: {
  rows: PaymentRow[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [propertyF, setPropertyF] = useState("");
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  const propertyOpts = useMemo(
    () => [...new Set(rows.map((r) => r.property).filter(Boolean) as string[])].sort().map((p) => ({ value: p, label: p })),
    [rows],
  );
  const filtered = useMemo(
    () => rows.filter((r) => {
      const q = query.trim().toLowerCase();
      const matchQ = !q || (r.property ?? "").toLowerCase().includes(q) || (r.tenant ?? "").toLowerCase().includes(q);
      return matchQ && (!status || r.status === status) && (!propertyF || r.property === propertyF);
    }),
    [rows, status, query, propertyF],
  );

  const summary = useMemo(() => {
    const due = rows.reduce((a, r) => a + r.amountDue, 0);
    const collected = rows.reduce((a, r) => a + r.amountCollected, 0);
    const overdue = rows
      .filter((r) => r.status === "Overdue")
      .reduce((a, r) => a + (r.amountDue - r.amountCollected), 0);
    return { due, collected, overdue };
  }, [rows]);

  function act(id: string, fn: (id: string) => Promise<{ ok: boolean; error?: string }>) {
    setBusyId(id);
    startTransition(async () => {
      const res = await fn(id);
      setBusyId(null);
      if (!res.ok) return toast.error(res.error ?? "Couldn't update the payment. Please try again.");
      toast.success("Payment updated.");
      router.refresh();
    });
  }

  return (
    <>
      <Topbar search="Search payments…" />
      <main className="flex flex-1 flex-col gap-[22px] overflow-y-auto thin-scroll px-[34px] py-[30px]">
        <div>
          <h1 className="text-[26px] font-semibold tracking-[-0.01em] text-text">Payments</h1>
          <p className="mt-[2px] text-[14px] text-muted">Rent schedule — what's due, paid and overdue.</p>
        </div>

        <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-3">
          <Card><p className="text-[15px] text-muted">Expected (all time)</p><p className="mt-2 font-display text-[28px] font-semibold text-text">{gbp(summary.due)}</p></Card>
          <Card><p className="text-[15px] text-muted">Collected</p><p className="mt-2 font-display text-[28px] font-semibold text-[var(--good)]">{gbp(summary.collected)}</p></Card>
          <Card><p className="text-[15px] text-muted">Overdue</p><p className="mt-2 font-display text-[28px] font-semibold text-[var(--bad)]">{gbp(summary.overdue)}</p></Card>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Input placeholder="Search property or tenant…" className="h-[44px] max-w-[360px]" value={query} onChange={(e) => setQuery(e.target.value)} />
          <Select className="h-[44px] max-w-[200px]" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option>Pending</option><option>Paid</option><option>Overdue</option><option>Partial</option>
          </Select>
          <FilterSelect value={propertyF} onChange={setPropertyF} placeholder="All properties" options={propertyOpts} />
        </div>

        <Card className="overflow-x-auto p-0">
          <div className="grid min-w-[720px] grid-cols-[1.6fr_1.2fr_1fr_0.9fr_0.9fr_auto] items-center gap-4 border-b border-border px-6 py-4 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">
            <span>Property</span><span>Tenant</span><span>Due date</span><span className="text-right">Amount</span><span>Status</span><span className="text-right">Action</span>
          </div>
          {filtered.length === 0 && (
            <div className="grid place-items-center py-16 text-center">
              <p className="text-[15px] font-medium text-text-2">No payments</p>
              <p className="mt-1 text-[15px] text-muted">Rent schedules appear here once a lease is created.</p>
            </div>
          )}
          {filtered.map((r) => (
            <div key={r.id} className="grid min-w-[720px] grid-cols-[1.6fr_1.2fr_1fr_0.9fr_0.9fr_auto] items-center gap-4 border-b border-border px-6 py-4 text-[14px] last:border-b-0">
              <span className="truncate font-medium text-text">{r.property || "—"}</span>
              <span className="truncate text-text-2">{r.tenant || "—"}</span>
              <span className="text-text-2">{fmtDate(r.dueDate)}</span>
              <span className="text-right font-display text-[16px] font-semibold text-text">{gbp(r.amountDue)}</span>
              <span><Badge tone={tone(r.status)} dot>{r.status}</Badge></span>
              <span className="flex justify-end">
                {canEdit && (
                  busyId === r.id && pending ? (
                    <span className="grid h-8 w-8 place-items-center"><Loader2 className="h-4 w-4 animate-spin text-muted" /></span>
                  ) : r.status === "Paid" ? (
                    <button onClick={() => act(r.id, markUnpaid)} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[12.5px] text-text-2 transition-colors hover:bg-surface-2/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40">
                      <Undo2 strokeWidth={1.6} className="h-[14px] w-[14px]" /> Undo
                    </button>
                  ) : (
                    <button onClick={() => act(r.id, markPaid)} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[12.5px] font-medium text-[var(--good)] transition-colors hover:bg-[color-mix(in_oklch,var(--good)_12%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40">
                      <Check strokeWidth={1.8} className="h-[14px] w-[14px]" /> Mark paid
                    </button>
                  )
                )}
              </span>
            </div>
          ))}
        </Card>
      </main>
    </>
  );
}
