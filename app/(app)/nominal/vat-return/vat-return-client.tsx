"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";
import { Topbar } from "@/components/shell/topbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FilterSelect } from "@/components/ui/filter-select";
import { gbp, fmtDate } from "@/lib/utils";
import { toCsv } from "@/lib/csv";
import type { VatReturn } from "@/lib/finance/vat";
import type { VatReturnTxn } from "@/lib/data/vat-return";

const BOXES: { key: keyof VatReturn; label: string }[] = [
  { key: "box1", label: "Box 1 — VAT due on sales (output VAT)" },
  { key: "box4", label: "Box 4 — VAT reclaimed on purchases (input VAT)" },
  { key: "box5", label: "Box 5 — Net VAT to pay / reclaim" },
  { key: "box6", label: "Box 6 — Total sales, excluding VAT" },
  { key: "box7", label: "Box 7 — Total purchases, excluding VAT" },
];

export function VatReturnClient({
  ret,
  txns,
  from,
  to,
  entityId,
  entities,
}: {
  ret: VatReturn;
  txns: VatReturnTxn[];
  from: string;
  to: string;
  entityId: string | null;
  entities: { value: string; label: string }[];
}) {
  const router = useRouter();

  function go(next: { from?: string; to?: string; entity?: string | null }) {
    const p = new URLSearchParams();
    p.set("from", next.from ?? from);
    p.set("to", next.to ?? to);
    const en = next.entity === undefined ? entityId : next.entity;
    if (en) p.set("entity", en);
    router.push(`/nominal/vat-return?${p.toString()}`);
  }

  function exportCsv() {
    const head = ["Box", "Amount"];
    const rows: unknown[][] = BOXES.map((b) => [b.label, ret[b.key]]);
    rows.push([]);
    rows.push(["Date", "Type", "Property", "Net", "VAT", "Gross", "Reference"]);
    txns.forEach((t) => rows.push([t.txn_date ?? "", t.type ?? "", t.property ?? "", t.amount_net ?? "", t.vat_amount ?? "", t.amount_gross ?? "", t.reference ?? ""]));
    const csv = toCsv(head, rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vat-return-${from}-to-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const net = ret.box5;

  return (
    <>
      <Topbar search="Search…" />
      <main className="flex flex-1 flex-col gap-[22px] overflow-y-auto thin-scroll px-[34px] py-[30px]">
        <Link href="/nominal" className="inline-flex items-center gap-2 text-[15px] font-medium text-muted hover:text-accent">
          <ArrowLeft strokeWidth={1.6} className="h-4 w-4" /> Nominal ledger
        </Link>

        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-[26px] font-semibold tracking-[-0.01em] text-text">VAT return</h1>
            <p className="mt-[2px] text-[14px] text-muted">
              {fmtDate(from)} – {fmtDate(to)} · {entities.find((e) => e.value === entityId)?.label ?? "all companies"} · figures for your accountant (not filed)
            </p>
          </div>
          <Button size="toolbar" variant="ghost" className="gap-[6px]" onClick={exportCsv}>
            <Download strokeWidth={1.6} className="h-[16px] w-[16px]" /> Export CSV
          </Button>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-[12.5px] font-medium text-muted">From
            <Input type="date" value={from} onChange={(e) => go({ from: e.target.value })} className="h-[44px] w-auto" />
          </label>
          <label className="flex flex-col gap-1 text-[12.5px] font-medium text-muted">To
            <Input type="date" value={to} onChange={(e) => go({ to: e.target.value })} className="h-[44px] w-auto" />
          </label>
          <FilterSelect value={entityId ?? ""} onChange={(v) => go({ entity: v || null })} placeholder="All companies" options={entities} />
        </div>

        <Card className={`border-2 ${net > 0 ? "border-[var(--bad)]/40" : net < 0 ? "border-[var(--good)]/40" : "border-border"}`}>
          <p className="text-[15px] text-muted">Net VAT {net > 0 ? "payable to HMRC" : net < 0 ? "to reclaim" : ""}</p>
          <p className={`mt-2 font-display text-[30px] font-semibold ${net > 0 ? "text-[var(--bad)]" : net < 0 ? "text-[var(--good)]" : "text-text"}`}>{gbp(Math.abs(net))}</p>
        </Card>

        <Card className="overflow-x-auto p-0">
          <div className="grid grid-cols-[1fr_auto] gap-4 border-b border-border px-6 py-4 text-[11.5px] font-semibold uppercase tracking-[0.05em] text-muted">
            <span>Box</span><span className="text-right">Amount</span>
          </div>
          {BOXES.map((b) => (
            <div key={b.key} className={`grid grid-cols-[1fr_auto] items-center gap-4 border-b border-border px-6 py-3 text-[14px] last:border-b-0 ${b.key === "box5" ? "font-semibold" : ""}`}>
              <span className="text-text-2">{b.label}</span>
              <span className="text-right tabular-nums text-text">{gbp(ret[b.key])}</span>
            </div>
          ))}
        </Card>

        <Card className="overflow-x-auto p-0">
          <div className="px-6 py-4 text-[16px] font-semibold text-text">VAT transactions ({txns.length})</div>
          <div className="grid min-w-[820px] grid-cols-[1fr_0.8fr_1.6fr_0.9fr_0.9fr_0.9fr] gap-4 border-y border-border px-6 py-3 text-[11.5px] font-semibold uppercase tracking-[0.05em] text-muted">
            <span>Date</span><span>Type</span><span>Property / ref</span><span className="text-right">Net</span><span className="text-right">VAT</span><span className="text-right">Gross</span>
          </div>
          {txns.length === 0 ? (
            <p className="px-6 py-8 text-center text-[15px] text-muted">No VAT-bearing transactions in this period.</p>
          ) : (
            txns.map((t) => (
              <div key={t.id} className="grid min-w-[820px] grid-cols-[1fr_0.8fr_1.6fr_0.9fr_0.9fr_0.9fr] items-center gap-4 border-b border-border px-6 py-[10px] text-[13.5px] last:border-b-0">
                <span className="text-text-2">{t.txn_date ? fmtDate(t.txn_date) : "—"}</span>
                <span className={t.type === "Income" ? "text-[var(--good)]" : "text-[var(--bad)]"}>{t.type || "—"}</span>
                <span className="truncate text-text-2">{[t.property, t.reference].filter(Boolean).join(" · ") || "—"}</span>
                <span className="text-right tabular-nums text-text-2">{t.amount_net != null ? gbp(t.amount_net) : "—"}</span>
                <span className="text-right tabular-nums font-medium text-text">{t.vat_amount != null ? gbp(t.vat_amount) : "—"}</span>
                <span className="text-right tabular-nums text-text-2">{t.amount_gross != null ? gbp(t.amount_gross) : "—"}</span>
              </div>
            ))
          )}
        </Card>
      </main>
    </>
  );
}
