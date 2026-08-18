"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, BellOff, Bell } from "lucide-react";
import { Topbar } from "@/components/shell/topbar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { FilterSelect } from "@/components/ui/filter-select";
import { useToast } from "@/components/ui/toast";
import { tenancyStatusTone } from "@/lib/tenancy-status";
import { gbp, fmtDate } from "@/lib/utils";
import type { TenancyBalance } from "@/lib/data/credit-control";
import { setChasing } from "./actions";

export function CreditControlClient({
  balances,
  canEdit,
  emailOn,
}: {
  balances: TenancyBalance[];
  canEdit: boolean;
  emailOn: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [landlordF, setLandlordF] = useState("");
  const [statusF, setStatusF] = useState("");
  const [signF, setSignF] = useState("owing"); // default to bad debt
  const [busy, setBusy] = useState<string | null>(null);
  const [, start] = useTransition();

  const landlords = useMemo(() => {
    const m = new Map<string, string>();
    balances.forEach((b) => { if (b.landlord_id) m.set(b.landlord_id, b.landlord ?? "—"); });
    return [...m].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [balances]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return balances
      .filter((b) => {
        const matchQ = !q || `${b.tenant ?? ""} ${b.property ?? ""}`.toLowerCase().includes(q);
        const matchLL = !landlordF || b.landlord_id === landlordF;
        const matchStatus = !statusF || b.status === statusF;
        const matchSign =
          signF === "owing" ? b.outstanding > 0 :
          signF === "credit" ? b.outstanding < 0 :
          true;
        return matchQ && matchLL && matchStatus && matchSign;
      })
      .sort((a, b) => b.outstanding - a.outstanding);
  }, [balances, query, landlordF, statusF, signF]);

  const totalOwed = useMemo(() => rows.reduce((a, r) => a + Math.max(r.outstanding, 0), 0), [rows]);

  function toggle(b: TenancyBalance) {
    setBusy(b.lease_id);
    start(async () => {
      const res = await setChasing(b.lease_id, !b.chasing_enabled);
      setBusy(null);
      if (!res.ok) return toast.error(res.error);
      toast.success(b.chasing_enabled ? "Chasing paused." : "Chasing enabled.");
      router.refresh();
    });
  }

  return (
    <>
      <Topbar search="Search…" />
      <main className="flex flex-1 flex-col gap-[22px] overflow-y-auto thin-scroll px-[34px] py-[30px]">
        <div>
          <h1 className="text-[26px] font-semibold tracking-[-0.01em] text-text">Credit control</h1>
          <p className="mt-[2px] text-[14px] text-muted">
            Tenancy balances and arrears chasing. Reminders go out at 7 days overdue, then weekly.
          </p>
        </div>

        {!emailOn && (
          <div className="rounded-md border border-[color-mix(in_oklch,var(--warn)_40%,var(--border))] bg-[color-mix(in_oklch,var(--warn)_8%,transparent)] px-4 py-3 text-[13.5px] text-text-2">
            Email is not configured yet, so chases are logged but <strong>not sent</strong> to tenants. Set
            <code className="mx-1 rounded bg-surface-2 px-1">RESEND_API_KEY</code> to start sending.
          </div>
        )}

        <div className="grid grid-cols-2 gap-[18px] sm:grid-cols-3">
          <Card><p className="text-[15px] text-muted">Tenancies shown</p><p className="mt-2 font-display text-[26px] font-semibold text-text">{rows.length}</p></Card>
          <Card><p className="text-[15px] text-muted">Total owed (shown)</p><p className="mt-2 font-display text-[26px] font-semibold text-[var(--bad)]">{gbp(totalOwed)}</p></Card>
          <Card><p className="text-[15px] text-muted">Chasing paused</p><p className="mt-2 font-display text-[26px] font-semibold text-text">{rows.filter((r) => !r.chasing_enabled).length}</p></Card>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Input placeholder="Search tenant or property…" className="h-[44px] max-w-[320px]" value={query} onChange={(e) => setQuery(e.target.value)} />
          <FilterSelect value={landlordF} onChange={setLandlordF} placeholder="All landlords" options={landlords} />
          <FilterSelect value={statusF} onChange={setStatusF} placeholder="All statuses" options={[{ value: "Current", label: "Current" }, { value: "Past", label: "Former" }, { value: "Future", label: "Future" }]} />
          <FilterSelect value={signF} onChange={setSignF} placeholder="All balances" options={[{ value: "owing", label: "Owing (bad debt)" }, { value: "credit", label: "In credit" }, { value: "all", label: "All balances" }]} />
        </div>

        <Card className="overflow-x-auto p-0">
          <div className="grid min-w-[900px] grid-cols-[1.4fr_1.6fr_1.2fr_0.8fr_0.9fr_0.7fr_auto] items-center gap-4 border-b border-border px-6 py-4 text-[11.5px] font-semibold uppercase tracking-[0.05em] text-muted">
            <span>Tenant</span><span>Property</span><span>Landlord</span><span>Status</span><span className="text-right">Balance</span><span className="text-right">Overdue</span><span className="text-right">Chasing</span>
          </div>
          {rows.length === 0 ? (
            <p className="px-6 py-10 text-center text-[15px] text-muted">No tenancies match.</p>
          ) : (
            rows.map((b) => (
              <div key={b.lease_id} className="grid min-w-[900px] grid-cols-[1.4fr_1.6fr_1.2fr_0.8fr_0.9fr_0.7fr_auto] items-center gap-4 border-b border-border px-6 py-3 text-[13.5px] last:border-b-0">
                <Link href={`/tenancies/${b.lease_id}`} className="truncate font-medium text-text hover:text-accent">{b.tenant || "—"}</Link>
                <span className="truncate text-text-2">{b.property || "—"}</span>
                <span className="truncate text-text-2">{b.landlord || "—"}</span>
                <span><Badge tone={tenancyStatusTone(b.status)} dot>{b.status === "Past" ? "Former" : b.status}</Badge></span>
                <span className={`text-right tabular-nums font-semibold ${b.outstanding > 0 ? "text-[var(--bad)]" : b.outstanding < 0 ? "text-[var(--good)]" : "text-text"}`}>
                  {b.outstanding !== 0 ? gbp(Math.abs(b.outstanding)) : "—"}{b.outstanding < 0 ? " cr" : ""}
                </span>
                <span className="text-right text-text-2">{b.days_overdue > 0 ? `${b.days_overdue}d` : "—"}</span>
                <span className="flex justify-end">
                  {canEdit ? (
                    <button
                      onClick={() => toggle(b)}
                      disabled={busy === b.lease_id}
                      title={b.chasing_enabled ? "Chasing on — click to pause" : "Chasing paused — click to enable"}
                      className={`grid h-8 w-8 place-items-center rounded-md transition-colors hover:bg-surface-2/60 ${b.chasing_enabled ? "text-accent" : "text-muted"}`}
                    >
                      {busy === b.lease_id ? <Loader2 className="h-[15px] w-[15px] animate-spin" /> : b.chasing_enabled ? <Bell strokeWidth={1.7} className="h-[15px] w-[15px]" /> : <BellOff strokeWidth={1.7} className="h-[15px] w-[15px]" />}
                    </button>
                  ) : (
                    b.chasing_enabled ? <Bell strokeWidth={1.7} className="h-[15px] w-[15px] text-accent" /> : <BellOff strokeWidth={1.7} className="h-[15px] w-[15px] text-muted" />
                  )}
                </span>
              </div>
            ))
          )}
        </Card>
        {rows.some((r) => r.last_chased_at) && (
          <p className="text-[12.5px] text-muted">Last chase timestamps are recorded per tenancy; the daily job re-chases weekly while in arrears.</p>
        )}
      </main>
    </>
  );
}
