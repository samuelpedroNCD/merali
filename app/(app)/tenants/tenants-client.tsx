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
import { AddressAutocomplete } from "@/components/ui/address-autocomplete";
import { FilterSelect } from "@/components/ui/filter-select";
import type { Option } from "@/lib/data/options";
import type { TenantRow, TenantContact } from "@/lib/data/tenants";
import { createTenant, updateTenant, deleteTenant } from "./actions";

type Contact = { type: string; name: string; email: string; phone: string; relationship: string; address: string };

const TABS = [
  { key: "personal", label: "Personal" },
  { key: "forwarding", label: "Forwarding" },
  { key: "contacts", label: "Contacts" },
  { key: "notes", label: "Notes" },
];

type Perms = { create: boolean; edit: boolean; remove: boolean };
type Form = Record<string, string>;

function toForm(t?: TenantRow | null): Form {
  return {
    is_company: t?.is_company ? "true" : "false",
    company_name: t?.company_name ?? "",
    company_address: t?.company_address ?? "",
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
    notes: t?.notes ?? "",
  };
}

function contactsOf(t?: TenantRow | null): Contact[] {
  return (t?.contacts ?? []).map((c: TenantContact) => ({
    type: c.type ?? "Emergency",
    name: c.name ?? "",
    email: c.email ?? "",
    phone: c.phone ?? "",
    relationship: c.relationship ?? "",
    address: c.address ?? "",
  }));
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
  const [statusF, setStatusF] = useState("");
  const [companyF, setCompanyF] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TenantRow | null>(null);
  const [tab, setTab] = useState("personal");
  const [form, setForm] = useState<Form>(toForm());
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const updateContact = (i: number, k: keyof Contact, v: string) =>
    setContacts((cs) => cs.map((c, idx) => (idx === i ? { ...c, [k]: v } : c)));

  function openCreate() {
    setEditing(null); setForm(toForm()); setContacts([]); setTab("personal"); setError(null); setOpen(true);
  }
  function openEdit(t: TenantRow) {
    setEditing(t); setForm(toForm(t)); setContacts(contactsOf(t)); setTab("personal"); setError(null); setOpen(true);
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
      const payload = { ...form, contacts };
      const res = editing ? await updateTenant(editing.id, payload) : await createTenant(payload);
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
    const s = query.trim().toLowerCase();
    const matchQ = !s || (t.full_name ?? "").toLowerCase().includes(s) || (t.email ?? "").toLowerCase().includes(s);
    const matchStatus = !statusF || t.status === statusF;
    const matchCompany = !companyF || (companyF === "company" ? !!t.is_company : !t.is_company);
    return matchQ && matchStatus && matchCompany;
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
        <div className="flex flex-wrap items-center gap-3">
          <Input placeholder="Search by name or email…" className="h-[44px] max-w-[460px]" value={query} onChange={(e) => setQuery(e.target.value)} />
          <FilterSelect value={statusF} onChange={setStatusF} placeholder="All statuses" options={options.tenant_status ?? []} />
          <FilterSelect value={companyF} onChange={setCompanyF} placeholder="Individuals & companies" options={[{ value: "individual", label: "Individuals" }, { value: "company", label: "Companies" }]} />
        </div>
        <Card className="overflow-x-auto p-0">
          <div className="grid min-w-[680px] grid-cols-[1.4fr_1.6fr_1fr_0.8fr_auto] items-center gap-4 border-b border-border px-6 py-4 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">
            <span>Name</span><span>Email</span><span>Phone</span><span>Status</span><span className="text-right">Action</span>
          </div>
          {filtered.length === 0 && (
            <div className="grid place-items-center py-16 text-center">
              <p className="text-[15px] font-medium text-text-2">No tenants yet</p>
              <p className="mt-1 text-[15px] text-muted">{perms.create ? "Add your first tenant to get started." : "No records available."}</p>
            </div>
          )}
          {filtered.map((t) => (
            <div key={t.id} onClick={() => router.push(`/tenants/${t.id}`)} className="grid min-w-[680px] cursor-pointer grid-cols-[1.4fr_1.6fr_1fr_0.8fr_auto] items-center gap-4 border-b border-border px-6 py-4 text-[14px] transition-colors last:border-b-0 hover:bg-surface-2/40">
              <Link href={`/tenants/${t.id}`} className="truncate font-medium text-text hover:text-accent">{t.full_name || "—"}</Link>
              <span className="truncate text-text-2">{t.email || "—"}</span>
              <span className="text-text-2">{t.phone || "—"}</span>
              <span>{t.status ? <Badge tone={statusTone(t.status)} dot>{t.status}</Badge> : <span className="text-muted">—</span>}</span>
              <span className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
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
            {error && <span className="mr-auto text-[15px] font-medium text-[var(--bad)]">{error}</span>}
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
            <label className="col-span-2 flex cursor-pointer items-center gap-3 rounded-md border border-border px-4 py-3">
              <input type="checkbox" checked={form.is_company === "true"} onChange={(e) => set("is_company", e.target.checked ? "true" : "false")} className="h-4 w-4 accent-[var(--gold)]" />
              <span className="text-[13.5px] font-medium text-text">This tenant is a company</span>
            </label>
            {form.is_company === "true" ? (
              <>
                <Field label="Company name" className="col-span-2"><Input value={form.company_name} onChange={(e) => set("company_name", e.target.value)} placeholder="e.g. Acme Ltd" /></Field>
                <Field label="Company address" className="col-span-2">
                  <AddressAutocomplete value={form.company_address} onChange={(v) => set("company_address", v)} onResolve={(a) => set("company_address", a.address)} />
                </Field>
              </>
            ) : (
              <>
                <Field label="First name"><Input value={form.first_name} onChange={(e) => set("first_name", e.target.value)} /></Field>
                <Field label="Last name"><Input value={form.last_name} onChange={(e) => set("last_name", e.target.value)} /></Field>
              </>
            )}
            <Field label="Email"><Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} /></Field>
            <Field label="Phone"><Input value={form.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
            <SelectField label="Status" value={form.status} onChange={(v) => set("status", v)} options={options.tenant_status} />
            <SelectField label="Preferred contact method" value={form.preferred_contact} onChange={(v) => set("preferred_contact", v)} options={[{ value: "Email", label: "Email" }, { value: "Phone", label: "Phone" }]} />
          </div>
        )}
        {tab === "forwarding" && (
          <Field label="Forwarding address" hint="Where to forward post after the tenancy ends.">
            <AddressAutocomplete
              value={form.forwarding_address}
              onChange={(v) => set("forwarding_address", v)}
              onResolve={(a) => set("forwarding_address", a.address)}
            />
          </Field>
        )}
        {tab === "contacts" && (
          <div className="flex flex-col gap-4">
            <p className="text-[12.5px] text-muted">Emergency contacts and guarantors — add as many as needed.</p>
            {contacts.length === 0 && <p className="text-[13px] text-muted">No contacts added yet.</p>}
            {contacts.map((c, i) => (
              <div key={i} className="rounded-lg border border-border p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <Select value={c.type} onChange={(e) => updateContact(i, "type", e.target.value)} className="w-auto min-w-[160px]">
                    <option value="Emergency">Emergency</option>
                    <option value="Guarantor">Guarantor</option>
                  </Select>
                  <button type="button" onClick={() => setContacts((cs) => cs.filter((_, idx) => idx !== i))} aria-label="Remove contact" className="grid h-9 w-9 place-items-center rounded-md text-[var(--bad)] hover:bg-[color-mix(in_oklch,var(--bad)_12%,transparent)]"><Trash2 strokeWidth={1.6} className="h-[15px] w-[15px]" /></button>
                </div>
                <div className="grid grid-cols-2 gap-5">
                  <Field label="Name"><Input value={c.name} onChange={(e) => updateContact(i, "name", e.target.value)} /></Field>
                  <Field label="Phone"><Input value={c.phone} onChange={(e) => updateContact(i, "phone", e.target.value)} /></Field>
                  <Field label="Email"><Input type="email" value={c.email} onChange={(e) => updateContact(i, "email", e.target.value)} /></Field>
                  {c.type === "Emergency" && (
                    <SelectField label="Relationship" value={c.relationship} onChange={(v) => updateContact(i, "relationship", v)} options={options.nok_relationship} />
                  )}
                  <Field label="Address" className="col-span-2"><Input value={c.address} onChange={(e) => updateContact(i, "address", e.target.value)} /></Field>
                </div>
              </div>
            ))}
            <div className="flex gap-4">
              <button type="button" onClick={() => setContacts((cs) => [...cs, { type: "Emergency", name: "", email: "", phone: "", relationship: "", address: "" }])} className="text-[12.5px] font-semibold text-accent hover:underline">+ Add emergency contact</button>
              <button type="button" onClick={() => setContacts((cs) => [...cs, { type: "Guarantor", name: "", email: "", phone: "", relationship: "", address: "" }])} className="text-[12.5px] font-semibold text-accent hover:underline">+ Add guarantor</button>
            </div>
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
