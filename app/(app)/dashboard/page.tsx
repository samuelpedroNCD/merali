import Link from "next/link";
import {
  Building2,
  Gauge,
  Wrench,
  PoundSterling,
  Plus,
  UserPlus,
  ArrowUpRight,
  AlertCircle,
} from "lucide-react";
import { Topbar } from "@/components/shell/topbar";
import { Card, CardHeader } from "@/components/ui/card";
import { Stat } from "@/components/ui/stat";
import { Donut } from "@/components/ui/donut";
import { Bars } from "@/components/ui/bars";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { gbp, fmtDate } from "@/lib/utils";
import { requireUser, can } from "@/lib/auth";
import { getDashboardData } from "@/lib/data/dashboard";

function greeting(now = new Date()) {
  const h = now.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default async function DashboardPage() {
  const user = await requireUser();
  const d = await getDashboardData();
  const now = new Date();
  const firstName = user.name.split(/\s+/)[0];

  // Role-aware view: surface widgets the user can actually see, and lead with
  // whatever their role is focused on (finance / operations / management).
  const canFinance = can(user, "finance", "view");
  const canMaint = can(user, "maintenance", "view");
  const canProps = can(user, "properties", "view");
  const canCerts = can(user, "certifications", "view");
  const canLeases = can(user, "leases", "view");
  const focus: "finance" | "ops" | "manager" =
    canFinance && !canMaint ? "finance" : canMaint && !canFinance ? "ops" : "manager";
  const focusLabel =
    focus === "finance" ? "Finance overview" : focus === "ops" ? "Operations overview" : "Portfolio overview";

  // KPI cards, gated by permission and ordered by focus.
  const kpis = [
    canProps && {
      key: "props",
      node: <Stat label="Total Properties" value={String(d.totalProperties)} sub={`${d.newPropertiesThisMonth} new this month`} icon={Building2} />,
      weight: focus === "manager" ? 0 : 3,
    },
    canProps && {
      key: "occ",
      node: <Stat label="Occupancy Rate" value={`${d.occupancyRate}%`} sub={`${d.vacantUnits} vacant`} icon={Gauge} />,
      weight: focus === "ops" ? 1 : 2,
    },
    canMaint && {
      key: "maint",
      node: <Stat label="Open Maintenance" value={String(d.openMaintenance)} sub={`${d.urgentMaintenance} urgent`} icon={Wrench} />,
      weight: focus === "ops" ? 0 : 3,
    },
    canFinance && {
      key: "rent",
      node: <Stat label="Rent Collection" value={gbp(d.rentCollectedThisMonth)} sub={`${d.rentCollectedPct}% collected`} icon={PoundSterling} />,
      weight: focus === "finance" ? 0 : 3,
    },
  ]
    .filter((x): x is { key: string; node: React.ReactElement; weight: number } => Boolean(x))
    .sort((a, b) => a.weight - b.weight);

  return (
    <>
      <Topbar
        search="Search anything…"
        action={
          <div className="flex items-center gap-2">
            {can(user, "properties", "create") && (
              <Link href="/properties">
                <Button variant="ghost" size="toolbar" className="gap-[6px]">
                  <Building2 strokeWidth={1.6} className="h-[16px] w-[16px]" />
                  Add property
                </Button>
              </Link>
            )}
            {can(user, "tenants", "create") && (
              <Link href="/tenants">
                <Button variant="ghost" size="toolbar" className="gap-[6px]">
                  <UserPlus strokeWidth={1.6} className="h-[16px] w-[16px]" />
                  Add tenant
                </Button>
              </Link>
            )}
            {can(user, "maintenance", "create") && (
              <Link href="/maintenance">
                <Button size="toolbar" className="gap-[6px]">
                  <Plus strokeWidth={1.8} className="h-[16px] w-[16px]" />
                  New maintenance job
                </Button>
              </Link>
            )}
          </div>
        }
      />

      <main className="flex flex-1 flex-col gap-[22px] overflow-y-auto thin-scroll px-[34px] py-[30px]">
        <div>
          <p className="eyebrow mb-1">
            {now.toLocaleDateString("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
          <h2 className="font-display text-[34px] font-semibold leading-[1.1] text-text">
            {greeting(now)}, {firstName}
          </h2>
          <p className="mt-1 text-[13px] text-muted">{focusLabel}</p>
        </div>

        {kpis.length > 0 && (
          <div className="grid grid-cols-2 gap-[18px] lg:grid-cols-4">
            {kpis.map((k) => (
              <div key={k.key}>{k.node}</div>
            ))}
          </div>
        )}

        {canFinance && d.arrearsTotal > 0 && (
          <Link
            href="/payments"
            className="flex items-center gap-3 rounded-lg border border-[var(--bad)]/40 bg-[color-mix(in_oklch,var(--bad)_7%,transparent)] px-5 py-4 transition-colors hover:bg-[color-mix(in_oklch,var(--bad)_12%,transparent)]"
          >
            <AlertCircle strokeWidth={1.7} className="h-[20px] w-[20px] text-[var(--bad)]" />
            <span className="flex-1 text-[14px] text-text">
              <span className="font-display text-[18px] font-semibold text-[var(--bad)]">{gbp(d.arrearsTotal)}</span>{" "}
              in rent arrears across {d.arrearsTenants} tenant{d.arrearsTenants === 1 ? "" : "s"}.
            </span>
            <span className="text-[12.5px] font-semibold text-accent">View overdue →</span>
          </Link>
        )}

        {canFinance && d.unprotectedDeposits > 0 && (
          <Link
            href="/tenancies"
            className="flex items-center gap-3 rounded-lg border border-[var(--warn)]/40 bg-[color-mix(in_oklch,var(--warn)_8%,transparent)] px-5 py-4 transition-colors hover:bg-[color-mix(in_oklch,var(--warn)_14%,transparent)]"
          >
            <AlertCircle strokeWidth={1.7} className="h-[20px] w-[20px] text-[var(--warn)]" />
            <span className="flex-1 text-[14px] text-text">
              <span className="font-display text-[18px] font-semibold text-[var(--warn)]">{d.unprotectedDeposits}</span>{" "}
              deposit{d.unprotectedDeposits === 1 ? "" : "s"} ({gbp(d.unprotectedDepositTotal)}) recorded but not marked as protected.
            </span>
            <span className="text-[12.5px] font-semibold text-accent">Review tenancies →</span>
          </Link>
        )}

        {(canFinance || canProps) && (
          <div className={`grid grid-cols-1 gap-[18px] ${canFinance && canProps ? "lg:grid-cols-[1.6fr_1fr]" : ""}`}>
            {canFinance && (
              <Card>
                <CardHeader
                  title="Rent collection"
                  action={
                    <Badge tone={d.rentCollectedPct >= 90 ? "good" : "muted"} dot>
                      {d.rentCollectedPct}% this month
                    </Badge>
                  }
                />
                <Bars data={d.rentBars} />
              </Card>
            )}
            {canProps && (
              <Card className="flex flex-col">
                <CardHeader title="Occupancy" />
                <div className="grid flex-1 place-items-center py-2">
                  <Donut percent={d.occupancyRate} caption="occupied" />
                </div>
              </Card>
            )}
          </div>
        )}

        <div className={`grid grid-cols-1 gap-[18px] ${canCerts || canLeases ? "lg:grid-cols-2" : ""}`}>
          <Card>
            <CardHeader
              title="Recent activity"
              action={
                <Link href="/logs" className="text-[13px] font-semibold text-accent">
                  View all
                </Link>
              }
            />
            {d.activity.length === 0 ? (
              <EmptyRow text="No activity yet — actions across the app show up here." />
            ) : (
              <ul>
                {d.activity.map((a, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-[13px] border-t border-border py-[13px] first:border-t-0"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-2">
                      <ArrowUpRight strokeWidth={1.6} className="h-4 w-4 text-accent" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-medium text-text">{a.type}</p>
                      <p className="truncate text-[12.5px] text-muted">
                        {[a.label, a.who].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <span className="text-[12.5px] text-muted">{fmtDate(a.at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {(canCerts || canLeases) && (
            <Card>
              {canCerts && (
                <>
                  <CardHeader
                    title="Certifications to expire"
                    action={
                      <Link href="/certifications" className="text-[13px] font-semibold text-accent">
                        View all
                      </Link>
                    }
                  />
                  {d.certs.length === 0 ? (
                    <EmptyRow text="No certifications expiring soon." />
                  ) : (
                    <ul>
                      {d.certs.map((c, i) => (
                        <li
                          key={i}
                          className="flex items-center gap-[13px] border-t border-border py-[13px] first:border-t-0"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[14px] font-medium text-text">{c.name}</p>
                            <p className="truncate text-[12.5px] text-muted">{c.property}</p>
                          </div>
                          {c.due && <Badge tone="warn">{fmtDate(c.due)}</Badge>}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
              {canLeases && (
                <div className={canCerts ? "mt-[18px]" : ""}>
                  <CardHeader title="Lease renewals this month" />
                  {d.renewals.length === 0 ? (
                    <EmptyRow text="No renewals due this month." />
                  ) : (
                    <ul>
                      {d.renewals.map((r, i) => (
                        <li
                          key={i}
                          className="flex items-center gap-[13px] border-t border-border py-[13px] first:border-t-0"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[14px] font-medium text-text">{r.tenant}</p>
                            <p className="truncate text-[12.5px] text-muted">{r.property}</p>
                          </div>
                          {r.end && <span className="text-[12.5px] text-muted">ends {fmtDate(r.end)}</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </Card>
          )}
        </div>
      </main>
    </>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <div className="grid place-items-center py-8 text-center">
      <p className="text-[13px] text-muted">{text}</p>
    </div>
  );
}
