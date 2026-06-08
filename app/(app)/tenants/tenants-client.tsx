"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { Topbar } from "@/components/shell/topbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { tenantStatusTone as statusTone } from "@/lib/badge-tones";
import { Input, Field, Select, Textarea } from "@/components/ui/input";
import { Drawer } from "@/components/ui/drawer";
import { Tabs } from "@/components/ui/tabs";
import type { Option } from "@/lib/data/options";
import type { TenantRow } from "@/lib/data/tenants";
import { createTenant, updateTenant, deleteTenant } from "./actions";

const TABS = [
  { key: "personal", label: "Personal" },
  { key: "nok", label: "Next of Kin" },
  { key: "guarantor", label: "Guarantor" },
  { key: "notes", label: "Notes" },
];

type Perms = { create: boolean; edit: boolean; remove: boolean };
type Form = Record<string, string>;

function toForm(t?: TenantRow | null): Form {
  return {
    first_name: t?.first_name ?? "",
    last_name: t?.last_name ?? "",
    email: t?.email ?? "",
    phone: t?.phone ?? "",
    forwarding_address: t?.forwarding_address ?? "",
    position: t?.position ?? "",
    tenant_code: t?.tenant_code ?? "",
    preferred_contact: t?.preferred_contact ?? "",
    tenant_type: t?.tenant_type ?? "",
    status: t?.status ?? "",
    acquired_date: t?.acquired_date ?? "",
    nok_name: t?.nok_name ?? "",
    nok_phone: t?.nok_phone ?? "",
    nok_email: t?.nok_email ?? "",
    nok_address: t?.nok_address ?? "",
    nok_relationship: t?.nok_relationship ?? "",
    guarantor_name: t?.guarantor_name ?? "",
    guarantor_email: t?.guarantor_email ?? "",
    guarantor_phone: t?.guarantor_phone ?? "",
    notes: t?.notes ?? "",
  };
}

