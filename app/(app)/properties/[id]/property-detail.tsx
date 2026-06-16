"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, UserRound, Plus, ExternalLink, Pencil, Building2, Boxes, ChevronRight, Trash2, Loader2 } from "lucide-react";
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
import type { PropertyRelated, Ancestor, PropertyRollup } from "@/lib/data/property-related";
import { canHaveChildren, addableChildConfigs, CONFIG_SUBBUILDING, CONFIG_UNIT } from "@/lib/property-config";
import { addUnit, addChild, autoGenerateUnits, deleteUnit } from "../unit-actions";
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
  ancestors,
  rollup,
  canEdit,
  utilityTypes,
  addData,
}: {
  property: PropertyRow;
  related: PropertyRelated;
  ancestors: Ancestor[];
  rollup: PropertyRollup | null;
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
        {ancestors.length > 0 ? (
          <nav className="flex flex-wrap items-center gap-1.5 text-[15px] text-muted">
            <Link href="/properties" className="font-medium hover:text-accent">Properties</Link>
            {ancestors.map((a) => (
              <span key={a.id} className="inline-flex items-center gap-1.5">
                <ChevronRight strokeWidth={1.6} className="h-[14px] w-[14px]" />
                <Link href={`/properties/${a.id}`} className="font-medium hover:text-accent">{a.label}</Link>
              </span>
            ))}
            <ChevronRight strokeWidth={1.6} className="h-[14px] w-[14px]" />
            <span className="font-medium text-text-2">{p.address || p.internal_code || "This property"}</span>
          </nav>
        ) : (
          <Link href="/properties" className="inline-flex items-center gap-2 text-[15px] font-medium text-muted hover:text-accent">
            <ArrowLeft strokeWidth={1.6} className="h-4 w-4" />
            All properties
          </Link>
        )}

        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="font-display text-[30px] font-semibold tracking-[-0.01em] text-text">
              {p.address || "Untitled property"}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {p.configuration && <Badge tone="accent">{p.configuration}</Badge>}
              {p.internal_code && <Badge tone="muted">Code: {p.internal_code}</Badge>}
              {p.class && <Badge tone="muted">Class: {p.class}</Badge>}
              {p.status && <Badge tone={statusTone(p.status)} dot>{p.status}</Badge>}
            </div>
            {landlordName && (
              <div className="mt-4 flex items-center gap-2 text-[15px] text-text-2">
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

        {rollup && <RollupCard rollup={rollup} />}

        {canHaveChildren(p.configuration) && (
          <ContentsSection propertyId={p.id} parentConfig={p.configuration} items={related.units} canEdit={canEdit} />
        )}

        {canHaveChildren(p.configuration) && (
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

function RollupCard({ rollup: r }: { rollup: PropertyRollup }) {
  const cell = (label: string, value: React.ReactNode, sub?: string, tone?: "good" | "bad") => (
    <div>
      <p className="text-[11.5px] uppercase tracking-[0.12em] text-muted">{label}</p>
      <p className={`mt-1 font-display text-[22px] font-semibold ${tone === "bad" ? "text-[var(--bad)]" : tone === "good" ? "text-[var(--good)]" : "text-text"}`}>{value}</p>
      {sub && <p className="text-[12px] text-muted">{sub}</p>}
    </div>
  );
  return (
    <Card>
      <div className="mb-[18px] flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-[16px] font-semibold text-text">
          <Boxes strokeWidth={1.6} className="h-[18px] w-[18px] text-accent" /> Portfolio rollup
        </h3>
        <span className="text-[12.5px] text-muted">Totals across every sub-building and unit below</span>
      </div>
      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
        {cell("Units", r.units, r.subBuildings > 0 ? `in ${r.subBuildings} sub-building${r.subBuildings === 1 ? "" : "s"}` : undefined)}
        {cell("Occupancy", `${r.occupancyRate}%`, `${r.occupied} of ${r.leasable} occupied`)}
        {cell("Vacant", r.vacant, r.vacant === 0 ? "fully let" : undefined)}
        {cell("Open jobs", r.openMaintenance)}
        {cell("Income", gbp(r.income), undefined, "good")}
        {cell("Expense", gbp(r.expense), undefined, "bad")}
        {cell("Net", gbp(r.net), undefined, r.net >= 0 ? "good" : "bad")}
      </div>
    </Card>
  );
}

function ContentsSection({
  propertyId,
  parentConfig,
  items,
  canEdit,
}: {
  propertyId: string;
  parentConfig: string | null;
  items: PropertyRelated["units"];
  canEdit: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [unitNo, setUnitNo] = useState("");
  const [count, setCount] = useState("4");
  const [prefix, setPrefix] = useState("Unit ");
  const [subName, setSubName] = useState("");
  const [pending, start] = useTransition();

  const subBuildings = items.filter((i) => i.configuration === CONFIG_SUBBUILDING);
  const units = items.filter((i) => i.configuration !== CONFIG_SUBBUILDING);
  const addable = addableChildConfigs(parentConfig);
  const canAddSub = canEdit && addable.includes(CONFIG_SUBBUILDING);
  const canAddUnit = canEdit && addable.includes(CONFIG_UNIT);

  function act(fn: () => Promise<{ ok: boolean; error?: string }>, msg: string) {
    start(async () => {
      const res = await fn();
      if (!res.ok) return toast.error(res.error ?? "Couldn't save changes. Please try again.");
      toast.success(msg);
      router.refresh();
    });
  }

  async function removeChild(id: string, label: string, kind: string) {
    if (!(await confirm({ title: `Delete ${kind.toLowerCase()}`, message: `Delete "${label}"? This cannot be undone.`, danger: true, confirmLabel: "Delete" }))) return;
    act(() => deleteUnit(id, propertyId), `${kind} deleted.`);
  }

  return (
    <Card>
      <div className="mb-[18px] flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-[16px] font-semibold text-text">
          <Boxes strokeWidth={1.6} className="h-[18px] w-[18px] text-accent" /> Contents ({items.length})
        </h3>
      </div>

      {/* Sub-buildings */}
      {(subBuildings.length > 0 || canAddSub) && (
        <div className="mb-5">
          <p className="mb-2 text-[12.5px] font-semibold uppercase tracking-[0.06em] text-muted">Sub-buildings ({subBuildings.length})</p>
          {subBuildings.length > 0 ? (
            <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {subBuildings.map((s) => (
                <div key={s.id} className="flex items-center gap-3 rounded-lg border border-border px-3 py-[11px]">
                  <Building2 strokeWidth={1.6} className="h-[16px] w-[16px] shrink-0 text-accent" />
                  <Link href={`/properties/${s.id}`} className="flex-1 truncate text-[14px] font-medium text-text hover:text-accent">
                    {s.unit_number || s.address || "Sub-building"}
                  </Link>
                  {canEdit && (
                    <button onClick={() => removeChild(s.id, s.unit_number || "sub-building", "Sub-building")} className="grid h-8 w-8 place-items-center rounded-md text-[var(--bad)] hover:bg-[color-mix(in_oklch,var(--bad)_12%,transparent)]" aria-label="Delete sub-building">
                      <Trash2 strokeWidth={1.6} className="h-[16px] w-[16px]" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="mb-3 text-[15px] text-muted">No sub-buildings yet.</p>
          )}
          {canAddSub && (
            <div className="flex items-end gap-2">
              <Input value={subName} onChange={(e) => setSubName(e.target.value)} placeholder="Sub-building name (e.g. Block B)" className="h-[44px] max-w-[260px]" />
              <Button variant="ghost" size="toolbar" className="gap-[6px]" disabled={pending || !subName.trim()} onClick={() => act(async () => { const r = await addChild(propertyId, CONFIG_SUBBUILDING, subName); setSubName(""); return r; }, "Sub-building added.")}>
                <Plus strokeWidth={1.8} className="h-[16px] w-[16px]" /> Add sub-building
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Units */}
      <div>
        <p className="mb-2 text-[12.5px] font-semibold uppercase tracking-[0.06em] text-muted">Units ({units.length})</p>
        {units.length > 0 ? (
          <ul className="mb-4">
            {units.map((u) => (
              <li key={u.id} className="flex items-center gap-3 border-t border-border py-[11px] first:border-t-0">
                <Link href={`/properties/${u.id}`} className="flex-1 truncate text-[14px] font-medium text-text hover:text-accent">
                  {u.unit_number || "Unit"}
                </Link>
                {u.status && <Badge tone={(u.status ?? "").toLowerCase() === "occupied" ? "good" : "warn"} dot>{u.status}</Badge>}
                {canEdit && (
                  <button onClick={() => removeChild(u.id, u.unit_number || "unit", "Unit")} className="grid h-8 w-8 place-items-center rounded-md text-[var(--bad)] hover:bg-[color-mix(in_oklch,var(--bad)_12%,transparent)]" aria-label="Delete unit">
                    <Trash2 strokeWidth={1.6} className="h-[16px] w-[16px]" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mb-4 text-[15px] text-muted">No units yet.{canAddUnit ? " Add one or auto-generate a set." : ""}</p>
        )}

        {canAddUnit && (
          <div className="flex flex-wrap items-end gap-3 border-t border-border pt-4">
            <div className="flex items-end gap-2">
              <Input value={unitNo} onChange={(e) => setUnitNo(e.target.value)} placeholder="Unit number" className="h-[44px] max-w-[160px]" />
              <Button variant="ghost" size="toolbar" className="gap-[6px]" disabled={pending || !unitNo.trim()} onClick={() => act(async () => { const r = await addUnit(propertyId, unitNo); setUnitNo(""); return r; }, "Unit added.")}>
                <Plus strokeWidth={1.8} className="h-[16px] w-[16px]" /> Add unit
              </Button>
            </div>
            <span className="text-[15px] text-muted">or</span>
            <div className="flex items-end gap-2">
              <Input value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="Prefix" className="h-[44px] max-w-[110px]" />
              <Input type="number" min={1} max={100} value={count} onChange={(e) => setCount(e.target.value)} className="h-[44px] max-w-[80px]" />
              <Button variant="ghost" size="toolbar" disabled={pending} onClick={() => act(() => autoGenerateUnits(propertyId, Number(count), prefix), "Units generated.")}>
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Auto-generate"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function RecordList<T>({ rows, render, empty }: { rows: T[]; render: (r: T) => React.ReactNode; empty: string }) {
  if (rows.length === 0) {
    return (
      <div className="grid place-items-center rounded-lg border border-dashed border-border py-12 text-center">
        <p className="text-[15px] text-muted">{empty}</p>
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
