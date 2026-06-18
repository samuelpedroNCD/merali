"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Plus, Pencil, Trash2, Loader2, CalendarClock } from "lucide-react";
import { Topbar } from "@/components/shell/topbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { tenancyStatus, tenancyStatusTone } from "@/lib/tenancy-status";
import { computeDueDates } from "@/lib/finance/dueDates";
import { FilterSelect } from "@/components/ui/filter-select";
import { Input, Field, Select, Textarea } from "@/components/ui/input";
import { Drawer } from "@/components/ui/drawer";
import { gbp, fmtDate } from "@/lib/utils";
import type { Option } from "@/lib/data/options";
import type { LeaseRow } from "@/lib/data/leases";
import { createLease, updateLease, deleteLease } from "./actions";

type Perms = { create: boolean; edit: boolean; remove: boolean };
type Opt = { value: string; label: string };
type Form = Record<string, string>;

function toForm(l?: LeaseRow | null): Form {
  return {
    property_id: l?.property_id ?? "",
    unit_id: l?.unit_id ?? "",
    tenancy_code: l?.tenancy_code ?? "",
    tenancy_type: l?.tenancy_type ?? "",
    tenancy_class: l?.tenancy_class ?? "",
    term_type: l?.term_type ?? "",
    start_date: l?.start_date ?? "",
    end_date: l?.end_date ?? "",
    commencement_date: l?.commencement_date ?? "",
    rent_commencement_date: l?.rent_commencement_date ?? "",
    deposit_received: l?.deposit_received ? "true" : "false",
    move_in_date: l?.move_in_date ?? "",
    renewal_date: l?.renewal_date ?? "",
    rent_amount: l?.rent_amount != null ? String(l.rent_amount) : "",
    payment_frequency: l?.payment_frequency ?? "",
    payment_timing: l?.payment_timing ?? "",
    quarter_type: l?.quarter_type ?? "",
    due_weekday: l?.due_weekday != null ? String(l.due_weekday) : "",
    due_dom: l?.due_dom != null ? String(l.due_dom) : "",
    status: l?.status ?? "",
    rent_nominal_id: l?.rent_nominal_id ?? "",
    deposit_amount: l?.deposit_amount != null ? String(l.deposit_amount) : "",
    deposit_scheme: l?.deposit_scheme ?? "",
    deposit_reference: l?.deposit_reference ?? "",
    deposit_protected_date: l?.deposit_protected_date ?? "",
    deposit_returned_date: l?.deposit_returned_date ?? "",
    exclude_from_reminders: l?.exclude_from_reminders ? "true" : "false",
    notes: l?.notes ?? "",
  };
}

type Review = { effective_date: string; new_amount: string };

