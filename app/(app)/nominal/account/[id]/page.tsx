import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser, can } from "@/lib/auth";
import { Topbar } from "@/components/shell/topbar";
import { Card } from "@/components/ui/card";
import { getNominalActivity } from "@/lib/data/nominal-ledger";
import { gbp, fmtDate } from "@/lib/utils";

export default async function NominalAccountPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ asOf?: string; landlord?: string }>;
}) {
  const user = await requireUser();
  if (!can(user, "finance", "view")) redirect("/dashboard");
  const { id } = await params;
  const sp = await searchParams;

  const activity = await getNominalActivity(id, { to: sp.asOf || null, landlordId: sp.landlord || null });
  if (!activity) notFound();

  const backHref = `/nominal/trial-balance?asOf=${sp.asOf ?? ""}${sp.landlord ? `&landlord=${sp.landlord}` : ""}`;

  return (
    <>
      <Topbar search="Search…" />
      <main className="flex flex-1 flex-col gap-[22px] overflow-y-auto thin-scroll px-[34px] py-[30px]">
        <Link href={backHref} className="inline-flex items-center gap-2 text-[15px] font-medium text-muted hover:text-accent">
          <ArrowLeft strokeWidth={1.6} className="h-4 w-4" /> Trial balance
        </Link>

        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-[26px] font-semibold tracking-[-0.01em] text-text">
              <span className="font-mono text-text-2">{activity.code}</span> {activity.name}
            </h1>
            <p className="mt-[2px] text-[14px] text-muted">
              {activity.rows.length} entr{activity.rows.length === 1 ? "y" : "ies"}
              {sp.asOf ? ` up to ${fmtDate(sp.asOf)}` : ""}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[12px] uppercase tracking-[0.14em] text-muted">Balance</p>
            <p className={`font-display text-[26px] font-semibold ${activity.closing >= 0 ? "text-text" : "text-[var(--bad)]"}`}>
              {gbp(Math.abs(activity.closing))} {activity.closing >= 0 ? "Dr" : "Cr"}
            </p>
          </div>
        </div>

        <Card className="overflow-x-auto p-0">
          <div className="grid min-w-[760px] grid-cols-[1fr_2fr_1fr_1fr_1fr] gap-4 border-b border-border px-6 py-4 text-[11.5px] font-semibold uppercase tracking-[0.05em] text-muted">
            <span>Date</span><span>Description</span><span className="text-right">Debit</span><span className="text-right">Credit</span><span className="text-right">Balance</span>
          </div>
          {activity.rows.length === 0 ? (
            <p className="px-6 py-10 text-center text-[15px] text-muted">No entries for this nominal.</p>
          ) : (
            activity.rows.map((r, i) => (
              <div key={i} className="grid min-w-[760px] grid-cols-[1fr_2fr_1fr_1fr_1fr] items-center gap-4 border-b border-border px-6 py-3 text-[13.5px] last:border-b-0">
                <span className="text-text-2">{r.entry_date ? fmtDate(r.entry_date) : "—"}</span>
                <span className="truncate text-text-2">{r.description || r.source || "—"}</span>
                <span className="text-right tabular-nums text-text">{r.debit ? gbp(r.debit) : ""}</span>
                <span className="text-right tabular-nums text-text">{r.credit ? gbp(r.credit) : ""}</span>
                <span className="text-right tabular-nums text-muted">{gbp(Math.abs(r.running))} {r.running >= 0 ? "Dr" : "Cr"}</span>
              </div>
            ))
          )}
        </Card>
      </main>
    </>
  );
}
