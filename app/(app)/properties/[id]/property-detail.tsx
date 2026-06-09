"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, UserRound, Plus, ExternalLink, Pencil, Building2, Trash2, Loader2 } from "lucide-react";
import { Topbar } from "@/components/shell/topbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { genericStatusTone as statusTone, urgencyTone } from "@/lib/badge-tones";
import { Tabs } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { gbp, fmtDate } from "@/lib/utils";
import type { PropertyRow } from "@/lib/data/properties";
import type { PropertyRelated } from "@/lib/data/property-related";
import { addUnit, autoGenerateUnits, deleteUnit } from "../unit-actions";
import { PropertyMedia } from "./property-media";
import { PropertyUtilities } from "./property-utilities";
import { PropertyAddDrawer, type PropertyAddData } from "./property-add-drawers";

const TABS = [
  { key: "tenants", label: "Tenants" },
  { key: "documents", label: "Documents" },
  { key: "maintenance", label: "Maintenance" },
  { key: "financial", label: "Financial" },
  { key: "keys", label: "Keys" },
];


const addLabel: Record<string, string> = {
  tenants: "Add tenancy",
  documents: "Upload document",
  maintenance: "Book new job",
  financial: "Add transaction",
  keys: "Issue new key",
};

export function PropertyDetail({
  property: p,
  related,
  canEdit,
  utilityTypes,
  addData,
}: {
  property: PropertyRow;
  related: PropertyRelated;
  canEdit: boolean;
  utilityTypes: string[];
  addData: PropertyAddData;
}) {
  const router = useRouter();
  const [tab, setTab] = useState("tenants");
  const [addOpen, setAddOpen] = useState(false);
  const landlordName = p.landlord?.full_name;
  const add = addLabel[tab];

  return (
    <>
      <Topbar
        search="Search…"
        action={
          <Link href={`/properties?edit=${p.id}`}>
            <Button variant="ghost" size="toolbar" className="gap-[6px]">
              <Pencil strokeWidth={1.6} className="h-[16px] w-[16px]" /> Edit details
            </Button>
          </Link>
        }
      />

      <main className="flex flex-1 flex-col gap-[22px] overflow-y-auto thin-scroll px-[34px] py-[30px]">
        <Link href="/properties" className="inline-flex items-center gap-2 text-[13px] font-medium text-muted hover:text-accent">
          <ArrowLeft strokeWidth={1.6} className="h-4 w-4" />
          All properties
        </Link>

        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="font-display text-[30px] font-semibold tracking-[-0.01em] text-text">
              {p.address || "Untitled property"}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {p.internal_code && <Badge tone="muted">Code: {p.internal_code}</Badge>}
              {p.class && <Badge tone="muted">Class: {p.class}</Badge>}
              {p.status && <Badge tone={statusTone(p.status)} dot>{p.status}</Badge>}
            </div>
            {related.parent && (
              <div className="mt-3 text-[13px] text-text-2">
                <span className="text-muted">Part of </span>
                <Link href={`/properties/${related.parent.id}`} className="inline-flex items-center gap-1 font-medium text-accent hover:underline">
                  <Building2 strokeWidth={1.6} className="h-[14px] w-[14px]" /> {related.parent.address || "building"}
                </Link>
              </div>
            )}
            {landlordName && (
              <div className="mt-4 flex items-center gap-2 text-[13px] text-text-2">
                <span className="text-muted">Landlord</span>
                <Link
                  href={p.landlord ? `/landlords/${p.landlord.id}` : "#"}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 hover:bg-surface-2/60"
                >
                  <UserRound strokeWidth={1.6} className="h-[14px] w-[14px]" />
                  {landlordName}
                </Link>
              </div>
            )}
          </div>
          <div className="text-right">
            <p className="text-[12px] uppercase tracking-[0.14em] text-muted">Target rent</p>
            <p className="font-display text-[28px] font-semibold text-text">
              {p.target_rent != null ? gbp(p.target_rent) : "—"}
            </p>
          </div>
        </div>

        {p.configuration !== "Unit" && (
          <UnitsSection propertyId={p.id} units={related.units} />
        )}

        {p.configuration !== "Unit" && (
          <PropertyUtilities propertyId={p.id} utilities={related.utilities} utilityTypes={utilityTypes} canEdit={canEdit} />
        )}

        <PropertyMedia
          propertyId={p.id}
          photos={related.photos}
          inspections={related.inspections}
          canEdit={canEdit}
        />

        <Tabs tabs={TABS} value={tab} onChange={setTab} />

        <Card>
          <div className="mb-[18px] flex items-center justify-between">
            <h3 className="text-[16px] font-semibold capitalize text-text">
              {TABS.find((t) => t.key === tab)?.label}
            </h3>
            {add && (
              <Button size="toolbar" className="gap-[6px]" onClick={() => setAddOpen(true)}>
                <Plus strokeWidth={1.8} className="h-[16px] w-[16px]" /> {add}
              </Button>
            )}
          </div>

          {tab === "tenants" && (
            <RecordList
              empty="No tenancies for this property yet."
              rows={related.tenants}
              render={(t) => (
                <Row key={t.id} title={t.name || "—"} meta={`${t.start ? fmtDate(t.start) : "—"} → ${t.end ? fmtDate(t.end) : "—"}`} badge={t.status ? <Badge tone={statusTone(t.status)} dot>{t.status}</Badge> : null} />
              )}
            />
          )}
          {tab === "documents" && (
            <RecordList
              empty="No documents for this property yet."
              rows={related.documents}
              render={(d) => (
                <Row
                  key={d.id}
                  title={<a href={d.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 hover:text-accent">{d.name}<ExternalLink strokeWidth={1.6} className="h-[13px] w-[13px] text-muted" /></a>}
                  meta={d.expiry ? `Expires ${fmtDate(d.expiry)}` : ""}
                />
              )}
            />
          )}
          {tab === "maintenance" && (
            <RecordList
              empty="No maintenance jobs for this property yet."
              rows={related.maintenance}
              render={(m) => (
                <Row key={m.id} title={m.description || "Untitled job"} badge={<div className="flex gap-1">{m.urgency && <Badge tone={urgencyTone(m.urgency)}>{m.urgency}</Badge>}{m.status && <Badge tone="muted">{m.status}</Badge>}</div>} />
              )}
            />
          )}
          {tab === "financial" && (
            <RecordList
              empty="No transactions for this property yet."
              rows={related.transactions}
              render={(t) => (
                <Row key={t.id} title={t.category || t.type || "Transaction"} meta={t.date ? fmtDate(t.date) : ""} badge={<span className={`font-display text-[16px] font-semibold ${t.type === "Income" ? "text-[var(--good)]" : "text-[var(--bad)]"}`}>{gbp(t.gross)}</span>} />
              )}
            />
          )}
          {tab === "keys" && (
            <RecordList
              empty="No keys for this property yet."
              rows={related.keys}
              render={(k) => (
                <Row key={k.id} title={k.key_code || "—"} meta={k.held_by_type || ""} badge={k.status ? <Badge tone={statusTone(k.status)} dot>{k.status}</Badge> : null} />
              )}
            />
          )}
        </Card>

        <PropertyAddDrawer
          tab={tab}
          propertyId={p.id}
          open={addOpen}
          onClose={() => setAddOpen(false)}
          onSaved={() => router.refresh()}
          data={addData}
        />
      </main>
    </>
  );
}

function UnitsSection({ propertyId, units }: { propertyId: string; units: PropertyRelated["units"] }) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [unitNo, setUnitNo] = useState("");
  const [count, setCount] = useState("4");
  const [prefix, setPrefix] = useState("Unit ");
  const [pending, start] = useTransition();

  function act(fn: () => Promise<{ ok: boolean; error?: string }>, msg: string) {
    start(async () => {
      const res = await fn();
      if (!res.ok) return toast.error(res.error ?? "Couldn't save changes. Please try again.");
      toast.success(msg);
      router.refresh();
    });
  }

  return (
    <Card>
      <div className="mb-[18px] flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-[16px] font-semibold text-text">
          <Building2 strokeWidth={1.6} className="h-[18px] w-[18px] text-accent" /> Units ({units.length})
        </h3>
      </div>

      {units.length > 0 ? (
        <ul className="mb-4">
          {units.map((u) => (
            <li key={u.id} className="flex items-center gap-3 border-t border-border py-[11px] first:border-t-0">
              <Link href={`/properties/${u.id}`} className="flex-1 truncate text-[14px] font-medium text-text hover:text-accent">
                {u.unit_number || "Unit"}
              </Link>
              {u.status && <Badge tone={(u.status ?? "").toLowerCase() === "occupied" ? "good" : "warn"} dot>{u.status}</Badge>}
              <button
                onClick={() => act(async () => {
                  if (!(await confirm({ title: "Delete unit", message: `Delete "${u.unit_number}"? This cannot be undone.`, danger: true, confirmLabel: "Delete" }))) return { ok: true };
                  return deleteUnit(u.id, propertyId);
                }, "Unit deleted.")}
                className="grid h-8 w-8 place-items-center rounded-md text-[var(--bad)] hover:bg-[color-mix(in_oklch,var(--bad)_12%,transparent)]"
                aria-label="Delete unit"
              >
                <Trash2 strokeWidth={1.6} className="h-[16px] w-[16px]" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-4 text-[13px] text-muted">No units yet. Add one or auto-generate a set.</p>
      )}

      <div className="flex flex-wrap items-end gap-3 border-t border-border pt-4">
        <div className="flex items-end gap-2">
          <Input value={unitNo} onChange={(e) => setUnitNo(e.target.value)} placeholder="Unit number" className="h-[44px] max-w-[160px]" />
          <Button variant="ghost" size="toolbar" className="gap-[6px]" disabled={pending || !unitNo.trim()} onClick={() => act(async () => { const r = await addUnit(propertyId, unitNo); setUnitNo(""); return r; }, "Unit added.")}>
            <Plus strokeWidth={1.8} className="h-[16px] w-[16px]" /> Add unit
          </Button>
        </div>
        <span className="text-[13px] text-muted">or</span>
        <div className="flex items-end gap-2">
          <Input value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="Prefix" className="h-[44px] max-w-[110px]" />
          <Input type="number" min={1} max={100} value={count} onChange={(e) => setCount(e.target.value)} className="h-[44px] max-w-[80px]" />
          <Button variant="ghost" size="toolbar" disabled={pending} onClick={() => act(() => autoGenerateUnits(propertyId, Number(count), prefix), "Units generated.")}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Auto-generate"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function RecordList<T>({ rows, render, empty }: { rows: T[]; render: (r: T) => React.ReactNode; empty: string }) {
  if (rows.length === 0) {
    return (
      <div className="grid place-items-center rounded-lg border border-dashed border-border py-12 text-center">
        <p className="text-[13px] text-muted">{empty}</p>
      </div>
    );
  }
  return <ul>{rows.map(render)}</ul>;
}

function Row({ title, meta, badge }: { title: React.ReactNode; meta?: React.ReactNode; badge?: React.ReactNode }) {
  return (
    <li className="flex items-center gap-4 border-t border-border py-[13px] first:border-t-0">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-medium text-text">{title}</p>
        {meta ? <p className="truncate text-[12.5px] text-muted">{meta}</p> : null}
      </div>
      {badge}
    </li>
  );
}
