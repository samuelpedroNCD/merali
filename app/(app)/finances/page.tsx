import Link from "next/link";
import {
  PoundSterling,
  TrendingDown,
  Wallet,
  Gauge,
  AlertCircle,
} from "lucide-react";
import { Topbar } from "@/components/shell/topbar";
import { Card, CardHeader } from "@/components/ui/card";
import { Stat } from "@/components/ui/stat";
import { VatExportButton } from "./vat-export";
import { CashflowChart } from "@/components/charts/cashflow-chart";
import { LinkBankButton } from "@/components/plaid/link-bank-button";
import { gbp, fmtDate } from "@/lib/utils";
import { requireUser } from "@/lib/auth";
import { getFinanceData } from "@/lib/data/finances";

export default async function FinancesPage() {
  await requireUser();
  const d = await getFinanceData();

  return (
    <>
      <Topbar search="Search…" action={<LinkBankButton />} />
      <main className="flex flex-1 flex-col gap-[22px] overflow-y-auto thin-scroll px-[34px] py-[30px]">
        <div>
          <h1 className="text-[26px] font-semibold tracking-[-0.01em] text-text">Finance</h1>
          <p className="mt-[2px] text-[14px] text-muted">Financial overview and reporting.</p>
        </div>

        <div className="grid grid-cols-2 gap-[18px] lg:grid-cols-5">
          <Stat label="Total income" value={gbp(d.totalIncome)} icon={PoundSterling} />
          <Stat label="Total outgoings" value={`-${gbp(d.totalOutgoings)}`} icon={TrendingDown} />
          <Stat label="Net cashflow" value={gbp(d.netCashflow)} icon={Wallet} />
          <Stat label="Rent collected" value={`${d.rentCollectedPct}%`} sub={gbp(d.rentCollected)} icon={Gauge} />
          <Stat label="Overdue" value={gbp(d.overdue)} icon={AlertCircle} goodWhenUp={false} />
        </div>

        <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-[1.7fr_1fr]">
          <Card>
            <CardHeader
              title="Cashflow over time"
              action={
                <div className="flex items-center gap-3 text-[12px] text-muted">
                  <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-gold" /> In</span>
                  <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[var(--bad)]" /> Out</span>
                </div>
              }
            />
            <CashflowChart data={d.cashflow} />
          </Card>

          <Card>
            <CardHeader title="VAT position" action={<VatExportButton rows={d.vatByQuarter} />} />
            <div className="flex flex-col gap-3">
              <VatRow label="VAT collected (on income)" value={gbp(d.vatCollected)} />
              <VatRow label="VAT paid (on expenses)" value={`-${gbp(d.vatPaid)}`} />
              <div className="mt-1 flex items-center justify-between border-t border-border pt-3">
                <span className="text-[15px] font-semibold text-text">Net VAT due</span>
                <span className="font-display text-[22px] font-semibold text-text">{gbp(d.vatNet)}</span>
              </div>
              <p className="text-[12px] text-muted">
                VAT-return-style summary. HMRC/MTD submission is out of scope for now.
              </p>
            </div>
          </Card>
        </div>

        <Card className="p-0">
          <div className="flex items-center justify-between px-6 py-4">
            <h3 className="text-[16px] font-semibold text-text">Recent transactions</h3>
            <Link href="/nominal" className="text-[15px] font-semibold text-accent">Open ledger</Link>
          </div>
          <div className="grid grid-cols-[0.9fr_1.6fr_0.8fr_1fr_0.9fr_0.7fr] items-center gap-3 border-y border-border px-6 py-3 text-[11.5px] font-semibold uppercase tracking-[0.05em] text-muted">
            <span>Date</span><span>Property</span><span>Type</span><span>Category</span><span className="text-right">Amount</span><span>Status</span>
          </div>
          {d.recent.length === 0 && (
            <div className="grid place-items-center py-16 text-center">
              <p className="text-[15px] text-muted">No transactions yet — add one in the Nominal ledger.</p>
            </div>
          )}
          {d.recent.map((t) => (
            <div key={t.id} className="grid grid-cols-[0.9fr_1.6fr_0.8fr_1fr_0.9fr_0.7fr] items-center gap-3 border-b border-border px-6 py-3 text-[13.5px] last:border-b-0">
              <span className="text-text-2">{t.date ? fmtDate(t.date) : "—"}</span>
              <span className="truncate text-text-2">{t.property || "—"}</span>
              <span className={t.type === "Income" ? "text-[var(--good)]" : "text-[var(--bad)]"}>{t.type || "—"}</span>
              <span className="truncate text-text-2">{t.category || "—"}</span>
              <span className="text-right font-semibold text-text">{gbp(t.gross)}</span>
              <span className="text-text-2">{t.status || "—"}</span>
            </div>
          ))}
        </Card>
      </main>
    </>
  );
}

function VatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[15px] text-text-2">{label}</span>
      <span className="text-[14px] font-medium text-text">{value}</span>
    </div>
  );
}
