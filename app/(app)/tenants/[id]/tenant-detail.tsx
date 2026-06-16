"use client";

import Link from "next/link";
import { ArrowLeft, Pencil, Mail, Phone, ExternalLink, ScrollText } from "lucide-react";
import { Topbar } from "@/components/shell/topbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { tenantStatusTone as statusTone, leaseStatusTone as leaseTone } from "@/lib/badge-tones";
import { gbp, fmtDate } from "@/lib/utils";
import type { TenantRow } from "@/lib/data/tenants";
import type { TenantRelated } from "@/lib/data/tenant-related";

export function TenantDetail({
  tenant: t,
  related,
}: {
  tenant: TenantRow;
  related: TenantRelated;
}) {
  return (
    <>
      <Topbar
        search="Search…"
        action={
          <Link href={`/tenants?edit=${t.id}`}>
            <Button variant="ghost" size="toolbar" className="gap-[6px]">
              <Pencil strokeWidth={1.6} className="h-[16px] w-[16px]" /> Edit details
            </Button>
          </Link>
        }
      />
      <main className="flex flex-1 flex-col gap-[22px] overflow-y-auto thin-scroll px-[34px] py-[30px]">
        <Link href="/tenants" className="inline-flex items-center gap-2 text-[15px] font-medium text-muted hover:text-accent">
          <ArrowLeft strokeWidth={1.6} className="h-4 w-4" /> All tenants
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="font-display text-[30px] font-semibold tracking-[-0.01em] text-text">{t.full_name || "Tenant"}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {t.tenant_code && <Badge tone="muted">Code: {t.tenant_code}</Badge>}
              {t.tenant_type && <Badge tone="muted">{t.tenant_type}</Badge>}
              {t.status && <Badge tone={statusTone(t.status)} dot>{t.status}</Badge>}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-[15px] text-text-2">
              {t.email && <a href={`mailto:${t.email}`} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 hover:bg-surface-2/60"><Mail strokeWidth={1.6} className="h-[14px] w-[14px]" /> {t.email}</a>}
              {t.phone && <a href={`tel:${t.phone}`} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 hover:bg-surface-2/60"><Phone strokeWidth={1.6} className="h-[14px] w-[14px]" /> {t.phone}</a>}
            </div>
          </div>
          {related.finance.arrears > 0 && (
            <div className="rounded-lg border border-[var(--bad)]/40 bg-[color-mix(in_oklch,var(--bad)_8%,transparent)] px-5 py-3 text-right">
              <p className="text-[12px] uppercase tracking-[0.12em] text-[var(--bad)]">In arrears</p>
              <p className="font-display text-[26px] font-semibold text-[var(--bad)]">{gbp(related.finance.arrears)}</p>
            </div>
          )}
        </div>

        {/* Finance summary */}
        <div className="grid grid-cols-3 gap-[18px]">
          <Card><p className="text-[15px] text-muted">Rent expected</p><p className="mt-2 font-display text-[24px] font-semibold text-text">{gbp(related.finance.due)}</p></Card>
          <Card><p className="text-[15px] text-muted">Collected</p><p className="mt-2 font-display text-[24px] font-semibold text-[var(--good)]">{gbp(related.finance.collected)}</p></Card>
          <Card><p className="text-[15px] text-muted">Arrears</p><p className="mt-2 font-display text-[24px] font-semibold text-[var(--bad)]">{gbp(related.finance.arrears)}</p></Card>
        </div>

        {/* Leases */}
        <Card className="p-0">
          <div className="flex items-center gap-2 px-6 py-4 text-[16px] font-semibold text-text">
            <ScrollText strokeWidth={1.6} className="h-[18px] w-[18px] text-accent" /> Tenancies ({related.leases.length})
          </div>
          {related.leases.length === 0 ? (
            <p className="px-6 pb-5 text-[15px] text-muted">No tenancies recorded.</p>
          ) : (
            <div className="border-t border-border">
              {related.leases.map((l) => (
                <div key={l.id} className="grid grid-cols-[1.6fr_0.8fr_1fr_0.8fr] items-center gap-4 border-b border-border px-6 py-3 text-[14px] last:border-b-0">
                  <Link href={l.propertyId ? `/properties/${l.propertyId}` : "#"} className="truncate font-medium text-text hover:text-accent">{l.property || "—"}</Link>
                  <span className="font-display text-[15px] font-semibold text-text">{l.rent != null ? gbp(l.rent) : "—"}</span>
                  <span className="text-text-2">{l.start ? fmtDate(l.start) : "—"} → {l.end ? fmtDate(l.end) : "—"}</span>
                  <span>{l.status ? <Badge tone={leaseTone(l.status)} dot>{l.status}</Badge> : <span className="text-muted">—</span>}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Next of kin + Guarantor + Documents */}
        <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-2">
          <Card>
            <h3 className="mb-3 text-[16px] font-semibold text-text">Next of kin & guarantor</h3>
            <dl className="grid grid-cols-2 gap-y-2 text-[13.5px]">
              <Info label="NOK name" value={t.nok_name} />
              <Info label="NOK phone" value={t.nok_phone} />
              <Info label="NOK relationship" value={t.nok_relationship} />
              <Info label="NOK email" value={t.nok_email} />
              <Info label="Guarantor" value={t.guarantor_name} />
              <Info label="Guarantor email" value={t.guarantor_email} />
            </dl>
          </Card>
          <Card className="p-0">
            <div className="px-5 py-4 text-[16px] font-semibold text-text">Documents ({related.documents.length})</div>
            {related.documents.length === 0 ? (
              <p className="px-5 pb-5 text-[15px] text-muted">No documents linked to this tenant.</p>
            ) : (
              <ul className="border-t border-border">
                {related.documents.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 border-b border-border px-5 py-3 last:border-b-0">
                    <a href={d.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 truncate text-[14px] font-medium text-text hover:text-accent">{d.name}<ExternalLink strokeWidth={1.6} className="h-[13px] w-[13px] text-muted" /></a>
                    {d.expiry && <span className="text-[12.5px] text-muted">{fmtDate(d.expiry)}</span>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </main>
    </>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd className="text-text">{value || "—"}</dd>
    </>
  );
}