export function TenantsClient({
  tenants,
  options,
  perms,
  editId,
}: {
  tenants: TenantRow[];
  options: Record<string, Option[]>;
  perms: Perms;
  editId?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TenantRow | null>(null);
  const [tab, setTab] = useState("personal");
  const [form, setForm] = useState<Form>(toForm());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  function openCreate() {
    setEditing(null); setForm(toForm()); setTab("personal"); setError(null); setOpen(true);
  }
  function openEdit(t: TenantRow) {
    setEditing(t); setForm(toForm(t)); setTab("personal"); setError(null); setOpen(true);
  }
  useEffect(() => {
    if (!editId) return;
    const t = tenants.find((x) => x.id === editId);
    if (t) openEdit(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);
  function save() {
    setError(null);
    startTransition(async () => {
      const res = editing ? await updateTenant(editing.id, form) : await createTenant(form);
      if (!res.ok) return setError(res.error);
      setOpen(false); router.refresh(); toast.success("Tenant saved.");
    });
  }
  async function remove(t: TenantRow) {
    if (!(await confirm({ message: `Delete tenant "${t.full_name ?? ""}"? This cannot be undone.`, danger: true, confirmLabel: "Delete" }))) return;
    startTransition(async () => {
      const res = await deleteTenant(t.id);
      if (!res.ok) return toast.error(res.error);
      router.refresh();
    });
  }

  const filtered = tenants.filter((t) => {
    if (!query.trim()) return true;
    const s = query.toLowerCase();
    return (
      (t.full_name ?? "").toLowerCase().includes(s) ||
      (t.email ?? "").toLowerCase().includes(s)
    );
  });

  return (
    <>
      <Topbar
        search="Search tenants…"
        action={
          perms.create ? (
            <Button size="toolbar" className="gap-[6px]" onClick={openCreate}>
              <Plus strokeWidth={1.8} className="h-[16px] w-[16px]" />
              Add tenant
            </Button>
          ) : undefined
        }
      />
      <main className="flex flex-1 flex-col gap-[22px] overflow-y-auto thin-scroll px-[34px] py-[30px]">
        <div>
          <h1 className="text-[26px] font-semibold tracking-[-0.01em] text-text">Tenants</h1>
          <p className="mt-[2px] text-[14px] text-muted">Tenant records, tenancies and arrears.</p>
        </div>
        <Input placeholder="Search by name or email…" className="max-w-[460px]" value={query} onChange={(e) => setQuery(e.target.value)} />
        <Card className="overflow-x-auto p-0">
          <div className="grid min-w-[680px] grid-cols-[1.4fr_1.6fr_1fr_0.8fr_auto] items-center gap-4 border-b border-border px-6 py-4 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">
            <span>Name</span><span>Email</span><span>Phone</span><span>Status</span><span className="text-right">Action</span>
          </div>
          {filtered.length === 0 && (
            <div className="grid place-items-center py-16 text-center">
              <p className="text-[15px] font-medium text-text-2">No tenants yet</p>
              <p className="mt-1 text-[13px] text-muted">{perms.create ? "Add your first tenant to get started." : "No records available."}</p>
            </div>
          )}
          {filtered.map((t) => (
            <div key={t.id} className="grid min-w-[680px] grid-cols-[1.4fr_1.6fr_1fr_0.8fr_auto] items-center gap-4 border-b border-border px-6 py-4 text-[14px] last:border-b-0">
              <Link href={`/tenants/${t.id}`} className="truncate font-medium text-text hover:text-accent">{t.full_name || "—"}</Link>
              <span className="truncate text-text-2">{t.email || "—"}</span>
              <span className="text-text-2">{t.phone || "—"}</span>
              <span>{t.status ? <Badge tone={statusTone(t.status)} dot>{t.status}</Badge> : <span className="text-muted">—</span>}</span>
              <span className="flex justify-end gap-1">
                {perms.edit && (
                  <button onClick={() => openEdit(t)} className="grid h-8 w-8 place-items-center rounded-md text-text-2 transition-colors hover:bg-surface-2/60" aria-label="Edit">
                    <Pencil strokeWidth={1.6} className="h-[16px] w-[16px]" />
                  </button>
                )}
                {perms.remove && (
                  <button onClick={() => remove(t)} className="grid h-8 w-8 place-items-center rounded-md text-[var(--bad)] transition-colors hover:bg-[color-mix(in_oklch,var(--bad)_12%,transparent)]" aria-label="Delete">
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
        title={editing ? "Edit tenant" : "Add tenant"}
        subtitle="Add or edit the tenant information"
        footer={
          <>
            {error && <span className="mr-auto text-[13px] font-medium text-[var(--bad)]">{error}</span>}
            <Button variant="ghost" size="toolbar" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="toolbar" onClick={save} disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? "Save changes" : "Create tenant"}
            </Button>
          </>
        }
      >
        <Tabs tabs={TABS} value={tab} onChange={setTab} className="mb-6" />
        {tab === "personal" && (
          <div className="grid grid-cols-2 gap-5">
            <Field label="First name"><Input value={form.first_name} onChange={(e) => set("first_name", e.target.value)} /></Field>
            <Field label="Last name"><Input value={form.last_name} onChange={(e) => set("last_name", e.target.value)} /></Field>
            <Field label="Email"><Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} /></Field>
            <Field label="Phone"><Input value={form.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
            <Field label="Forwarding address" className="col-span-2"><Input value={form.forwarding_address} onChange={(e) => set("forwarding_address", e.target.value)} /></Field>
            <Field label="Tenant code"><Input value={form.tenant_code} onChange={(e) => set("tenant_code", e.target.value)} /></Field>
            <Field label="Position"><Input value={form.position} onChange={(e) => set("position", e.target.value)} /></Field>
            <SelectField label="Tenant type" value={form.tenant_type} onChange={(v) => set("tenant_type", v)} options={options.tenant_type} />
            <SelectField label="Status" value={form.status} onChange={(v) => set("status", v)} options={options.tenant_status} />
            <SelectField label="Preferred contact method" value={form.preferred_contact} onChange={(v) => set("preferred_contact", v)} options={options.preferred_contact} />
            <Field label="Acquired date"><Input type="date" value={form.acquired_date} onChange={(e) => set("acquired_date", e.target.value)} /></Field>
          </div>
        )}
        {tab === "nok" && (
          <div className="grid grid-cols-2 gap-5">
            <Field label="Next of kin name"><Input value={form.nok_name} onChange={(e) => set("nok_name", e.target.value)} /></Field>
            <Field label="Next of kin phone"><Input value={form.nok_phone} onChange={(e) => set("nok_phone", e.target.value)} /></Field>
            <Field label="Next of kin email"><Input type="email" value={form.nok_email} onChange={(e) => set("nok_email", e.target.value)} /></Field>
            <SelectField label="Relationship" value={form.nok_relationship} onChange={(v) => set("nok_relationship", v)} options={options.nok_relationship} />
            <Field label="Next of kin address" className="col-span-2"><Input value={form.nok_address} onChange={(e) => set("nok_address", e.target.value)} /></Field>
          </div>
        )}
        {tab === "guarantor" && (
          <div className="grid grid-cols-2 gap-5">
            <Field label="Guarantor name" className="col-span-2"><Input value={form.guarantor_name} onChange={(e) => set("guarantor_name", e.target.value)} /></Field>
            <Field label="Guarantor email"><Input type="email" value={form.guarantor_email} onChange={(e) => set("guarantor_email", e.target.value)} /></Field>
            <Field label="Guarantor phone"><Input value={form.guarantor_phone} onChange={(e) => set("guarantor_phone", e.target.value)} /></Field>
          </div>
        )}
        {tab === "notes" && (
          <Field label="Notes">
            <Textarea rows={6} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Internal notes about this tenant…" />
          </Field>
        )}
      </Drawer>
    </>
  );
}

function SelectField({
  label, value, onChange, options, placeholder = "Choose…", className,
}: {
  label: string; value: string; onChange: (v: string) => void;
  options?: Option[]; placeholder?: string; className?: string;
}) {
  return (
    <Field label={label} className={className}>
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{placeholder}</option>
        {(options ?? []).map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
      </Select>
    </Field>
  );
}