export function TenanciesClient({
  leases,
  properties,
  tenants,
  options,
  nominals,
  perms,
  editId,
  renewId,
}: {
  leases: LeaseRow[];
  properties: Opt[];
  tenants: Opt[];
  options: Record<string, Option[]>;
  nominals: Opt[];
  perms: Perms;
  editId?: string;
  renewId?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LeaseRow | null>(null);
  const [form, setForm] = useState<Form>(toForm());
  const [tenantIds, setTenantIds] = useState<string[]>([]);
  const [lead, setLead] = useState<string>("");
  const [reviews, setReviews] = useState<Review[]>([]);
  const [customDates, setCustomDates] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [statusF, setStatusF] = useState("");
  const [propertyF, setPropertyF] = useState("");
  const [freqF, setFreqF] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const reviewsOf = (l?: LeaseRow | null): Review[] =>
    (l?.reviews ?? []).map((r) => ({ effective_date: r.effective_date, new_amount: String(r.new_amount) }));
  const customDatesOf = (l?: LeaseRow | null): string[] => (l?.custom_due_dates ?? []).filter(Boolean);

  function leaseTenants(l?: LeaseRow | null) {
    const ts = l?.tenants ?? [];
    return { ids: ts.map((t) => t.id), lead: ts.find((t) => t.is_lead)?.id ?? ts[0]?.id ?? "" };
  }
  function toggleTenant(id: string) {
    setTenantIds((cur) => {
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
      setLead((ld) => (next.includes(ld) ? ld : next[0] ?? ""));
      return next;
    });
  }

  function openCreate() {
    setEditing(null); setForm(toForm()); setTenantIds([]); setLead(""); setReviews([]); setCustomDates([]); setError(null); setOpen(true);
  }
  function openEdit(l: LeaseRow) {
    setEditing(l); setForm(toForm(l));
    const { ids, lead } = leaseTenants(l); setTenantIds(ids); setLead(lead);
    setReviews(reviewsOf(l)); setCustomDates(customDatesOf(l));
    setError(null); setOpen(true);
  }
  function openRenew(l: LeaseRow) {
    // New lease pre-filled from the old one: dates rolled forward 12 months.
    const base = toForm(l);
    const oldEnd = l.end_date ? new Date(l.end_date) : new Date();
    const newStart = new Date(oldEnd);
    const newEnd = new Date(oldEnd);
    newEnd.setFullYear(newEnd.getFullYear() + 1);
    setEditing(null);
    setForm({
      ...base,
      start_date: newStart.toISOString().slice(0, 10),
      end_date: newEnd.toISOString().slice(0, 10),
      move_in_date: "",
      renewal_date: "",
      status: "Active",
    });
    const { ids, lead } = leaseTenants(l); setTenantIds(ids); setLead(lead);
    setReviews(reviewsOf(l)); setCustomDates(customDatesOf(l));
    setError(null);
    setOpen(true);
  }
  useEffect(() => {
    if (editId) {
      const l = leases.find((x) => x.id === editId);
      if (l) openEdit(l);
    } else if (renewId) {
      const l = leases.find((x) => x.id === renewId);
      if (l) openRenew(l);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId, renewId]);
  function save() {
    setError(null);
    const cleanReviews = reviews
      .filter((r) => r.effective_date && r.new_amount !== "")
      .map((r) => ({ effective_date: r.effective_date, new_amount: Number(r.new_amount) }));
    const payload = { ...form, tenant_ids: tenantIds, lead_tenant_id: lead, reviews: cleanReviews, custom_due_dates: customDates.filter(Boolean) };
    startTransition(async () => {
      const res = editing ? await updateLease(editing.id, payload) : await createLease(payload);
      if (!res.ok) return setError(res.error);
      setOpen(false); router.refresh(); toast.success("Lease saved.");
    });
  }
  async function remove(l: LeaseRow) {
    if (!(await confirm({ message: "Delete this lease? This cannot be undone.", danger: true, confirmLabel: "Delete" }))) return;
    startTransition(async () => {
      const res = await deleteLease(l.id);
      if (!res.ok) return toast.error(res.error);
      router.refresh();
    });
  }

  const filtered = leases.filter((l) => {
    const q = query.trim().toLowerCase();
    const names = `${l.tenants.map((t) => t.name ?? "").join(" ")} ${l.tenant?.full_name ?? ""}`.toLowerCase();
    const matchQ = !q || names.includes(q) || (l.property?.address ?? "").toLowerCase().includes(q);
    return matchQ
      && (!statusF || tenancyStatus(l) === statusF)
      && (!propertyF || l.property_id === propertyF)
      && (!freqF || l.payment_frequency === freqF);
  });

  return (
    <>
      <Topbar
        search="Search leases…"
        action={
          perms.create ? (
            <Button size="toolbar" className="gap-[6px]" onClick={openCreate}>
              <Plus strokeWidth={1.8} className="h-[16px] w-[16px]" />
              New lease
            </Button>
          ) : undefined
        }
      />
      <main className="flex flex-1 flex-col gap-[22px] overflow-y-auto thin-scroll px-[34px] py-[30px]">
        <div>
          <h1 className="text-[26px] font-semibold tracking-[-0.01em] text-text">Tenancies</h1>
          <p className="mt-[2px] text-[14px] text-muted">Active and past tenancies, with their rent schedules.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Input placeholder="Search tenant or property…" className="h-[44px] max-w-[360px]" value={query} onChange={(e) => setQuery(e.target.value)} />
          <FilterSelect value={statusF} onChange={setStatusF} placeholder="All statuses" options={[{ value: "Current", label: "Current" }, { value: "Future", label: "Future" }, { value: "Past", label: "Past" }]} />
          <FilterSelect value={propertyF} onChange={setPropertyF} placeholder="All properties" options={properties} />
          <FilterSelect value={freqF} onChange={setFreqF} placeholder="All frequencies" options={options.payment_frequency ?? []} />
        </div>
        <Card className="overflow-x-auto p-0">
          <div className="grid min-w-[840px] grid-cols-[1.3fr_1.6fr_0.9fr_1fr_1fr_0.8fr_auto] items-center gap-4 border-b border-border px-6 py-4 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">
            <span>Tenant</span><span>Property</span><span>Rent</span><span>Start</span><span>End</span><span>Status</span><span className="text-right">Action</span>
          </div>
          {filtered.length === 0 && (
            <div className="grid place-items-center py-16 text-center">
              <p className="text-[15px] font-medium text-text-2">No tenancies match</p>
              <p className="mt-1 text-[15px] text-muted">{perms.create ? "Create a lease — the rent schedule generates automatically." : "No records available."}</p>
            </div>
          )}
          {filtered.map((l) => (
            <div key={l.id} onClick={() => router.push(`/tenancies/${l.id}`)} className="grid min-w-[840px] cursor-pointer grid-cols-[1.3fr_1.6fr_0.9fr_1fr_1fr_0.8fr_auto] items-center gap-4 border-b border-border px-6 py-4 text-[14px] transition-colors last:border-b-0 hover:bg-surface-2/40">
              <Link href={`/tenancies/${l.id}`} className="truncate font-medium text-text hover:text-accent">
                {l.tenants.length ? l.tenants.find((t) => t.is_lead)?.name ?? l.tenants[0].name : l.tenant?.full_name || "—"}
                {l.tenants.length > 1 ? ` +${l.tenants.length - 1}` : ""}
              </Link>
              <span className="truncate text-text-2">{l.property?.address || "—"}</span>
              <span className="font-display text-[16px] font-semibold text-text">{l.rent_amount != null ? gbp(l.rent_amount) : "—"}</span>
              <span className="text-text-2">{l.start_date ? fmtDate(l.start_date) : "—"}</span>
              <span className="text-text-2">{l.end_date ? fmtDate(l.end_date) : "—"}</span>
              <span>{(() => { const s = tenancyStatus(l); return <Badge tone={tenancyStatusTone(s)} dot>{s}</Badge>; })()}</span>
              <span className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                {perms.edit && (
                  <button onClick={() => openEdit(l)} className="grid h-8 w-8 place-items-center rounded-md text-text-2 transition-colors hover:bg-surface-2/60" aria-label="Edit">
                    <Pencil strokeWidth={1.6} className="h-[16px] w-[16px]" />
                  </button>
                )}
                {perms.remove && (
                  <button onClick={() => remove(l)} className="grid h-8 w-8 place-items-center rounded-md text-[var(--bad)] transition-colors hover:bg-[color-mix(in_oklch,var(--bad)_12%,transparent)]" aria-label="Delete">
                    <Trash2 strokeWidth={1.6} className="h-[16px] w-[16px]" />
                  </button>
                )}
              </span>
            </div>
          ))}
        </Card>
      </main>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Edit lease" : "New lease"}
        subtitle="Lease terms — the rent schedule regenerates on save"
        footer={
          <>
            {error && <span className="mr-auto text-[15px] font-medium text-[var(--bad)]">{error}</span>}
            <Button variant="ghost" size="toolbar" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="toolbar" onClick={save} disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? "Save changes" : "Create lease"}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-5">
          <SelectField label="Property" value={form.property_id} onChange={(v) => set("property_id", v)} options={properties} className="col-span-2" placeholder="Choose a property…" />
          <div className="col-span-2">
            <p className="mb-2 text-[12.5px] font-semibold text-text">Tenants <span className="font-normal text-muted">— one or more; the lead receives statements</span></p>
            <div className="max-h-[200px] overflow-y-auto thin-scroll rounded-md border border-border">
              {tenants.length === 0 && <p className="px-3 py-3 text-[15px] text-muted">No tenants yet — add tenants first.</p>}
              {tenants.map((t) => {
                const checked = tenantIds.includes(t.value);
                return (
                  <div key={t.value} className="flex items-center gap-3 border-b border-border px-3 py-2 last:border-b-0">
                    <label className="flex flex-1 cursor-pointer items-center gap-2 text-[13.5px] text-text">
                      <input type="checkbox" checked={checked} onChange={() => toggleTenant(t.value)} className="h-4 w-4 accent-[var(--gold)]" />
                      {t.label}
                    </label>
                    {checked && (
                      <label className="flex cursor-pointer items-center gap-1 text-[12px] text-muted">
                        <input type="radio" name="lead-tenant" checked={lead === t.value} onChange={() => setLead(t.value)} className="accent-[var(--gold)]" /> Lead
                      </label>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <SelectFieldOpt label="Term type" value={form.term_type} onChange={(v) => set("term_type", v)} options={[{ value: "Fixed", label: "Fixed" }, { value: "Variable", label: "Variable" }]} className="col-span-2" />
          <Field label="Tenancy start"><Input type="date" value={form.start_date} onChange={(e) => set("start_date", e.target.value)} /></Field>
          {form.term_type !== "Variable" && (
            <Field label="Tenancy end"><Input type="date" value={form.end_date} onChange={(e) => set("end_date", e.target.value)} /></Field>
          )}
          <Field label="Tenancy commencement"><Input type="date" value={form.commencement_date} onChange={(e) => set("commencement_date", e.target.value)} /></Field>
          <Field label="Rent commencement"><Input type="date" value={form.rent_commencement_date} onChange={(e) => set("rent_commencement_date", e.target.value)} /></Field>
          <Field label="Agreed rent (£)"><Input type="number" step="0.01" min={0} value={form.rent_amount} onChange={(e) => set("rent_amount", e.target.value)} /></Field>
          <SelectFieldOpt label="Payment frequency" value={form.payment_frequency} onChange={(v) => set("payment_frequency", v)} options={options.payment_frequency} />
          <SelectFieldOpt label="Payment timing" value={form.payment_timing} onChange={(v) => set("payment_timing", v)} options={[{ value: "Advance", label: "In advance" }, { value: "Arrears", label: "In arrears" }]} />
          {form.payment_frequency === "Quarterly" && (
            <SelectFieldOpt label="Quarter type" value={form.quarter_type} onChange={(v) => set("quarter_type", v)} options={[{ value: "English", label: "English quarter days" }, { value: "Calendar", label: "Calendar quarters" }]} />
          )}
          {(form.payment_frequency === "Weekly" || form.payment_frequency === "Fortnightly") && (
            <SelectFieldOpt label="Due weekday" value={form.due_weekday} onChange={(v) => set("due_weekday", v)} options={[{ value: "1", label: "Monday" }, { value: "2", label: "Tuesday" }, { value: "3", label: "Wednesday" }, { value: "4", label: "Thursday" }, { value: "5", label: "Friday" }, { value: "6", label: "Saturday" }, { value: "0", label: "Sunday" }]} />
          )}
          {(form.payment_frequency === "Monthly" || form.payment_frequency === "Quarterly" || form.payment_frequency === "Annually") && (
            <Field label="Due day of month"><Input type="number" min={1} max={31} value={form.due_dom} onChange={(e) => set("due_dom", e.target.value)} /></Field>
          )}
          {form.payment_frequency === "Custom" && (
            <div className="col-span-2 rounded-md border border-border p-3">
              <p className="mb-2 text-[12.5px] font-semibold text-text">Custom due dates <span className="font-normal text-muted">— rent is due on exactly these dates</span></p>
              {customDates.length === 0 && <p className="mb-2 text-[12.5px] text-muted">No dates yet.</p>}
              {customDates.map((dt, i) => (
                <div key={i} className="mb-2 grid grid-cols-[1fr_auto] items-center gap-2">
                  <Input type="date" value={dt} onChange={(e) => setCustomDates((ds) => ds.map((x, idx) => (idx === i ? e.target.value : x)))} />
                  <button type="button" onClick={() => setCustomDates((ds) => ds.filter((_, idx) => idx !== i))} aria-label="Remove" className="grid h-9 w-9 place-items-center rounded-md text-[var(--bad)] hover:bg-[color-mix(in_oklch,var(--bad)_12%,transparent)]"><Trash2 strokeWidth={1.6} className="h-[15px] w-[15px]" /></button>
                </div>
              ))}
              <button type="button" onClick={() => setCustomDates((ds) => [...ds, ""])} className="text-[12.5px] font-semibold text-accent hover:underline">+ Add date</button>
            </div>
          )}
          {(() => {
            const preview = computeDueDates({
              start: form.rent_commencement_date || form.start_date || null,
              end: form.end_date || null,
              frequency: form.payment_frequency,
              timing: form.payment_timing,
              quarterType: form.quarter_type,
              dueWeekday: form.due_weekday === "" ? null : Number(form.due_weekday),
              dueDom: form.due_dom === "" ? null : Number(form.due_dom),
              customDates: customDates.filter(Boolean),
              horizon: 4,
            }).slice(0, 4);
            return (
              <div className="col-span-2 rounded-md border border-border bg-surface-2/40 px-4 py-3 text-[13px] text-text-2">
                <p className="mb-1 font-semibold text-text">Example due dates</p>
                {preview.length ? <p>{preview.map((x) => fmtDate(x)).join(" · ")}{preview.length >= 4 ? " · …" : ""}</p> : <p className="text-muted">Set a rent commencement date and frequency to preview.</p>}
              </div>
            );
          })()}
          <SelectFieldOpt label="Rent nominal" value={form.rent_nominal_id} onChange={(v) => set("rent_nominal_id", v)} options={nominals} />
          <SelectFieldOpt label="Tenancy type" value={form.tenancy_type} onChange={(v) => set("tenancy_type", v)} options={options.tenancy_code} />
          <Field label="Tenancy code"><Input value={form.tenancy_code} onChange={(e) => set("tenancy_code", e.target.value)} placeholder="Internal code (optional)" /></Field>
          <SelectFieldOpt label="Tenancy class" value={form.tenancy_class} onChange={(v) => set("tenancy_class", v)} options={options.tenancy_class} />
          <Field label="Move-in date"><Input type="date" value={form.move_in_date} onChange={(e) => set("move_in_date", e.target.value)} /></Field>
          <Field label="Renewal date"><Input type="date" value={form.renewal_date} onChange={(e) => set("renewal_date", e.target.value)} /></Field>

          {/* Rent reviews */}
          <div className="col-span-2 rounded-md border border-border p-3">
            <p className="mb-2 text-[12.5px] font-semibold text-text">Rent reviews / increases <span className="font-normal text-muted">— amount applies from the effective date</span></p>
            {reviews.length === 0 && <p className="mb-2 text-[12.5px] text-muted">No reviews — rent stays at the agreed amount.</p>}
            {reviews.map((r, i) => (
              <div key={i} className="mb-2 grid grid-cols-[1fr_1fr_auto] items-center gap-2">
                <Input type="date" value={r.effective_date} onChange={(e) => setReviews((rs) => rs.map((x, idx) => idx === i ? { ...x, effective_date: e.target.value } : x))} />
                <Input type="number" step="0.01" min={0} placeholder="New rent (£)" value={r.new_amount} onChange={(e) => setReviews((rs) => rs.map((x, idx) => idx === i ? { ...x, new_amount: e.target.value } : x))} />
                <button type="button" onClick={() => setReviews((rs) => rs.filter((_, idx) => idx !== i))} aria-label="Remove" className="grid h-9 w-9 place-items-center rounded-md text-[var(--bad)] hover:bg-[color-mix(in_oklch,var(--bad)_12%,transparent)]"><Trash2 strokeWidth={1.6} className="h-[15px] w-[15px]" /></button>
              </div>
            ))}
            <button type="button" onClick={() => setReviews((rs) => [...rs, { effective_date: "", new_amount: "" }])} className="text-[12.5px] font-semibold text-accent hover:underline">+ Add review</button>
          </div>

          {/* Deposit */}
          <div className="col-span-2 grid grid-cols-2 gap-5 rounded-md border border-border p-3">
            <p className="col-span-2 text-[12.5px] font-semibold text-text">Deposit</p>
            <Field label="Amount (£)"><Input type="number" step="0.01" min={0} value={form.deposit_amount} onChange={(e) => set("deposit_amount", e.target.value)} /></Field>
            <SelectFieldOpt label="Scheme" value={form.deposit_scheme} onChange={(v) => set("deposit_scheme", v)} options={options.deposit_scheme} />
            <label className="col-span-2 flex cursor-pointer items-center gap-3">
              <input type="checkbox" checked={form.deposit_received === "true"} onChange={(e) => set("deposit_received", e.target.checked ? "true" : "false")} className="h-4 w-4 accent-[var(--gold)]" />
              <span className="text-[15px] text-text">Deposit received</span>
            </label>
          </div>

          <label className="col-span-2 flex cursor-pointer items-center gap-3 rounded-md border border-border px-4 py-3">
            <input type="checkbox" checked={form.exclude_from_reminders === "true"} onChange={(e) => set("exclude_from_reminders", e.target.checked ? "true" : "false")} className="h-4 w-4 accent-[var(--gold)]" />
            <span className="text-[15px] text-text">Exclude this tenancy from overdue-rent reminders</span>
          </label>
          <Field label="Notes" className="col-span-2"><Textarea rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
          <div className="col-span-2 flex items-center gap-2 rounded-md border border-border bg-surface-2/40 px-4 py-3 text-[15px] text-text-2">
            <CalendarClock strokeWidth={1.6} className="h-4 w-4 text-accent" />
            On save, the rent schedule is generated from the rent commencement date at the chosen frequency — paid instalments are preserved.
          </div>
        </div>
      </Drawer>
    </>
  );
}

function SelectField({
  label, value, onChange, options, placeholder = "Choose…", className,
}: {
  label: string; value: string; onChange: (v: string) => void;
  options: Opt[]; placeholder?: string; className?: string;
}) {
  return (
    <Field label={label} className={className}>
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{placeholder}</option>
        {options.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
      </Select>
    </Field>
  );
}

function SelectFieldOpt({
  label, value, onChange, options, className,
}: {
  label: string; value: string; onChange: (v: string) => void;
  options?: Option[]; className?: string;
}) {
  return (
    <Field label={label} className={className}>
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Choose…</option>
        {(options ?? []).map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
      </Select>
    </Field>
  );
}
