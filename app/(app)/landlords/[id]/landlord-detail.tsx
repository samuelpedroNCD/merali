"use client";

import Link from "next/link";
import { ArrowLeft, Pencil, ExternalLink, Building2, Landmark } from "lucide-react";
import { Topbar } from "@/components/shell/topbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { propertyStatusTone as propTone } from "@/lib/badge-tones";
import { gbp, fmtDate } from "@/lib/utils";
import type { LandlordRow } from "@/lib/data/landlords";
import type { LandlordRelated } from "@/lib/data/landlord-related";

export function LandlordDetail({
  landlord: l,
  related,
}: {
  landlord: LandlordRow;
  related: LandlordRelated;
}) {
  const isTrust = !!l.landlord_type && l.landlord_type.toLowerCase().includes("trust");
  const isIndividual = !l.landlord_type || l.landlord_type.toLowerCase() === "individual";
  const hasBank = l.bank_account_name || l.bank_account_number || l.bank_sort_code;

  return (
    <>
      <Topbar
        search="Search…"
        action={
          <Link href={`/landlords?edit=${l.id}`}>
            <Button variant="ghost" size="toolbar" className="gap-[6px]">
              <Pencil strokeWidth={1.6} className="h-[16px] w-[16px]" /> Edit details
            </Button>
          </Link>
        }
      />
      <main className="flex flex-1 flex-col gap-[22px] overflow-y-auto thin-scroll px-[34px] py-[30px]">
        <Link href="/landlords" className="inline-flex items-center gap-2 text-[13px] font-medium text-muted hover:text-accent">
          <ArrowLeft strokeWidth={1.6} className="h-4 w-4" /> All landlords
        </Link>

        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="font-display text-[30px] font-semibold tracking-[-0.01em] text-text">{l.full_name || "Landlord"}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {l.landlord_type && <Badge tone="muted">{l.landlord_type}</Badge>}
              {l.vat_number && <Badge tone="muted">VAT: {l.vat_number}</Badge>}
            </div>
          </div>
        </div>

        {/* Finance summary */}
        <div className="grid grid-cols-3 gap-[18px]">
          <Card><p className="text-[13px] text-muted">Rent expected</p><p className="mt-2 font-display text-[24px] font-semibold text-text">{gbp(related.finance.expected)}</p></Card>
          <Card><p className="text-[13px] text-muted">Collected</p><p className="mt-2 font-display text-[24px] font-semibold text-[var(--good)]">{gbp(related.finance.collected)}</p></Card>
          <Card><p className="text-[13px] text-muted">Arrears</p><p className="mt-2 font-display text-[24px] font-semibold text-[var(--bad)]">{gbp(related.finance.arrears)}</p></Card>
        </div>

        {/* Portfolio */}
        <Card className="p-0">
          <div className="flex items-center gap-2 px-6 py-4 text-[16px] font-semibold text-text">
            <Building2 strokeWidth={1.6} className="h-[18px] w-[18px] text-accent" /> Property portfolio ({related.properties.length})
          </div>
          {related.properties.length === 0 ? (
            <p className="px-6 pb-5 text-[13px] text-muted">No properties assigned to this landlord.</p>
          ) : (
            <div className="border-t border-border">
              {related.properties.map((p) => (
                <div key={p.id} className="grid grid-cols-[2fr_0.8fr_0.8fr] items-center gap-4 border-b border-border px-6 py-3 text-[14px] last:border-b-0">
                  <Link href={`/properties/${p.id}`} className="truncate font-medium text-text hover:text-accent">{p.address || "—"}</Link>
                  <span>{p.status ? <Badge tone={propTone(p.status)} dot>{p.status}</Badge> : <span className="text-muted">—</span>}</span>
                  <span className="text-right font-display text-[15px] font-semibold text-text">{p.target_rent != null ? gbp(p.target_rent) : "—"}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Entity + Bank + Documents */}
        <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-2">
          {!isIndividual && (
            <Card>
              <h3 className="mb-3 text-[16px] font-semibold text-text">{isTrust ? "Trust details" : "Company details"}</h3>
              <dl className="grid grid-cols-2 gap-y-2 text-[13.5px]">
                {isTrust ? <Info label="Trustee" value={l.trustee_name} /> : <Info label="Director" value={l.director_name} />}
                <Info label="VAT number" value={l.vat_number} />
                <Info label="Registration date" value={l.company_registration_date ? fmtDate(l.company_registration_date) : null} />
              </dl>
            </Card>
          )}
          <Card>
            <h3 className="mb-3 flex items-center gap-2 text-[16px] font-semibold text-text"><Landmark strokeWidth={1.6} className="h-[18px] w-[18px] text-accent" /> Bank details</h3>
            {hasBank ? (
              <dl className="grid grid-cols-2 gap-y-2 text-[13.5px]">
                <Info label="Account name" value={l.bank_account_name} />
                <Info label="Bank" value={l.bank_name} />
                <Info label="Sort code" value={l.bank_sort_code} />
                <Info label="Account number" value={l.bank_account_number} />
                <Info label="Reference" value={l.bank_reference} />
              </dl>
            ) : (
              <p className="text-[13px] text-muted">No bank details recorded.</p>
            )}
          </Card>
          <Card className="p-0">
            <div className="px-5 py-4 text-[16px] font-semibold text-text">Documents ({related.documents.length})</div>
            {related.documents.length === 0 ? (
              <p className="px-5 pb-5 text-[13px] text-muted">No documents linked to this landlord.</p>
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
