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
import { leaseStatusTone as statusTone } from "@/lib/badge-tones";
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
    tenant_id: l?.tenant_id ?? "",
    tenancy_code: l?.tenancy_code ?? "",
    start_date: l?.start_date ?? "",
    end_date: l?.end_date ?? "",
    move_in_date: l?.move_in_date ?? "",
    renewal_date: l?.renewal_date ?? "",
    rent_amount: l?.rent_amount != null ? String(l.rent_amount) : "",
    payment_frequency: l?.payment_frequency ?? "",
    status: l?.status ?? "",
    notes: l?.notes ?? "",
  };
}

export function TenanciesClient({
  leases,
  properties,
  tenants,
  options,
  perms,
  editId,
  renewId,
}: {
  leases: LeaseRow[];
  properties: Opt[];
  tenants: Opt[];
  options: Record<string, Option[]>;
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
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  function openCreate() {
    setEditing(null); setForm(toForm()); setError(null); setOpen(true);
  }
  function openEdit(l: LeaseRow) {
    setEditing(l); setForm(toForm(l)); setError(null); setOpen(true);
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
    startTransition(async () => {
      const res = editing ? await updateLease(editing.id, form) : await createLease(form);
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
        <Card className="overflow-x-auto p-0">
          <div className="grid min-w-[840px] grid-cols-[1.3fr_1.6fr_0.9fr_1fr_1fr_0.8fr_auto] items-center gap-4 border-b border-border px-6 py-4 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">
            <span>Tenant</span><span>Property</span><span>Rent</span><span>Start</span><span>End</span><span>Status</span><span className="text-right">Action</span>
          </div>
          {leases.length === 0 && (
            <div className="grid place-items-center py-16 text-center">
              <p className="text-[15px] font-medium text-text-2">No leases yet</p>
              <p className="mt-1 text-[13px] text-muted">{perms.create ? "Create a lease — the rent schedule generates automatically." : "No records available."}</p>
            </div>
          )}
          {leases.map((l) => (
            <div key={l.id} className="grid min-w-[840px] grid-cols-[1.3fr_1.6fr_0.9fr_1fr_1fr_0.8fr_auto] items-center gap-4 border-b border-border px-6 py-4 text-[14px] last:border-b-0">
              <Link href={`/tenancies/${l.id}`} className="truncate font-medium text-text hover:text-accent">{l.tenant?.full_name || "—"}</Link>
              <span className="truncate text-text-2">{l.property?.address || "—"}</span>
              <span className="font-display text-[16px] font-semibold text-text">{l.rent_amount != null ? gbp(l.rent_amount) : "—"}</span>
              <span className="text-text-2">{l.start_date ? fmtDate(l.start_date) : "—"}</span>
              <span className="text-text-2">{l.end_date ? fmtDate(l.end_date) : "—"}</span>
              <span>{l.status ? <Badge tone={statusTone(l.status)} dot>{l.status}</Badge> : <span className="text-muted">—</span>}</span>
              <span className="flex justify-end gap-1">
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
            {error && <span className="mr-auto text-[13px] font-medium text-[var(--bad)]">{error}</span>}
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
          <SelectField label="Tenant" value={form.tenant_id} onChange={(v) => set("tenant_id", v)} options={tenants} className="col-span-2" placeholder="Choose a tenant…" />
          <Field label="Lease start"><Input type="date" value={form.start_date} onChange={(e) => set("start_date", e.target.value)} /></Field>
          <Field label="Lease end"><Input type="date" value={form.end_date} onChange={(e) => set("end_date", e.target.value)} /></Field>
          <Field label="Agreed rent (£)"><Input type="number" step="0.01" min={0} value={form.rent_amount} onChange={(e) => set("rent_amount", e.target.value)} /></Field>
          <SelectFieldOpt label="Payment frequency" value={form.payment_frequency} onChange={(v) => set("payment_frequency", v)} options={options.payment_frequency} />
          <Field label="Move-in date"><Input type="date" value={form.move_in_date} onChange={(e) => set("move_in_date", e.target.value)} /></Field>
          <Field label="Renewal date"><Input type="date" value={form.renewal_date} onChange={(e) => set("renewal_date", e.target.value)} /></Field>
          <SelectFieldOpt label="Status" value={form.status} onChange={(v) => set("status", v)} options={options.lease_status} />
          <SelectFieldOpt label="Tenancy code" value={form.tenancy_code} onChange={(v) => set("tenancy_code", v)} options={options.tenancy_code} />
          <Field label="Notes" className="col-span-2"><Textarea rows={4} value={form.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
          <div className="col-span-2 flex items-center gap-2 rounded-md border border-border bg-surface-2/40 px-4 py-3 text-[13px] text-text-2">
            <CalendarClock strokeWidth={1.6} className="h-4 w-4 text-accent" />
            On save, the rent schedule is generated from the start/end dates at the chosen frequency — paid instalments are preserved.
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
