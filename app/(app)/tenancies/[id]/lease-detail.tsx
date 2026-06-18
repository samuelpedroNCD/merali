"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Pencil, RefreshCw, UserRound, Building2 } from "lucide-react";
import { Topbar } from "@/components/shell/topbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge, type Tone } from "@/components/ui/badge";
import { Select } from "@/components/ui/input";
import { tenancyStatus, tenancyStatusTone } from "@/lib/tenancy-status";
import { gbp, fmtDate } from "@/lib/utils";
import type { LeaseRow, LeaseScheduleRow, LeaseTxnRow } from "@/lib/data/leases";

const schedTone = (r: LeaseScheduleRow): Tone => {
  if (r.invoice_status === "Paid") return "good";
  if (Number(r.amount_collected) > 0) return "warn";
  if (r.due_date < new Date().toISOString().slice(0, 10)) return "bad";
  return "muted";
};
const effStatus = (r: LeaseScheduleRow) => {
  if (r.invoice_status === "Paid") return "Paid";
  if (Number(r.amount_collected) > 0) return "Partial";
  if (r.due_date < new Date().toISOString().slice(0, 10)) return "Overdue";
  return "Pending";
};

export function LeaseDetail({
  lease: l,
  schedule,
  ledger,
  canCreate,
}: {
  lease: LeaseRow;
  schedule: LeaseScheduleRow[];
  ledger: LeaseTxnRow[];
  canCreate: boolean;
}) {
  const [yearFilter, setYearFilter] = useState("");

  const years = useMemo(
    () => Array.from(new Set(schedule.map((s) => s.due_date.slice(0, 4)))).sort(),
    [schedule],
  );
  const rows = schedule.filter((s) => !yearFilter || s.due_date.startsWith(yearFilter));
  const totals = useMemo(() => {
    const due = schedule.reduce((a, s) => a + Number(s.amount_due), 0);
    const collected = schedule.reduce((a, s) => a + Number(s.amount_collected), 0);
    const rentOutstanding = due - collected;
    // Linked nominals/finances: expenses (charges/deductions) add to what's owed,
    // income (extra payments) reduces it. Rent itself lives in the schedule above.
    const charges = ledger
      .filter((t) => t.type === "Expense")
      .reduce((a, t) => a + Number(t.amount_gross ?? 0), 0);
    const payments = ledger
      .filter((t) => t.type === "Income")
      .reduce((a, t) => a + Number(t.amount_gross ?? 0), 0);
    return {
      due,
      collected,
      outstanding: rentOutstanding,
      charges,
      payments,
      // Positive = tenant owes; negative = in credit.
      balance: rentOutstanding + charges - payments,
    };
  }, [schedule, ledger]);

  return (
    <>
      <Topbar
        search="Search…"
        action={
          <div className="flex items-center gap-2">
            {canCreate && (
              <Link href={`/tenancies?renew=${l.id}`}>
                <Button size="toolbar" className="gap-[6px]">
                  <RefreshCw strokeWidth={1.6} className="h-[16px] w-[16px]" /> Renew lease
                </Button>
              </Link>
            )}
            <Link href={`/tenancies?edit=${l.id}`}>
              <Button variant="ghost" size="toolbar" className="gap-[6px]">
                <Pencil strokeWidth={1.6} className="h-[16px] w-[16px]" /> Edit
              </Button>
            </Link>
          </div>
        }
      />
      <main className="flex flex-1 flex-col gap-[22px] overflow-y-auto thin-scroll px-[34px] py-[30px]">
        <Link href="/tenancies" className="inline-flex items-center gap-2 text-[15px] font-medium text-muted hover:text-accent">
          <ArrowLeft strokeWidth={1.6} className="h-4 w-4" /> All tenancies
        </Link>

        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="font-display text-[30px] font-semibold tracking-[-0.01em] text-text">
              {l.tenancy_code || l.tenant?.full_name || "Tenancy"}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[15px] text-text-2">
              <Link href={l.property ? `/properties/${l.property.id}` : "#"} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 hover:bg-surface-2/60">
                <Building2 strokeWidth={1.6} className="h-[14px] w-[14px]" /> {l.property?.address || "—"}
              </Link>
              {(l.tenants.length ? l.tenants : l.tenant ? [{ id: l.tenant.id, name: l.tenant.full_name, is_lead: true }] : []).map((t) => (
                <Link key={t.id} href={`/tenants/${t.id}`} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 hover:bg-surface-2/60">
                  <UserRound strokeWidth={1.6} className="h-[14px] w-[14px]" /> {t.name || "—"}{t.is_lead && l.tenants.length > 1 ? <span className="text-[11px] text-muted">(lead)</span> : null}
                </Link>
              ))}
              {(() => { const s = tenancyStatus(l); return <Badge tone={tenancyStatusTone(s)} dot>{s}</Badge>; })()}
            </div>
            <p className="mt-3 text-[15px] text-muted">
              {l.start_date ? fmtDate(l.start_date) : "—"} → {l.end_date ? fmtDate(l.end_date) : "—"}
              {l.payment_frequency ? ` · ${l.payment_frequency}` : ""}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[12px] uppercase tracking-[0.14em] text-muted">Rent</p>
            <p className="font-display text-[28px] font-semibold text-text">{l.rent_amount != null ? gbp(l.rent_amount) : "—"}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-[18px] lg:grid-cols-4">
          <Card className="border-accent/40 bg-accent/[0.04]">
            <p className="text-[15px] text-muted">Balance</p>
            <p className={`mt-2 font-display text-[26px] font-semibold ${totals.balance > 0 ? "text-[var(--bad)]" : totals.balance < 0 ? "text-[var(--good)]" : "text-text"}`}>
              {gbp(Math.abs(totals.balance))}
            </p>
            <p className="mt-1 text-[12px] text-muted">
              {totals.balance > 0 ? "Owed by tenant" : totals.balance < 0 ? "In credit" : "Settled"} · rent outstanding + charges − payments
            </p>
          </Card>
          <Card><p className="text-[15px] text-muted">Total scheduled</p><p className="mt-2 font-display text-[24px] font-semibold text-text">{gbp(totals.due)}</p></Card>
          <Card><p className="text-[15px] text-muted">Collected</p><p className="mt-2 font-display text-[24px] font-semibold text-[var(--good)]">{gbp(totals.collected)}</p></Card>
          <Card><p className="text-[15px] text-muted">Rent outstanding</p><p className="mt-2 font-display text-[24px] font-semibold text-[var(--bad)]">{gbp(totals.outstanding)}</p></Card>
        </div>

        <Card className="p-0">
          <div className="flex items-center justify-between px-6 py-4">
            <h3 className="text-[16px] font-semibold text-text">Rent schedule ({schedule.length})</h3>
            {years.length > 1 && (
              <Select className="h-[40px] max-w-[140px]" value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
                <option value="">All years</option>
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </Select>
            )}
          </div>
          <div className="grid grid-cols-[1fr_1fr_1fr_0.8fr] gap-4 border-y border-border px-6 py-3 text-[11.5px] font-semibold uppercase tracking-[0.05em] text-muted">
            <span>Due date</span><span className="text-right">Due</span><span className="text-right">Collected</span><span>Status</span>
          </div>
          {rows.length === 0 ? (
            <p className="px-6 py-8 text-center text-[15px] text-muted">No instalments.</p>
          ) : (
            rows.map((r) => (
              <div key={r.id} className="grid grid-cols-[1fr_1fr_1fr_0.8fr] items-center gap-4 border-b border-border px-6 py-[10px] text-[13.5px] last:border-b-0">
                <span className="text-text-2">{fmtDate(r.due_date)}</span>
                <span className="text-right text-text-2">{gbp(Number(r.amount_due))}</span>
                <span className="text-right text-text-2">{gbp(Number(r.amount_collected))}</span>
                <span><Badge tone={schedTone(r)} dot>{effStatus(r)}</Badge></span>
              </div>
            ))
          )}
        </Card>

        {/* Ledger — transactions linked to this tenancy */}
        <Card className="p-0">
          <div className="px-6 py-4 text-[16px] font-semibold text-text">Ledger ({ledger.length})</div>
          <div className="grid grid-cols-[0.9fr_0.7fr_1.3fr_1fr_0.8fr_0.8fr] gap-3 border-y border-border px-6 py-3 text-[11.5px] font-semibold uppercase tracking-[0.05em] text-muted">
            <span>Date</span><span>Type</span><span>Nominal</span><span>Category</span><span className="text-right">Amount</span><span>Status</span>
          </div>
          {ledger.length === 0 ? (
            <p className="px-6 py-8 text-center text-[15px] text-muted">No transactions linked to this tenancy yet.</p>
          ) : (
            ledger.map((t) => (
              <div key={t.id} className="grid grid-cols-[0.9fr_0.7fr_1.3fr_1fr_0.8fr_0.8fr] items-center gap-3 border-b border-border px-6 py-[10px] text-[13.5px] last:border-b-0">
                <span className="text-text-2">{t.txn_date ? fmtDate(t.txn_date) : "—"}</span>
                <span className={t.type === "Income" ? "text-[var(--good)]" : "text-[var(--bad)]"}>{t.type || "—"}</span>
                <span className="truncate text-text-2">{t.nominal || "—"}</span>
                <span className="truncate text-text-2">{t.category || "—"}</span>
                <span className="text-right font-semibold text-text">{t.amount_gross != null ? gbp(t.amount_gross) : "—"}</span>
                <span className="text-text-2">{t.status || "—"}</span>
              </div>
            ))
          )}
        </Card>
      </main>
    </>
  );
}
