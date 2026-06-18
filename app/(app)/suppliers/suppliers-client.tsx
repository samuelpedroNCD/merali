"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { Topbar } from "@/components/shell/topbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supplierStatusTone as statusTone } from "@/lib/badge-tones";
import { Input, Field, Select, Textarea } from "@/components/ui/input";
import { Drawer } from "@/components/ui/drawer";
import { FilterSelect } from "@/components/ui/filter-select";
import { gbp } from "@/lib/utils";
import type { Option } from "@/lib/data/options";
import type { SupplierRow } from "@/lib/data/suppliers";
import { createSupplier, updateSupplier, deleteSupplier } from "./actions";

type Perms = { create: boolean; edit: boolean; remove: boolean };
type Form = Record<string, string>;

function toForm(s?: SupplierRow | null): Form {
  return {
    business_name: s?.business_name ?? "",
    primary_contact_name: s?.primary_contact_name ?? "",
    primary_contact_email: s?.primary_contact_email ?? "",
    type: s?.type ?? "",
    status: s?.status ?? "",
    outstanding: s?.outstanding != null ? String(s.outstanding) : "",
    preferred: s?.preferred ? "true" : "false",
    notes: s?.notes ?? "",
  };
}

export function SuppliersClient({
  suppliers,
  options,
  perms,
}: {
  suppliers: SupplierRow[];
  options: Record<string, Option[]>;
  perms: Perms;
}) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [query, setQuery] = useState("");
  const [typeF, setTypeF] = useState("");
  const [statusF, setStatusF] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SupplierRow | null>(null);
  const [form, setForm] = useState<Form>(toForm());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const stats = useMemo(() => {
    const total = suppliers.length;
    const active = suppliers.filter(
      (s) => (s.status ?? "").toLowerCase() === "active" || (s.status ?? "").toLowerCase() === "preferred",
    ).length;
    const outstanding = suppliers.reduce((a, s) => a + Number(s.outstanding ?? 0), 0);
    return { total, active, outstanding };
  }, [suppliers]);

  function openCreate() {
    setEditing(null); setForm(toForm()); setError(null); setOpen(true);
  }
  function openEdit(s: SupplierRow) {
    setEditing(s); setForm(toForm(s)); setError(null); setOpen(true);
  }
  function save() {
    setError(null);
    startTransition(async () => {
      const res = editing ? await updateSupplier(editing.id, form) : await createSupplier(form);
      if (!res.ok) return setError(res.error);
      setOpen(false); router.refresh(); toast.success("Supplier saved.");
    });
  }
  async function remove(s: SupplierRow) {
    if (!(await confirm({ message: `Delete supplier "${s.business_name}"? This cannot be undone.`, danger: true, confirmLabel: "Delete" }))) return;
    startTransition(async () => {
      const res = await deleteSupplier(s.id);
      if (!res.ok) return toast.error(res.error);
      router.refresh();
    });
  }

  const filtered = suppliers.filter((s) => {
    const q = query.trim().toLowerCase();
    return (!q || s.business_name.toLowerCase().includes(q))
      && (!typeF || s.type === typeF)
      && (!statusF || s.status === statusF);
  });

  return (
    <>
      <Topbar
        search="Search suppliers…"
        action={
          perms.create ? (
            <Button size="toolbar" className="gap-[6px]" onClick={openCreate}>
              <Plus strokeWidth={1.8} className="h-[16px] w-[16px]" /> Add supplier
            </Button>
          ) : undefined
        }
      />
      <main className="flex flex-1 flex-col gap-[22px] overflow-y-auto thin-scroll px-[34px] py-[30px]">
        <div>
          <h1 className="text-[26px] font-semibold tracking-[-0.01em] text-text">Suppliers</h1>
          <p className="mt-[2px] text-[14px] text-muted">Manage contractors and service providers.</p>
        </div>
        <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-3">
          <Card><p className="text-[15px] text-muted">Total suppliers</p><p className="mt-2 font-display text-[28px] font-semibold text-text">{stats.total}</p></Card>
          <Card><p className="text-[15px] text-muted">Active suppliers</p><p className="mt-2 font-display text-[28px] font-semibold text-text">{stats.active}</p></Card>
          <Card><p className="text-[15px] text-muted">Outstanding bills</p><p className="mt-2 font-display text-[28px] font-semibold text-text">{gbp(stats.outstanding)}</p></Card>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Input placeholder="Search suppliers…" className="max-w-[460px]" value={query} onChange={(e) => setQuery(e.target.value)} />
          <FilterSelect value={typeF} onChange={setTypeF} placeholder="All types" options={options.supplier_type ?? []} />
          <FilterSelect value={statusF} onChange={setStatusF} placeholder="All statuses" options={options.supplier_status ?? []} />
        </div>
        <Card className="overflow-x-auto p-0">
          <div className="grid min-w-[720px] grid-cols-[1.5fr_1.5fr_1fr_0.9fr_0.8fr_auto] items-center gap-4 border-b border-border px-6 py-4 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">
            <span>Business</span><span>Contact</span><span>Type</span><span>Status</span><span className="text-right">Outstanding</span><span className="text-right">Action</span>
          </div>
          {filtered.length === 0 && (
            <div className="grid place-items-center py-16 text-center">
              <p className="text-[15px] font-medium text-text-2">No suppliers yet</p>
              <p className="mt-1 text-[15px] text-muted">{perms.create ? "Add your first supplier." : "No records available."}</p>
            </div>
          )}
          {filtered.map((s) => (
            <div key={s.id} onClick={() => perms.edit && openEdit(s)} className="grid min-w-[720px] cursor-pointer grid-cols-[1.5fr_1.5fr_1fr_0.9fr_0.8fr_auto] items-center gap-4 border-b border-border px-6 py-4 text-[14px] transition-colors last:border-b-0 hover:bg-surface-2/40">
              <span className="truncate font-medium text-text">{s.business_name}</span>
              <span className="truncate text-text-2">{s.primary_contact_name || s.primary_contact_email || "—"}</span>
              <span className="text-text-2">{s.type || "—"}</span>
              <span>{s.status ? <Badge tone={statusTone(s.status)} dot>{s.status}</Badge> : <span className="text-muted">—</span>}</span>
              <span className="text-right text-text-2">{s.outstanding != null ? gbp(Number(s.outstanding)) : "—"}</span>
              <span className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                {perms.edit && (
                  <button onClick={() => openEdit(s)} className="grid h-8 w-8 place-items-center rounded-md text-text-2 transition-colors hover:bg-surface-2/60" aria-label="Edit">
                    <Pencil strokeWidth={1.6} className="h-[16px] w-[16px]" />
                  </button>
                )}
                {perms.remove && (
                  <button onClick={() => remove(s)} className="grid h-8 w-8 place-items-center rounded-md text-[var(--bad)] transition-colors hover:bg-[color-mix(in_oklch,var(--bad)_12%,transparent)]" aria-label="Delete">
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
        title={editing ? "Edit supplier" : "Add supplier"}
        subtitle="Add or edit the supplier information"
        size="md"
        footer={
          <>
            {error && <span className="mr-auto text-[15px] font-medium text-[var(--bad)]">{error}</span>}
            <Button variant="ghost" size="toolbar" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="toolbar" onClick={save} disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? "Save changes" : "Create supplier"}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-5">
          <Field label="Business name" className="col-span-2"><Input value={form.business_name} onChange={(e) => set("business_name", e.target.value)} /></Field>
          <Field label="Primary contact name"><Input value={form.primary_contact_name} onChange={(e) => set("primary_contact_name", e.target.value)} /></Field>
          <Field label="Primary contact email"><Input type="email" value={form.primary_contact_email} onChange={(e) => set("primary_contact_email", e.target.value)} /></Field>
          <SelectField label="Type" value={form.type} onChange={(v) => set("type", v)} options={options.supplier_type} />
          <SelectField label="Status" value={form.status} onChange={(v) => set("status", v)} options={options.supplier_status} />
          <Field label="Outstanding (£)"><Input type="number" step="0.01" value={form.outstanding} onChange={(e) => set("outstanding", e.target.value)} /></Field>
          <Field label="Preferred?">
            <Select value={form.preferred} onChange={(e) => set("preferred", e.target.value)}>
              <option value="false">No</option>
              <option value="true">Yes</option>
            </Select>
          </Field>
          <Field label="Notes" className="col-span-2"><Textarea rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
        </div>
      </Drawer>
    </>
  );
}

function SelectField({ label, value, onChange, options, className }: { label: string; value: string; onChange: (v: string) => void; options?: Option[]; className?: string; }) {
  return (
    <Field label={label} className={className}>
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Choose…</option>
        {(options ?? []).map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
      </Select>
    </Field>
  );
}
