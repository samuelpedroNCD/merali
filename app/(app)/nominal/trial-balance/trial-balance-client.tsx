"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";
import { Topbar } from "@/components/shell/topbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { FilterSelect } from "@/components/ui/filter-select";
import { gbp, fmtDate } from "@/lib/utils";
import { toCsv } from "@/lib/csv";
import type { TrialBalance } from "@/lib/finance/trial-balance";

export function TrialBalanceClient({
  tb,
  asOf,
  landlordId,
  entityId,
  landlords,
  entities,
}: {
  tb: TrialBalance;
  asOf: string;
  landlordId: string | null;
  entityId: string | null;
  landlords: { value: string; label: string }[];
  entities: { value: string; label: string }[];
}) {
  const router = useRouter();

  function go(next: { asOf?: string; landlord?: string | null; entity?: string | null }) {
    const params = new URLSearchParams();
    params.set("asOf", next.asOf ?? asOf);
    const ll = next.landlord === undefined ? landlordId : next.landlord;
    const en = next.entity === undefined ? entityId : next.entity;
    if (ll) params.set("landlord", ll);
    if (en) params.set("entity", en);
    router.push(`/nominal/trial-balance?${params.toString()}`);
  }

  function exportCsv() {
    const header = ["Code", "Name", "Class", "Debit", "Credit"];
    const rows = tb.rows.map((r) => [r.code, r.name, r.nominal_class ?? "", r.debit || "", r.credit || ""]);
    rows.push(["", "", "Total", tb.totalDebit, tb.totalCredit]);
    const csv = toCsv(header, rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trial-balance-${asOf}${landlordId ? "-landlord" : ""}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const activity = !!landlordId; // a landlord filter is an activity view, not a balancing TB

  return (
    <>
      <Topbar search="Search…" />
      <main className="flex flex-1 flex-col gap-[22px] overflow-y-auto thin-scroll px-[34px] py-[30px]">
        <Link href="/nominal" className="inline-flex items-center gap-2 text-[15px] font-medium text-muted hover:text-accent">
          <ArrowLeft strokeWidth={1.6} className="h-4 w-4" /> Nominal ledger
        </Link>

        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-[26px] font-semibold tracking-[-0.01em] text-text">Trial balance</h1>
            <p className="mt-[2px] text-[14px] text-muted">
              As at {fmtDate(asOf)} · {landlordId ? "one landlord (activity view)" : (entities.find((e) => e.value === entityId)?.label ?? "all companies")}
            </p>
          </div>
          <Button size="toolbar" variant="ghost" className="gap-[6px]" onClick={exportCsv} disabled={tb.rows.length === 0}>
            <Download strokeWidth={1.6} className="h-[16px] w-[16px]" /> Export CSV
          </Button>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-[12.5px] font-medium text-muted">
            As at date
            <Input type="date" value={asOf} onChange={(e) => go({ asOf: e.target.value })} className="h-[44px] w-auto" />
          </label>
          <FilterSelect value={entityId ?? ""} onChange={(v) => go({ entity: v || null })} placeholder="All companies" options={entities} />
          <FilterSelect value={landlordId ?? ""} onChange={(v) => go({ landlord: v || null })} placeholder="All landlords" options={landlords} />
          {tb.rows.length > 0 && (
            <Badge tone={tb.balanced ? "good" : "warn"} dot>
              {tb.balanced ? "Balanced" : "Activity view — does not balance"}
            </Badge>
          )}
        </div>

        {activity && (
          <p className="text-[13px] text-muted">
            A landlord filter shows that landlord&rsquo;s activity by nominal. The bank and VAT sides of each
            entry aren&rsquo;t landlord-tagged, so this view is not expected to balance — use the all-companies
            view for a balancing trial balance.
          </p>
        )}

        <Card className="overflow-x-auto p-0">
          <div className="grid min-w-[720px] grid-cols-[0.8fr_2fr_1fr_1fr_1fr] gap-4 border-b border-border px-6 py-4 text-[11.5px] font-semibold uppercase tracking-[0.05em] text-muted">
            <span>Code</span><span>Nominal</span><span>Class</span><span className="text-right">Debit</span><span className="text-right">Credit</span>
          </div>
          {tb.rows.length === 0 ? (
            <p className="px-6 py-10 text-center text-[15px] text-muted">No journal activity on or before this date.</p>
          ) : (
            <>
              {tb.rows.map((r) => (
                <Link
                  key={r.nominal_id}
                  href={`/nominal/account/${r.nominal_id}?asOf=${asOf}${landlordId ? `&landlord=${landlordId}` : ""}${entityId ? `&entity=${entityId}` : ""}`}
                  className="grid min-w-[720px] cursor-pointer grid-cols-[0.8fr_2fr_1fr_1fr_1fr] items-center gap-4 border-b border-border px-6 py-3 text-[13.5px] transition-colors last:border-b-0 hover:bg-surface-2/40"
                >
                  <span className="font-mono text-text-2">{r.code}</span>
                  <span className="truncate font-medium text-text">{r.name}</span>
                  <span className="text-muted">{r.nominal_class ?? "—"}</span>
                  <span className="text-right tabular-nums text-text">{r.debit ? gbp(r.debit) : ""}</span>
                  <span className="text-right tabular-nums text-text">{r.credit ? gbp(r.credit) : ""}</span>
                </Link>
              ))}
              <div className="grid min-w-[720px] grid-cols-[0.8fr_2fr_1fr_1fr_1fr] items-center gap-4 border-t-2 border-border px-6 py-4 text-[14px] font-semibold">
                <span></span><span>Total</span><span></span>
                <span className="text-right tabular-nums">{gbp(tb.totalDebit)}</span>
                <span className="text-right tabular-nums">{gbp(tb.totalCredit)}</span>
              </div>
            </>
          )}
        </Card>
      </main>
    </>
  );
}
