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
import { Input, Field, Select, Textarea } from "@/components/ui/input";
import { Drawer } from "@/components/ui/drawer";
import { Tabs } from "@/components/ui/tabs";
import type { Option } from "@/lib/data/options";
import type { LandlordRow } from "@/lib/data/landlords";
import { createLandlord, updateLandlord, deleteLandlord } from "./actions";

const TABS = [
  { key: "identity", label: "Identity" },
  { key: "company", label: "Company / Trust" },
  { key: "bank", label: "Bank details" },
  { key: "notes", label: "Notes" },
];

type Perms = { create: boolean; edit: boolean; remove: boolean };
type Form = Record<string, string>;

const isIndividualType = (t?: string) => !t || t.toLowerCase() === "individual";
const isTrustType = (t?: string) => !!t && t.toLowerCase().includes("trust");

function toForm(l?: LandlordRow | null): Form {
  return {
    landlord_type: l?.landlord_type ?? "",
    entity_name: l?.entity_name ?? "",
    first_name: l?.first_name ?? "",
    last_name: l?.last_name ?? "",
    // Contact fields are no longer shown but kept so editing preserves any old data.
    email: l?.email ?? "",
    phone: l?.phone ?? "",
    preferred_contact: l?.preferred_contact ?? "",
    main_contact_name: l?.main_contact_name ?? "",
    main_contact_email: l?.main_contact_email ?? "",
    main_contact_phone: l?.main_contact_phone ?? "",
    director_email: l?.director_email ?? "",
    director_phone: l?.director_phone ?? "",
    trustee_email: l?.trustee_email ?? "",
    trustee_phone: l?.trustee_phone ?? "",
    vat_number: l?.vat_number ?? "",
    company_registration_date: l?.company_registration_date ?? "",
    director_name: l?.director_name ?? "",
    trustee_name: l?.trustee_name ?? "",
    bank_account_name: l?.bank_account_name ?? "",
    bank_sort_code: l?.bank_sort_code ?? "",
    bank_account_number: l?.bank_account_number ?? "",
    bank_name: l?.bank_name ?? "",
    bank_reference: l?.bank_reference ?? "",
    notes: l?.notes ?? "",
  };
}

export function LandlordsClient({
  landlords,
  options,
  perms,
  editId,
}: {
  landlords: LandlordRow[];
  options: Record<string, Option[]>;
  perms: Perms;
  editId?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LandlordRow | null>(null);
  const [tab, setTab] = useState("identity");
  const [form, setForm] = useState<Form>(toForm());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  function openCreate() {
    setEditing(null);
    setForm(toForm());
    setTab("identity");
    setError(null);
    setOpen(true);
  }
  function openEdit(l: LandlordRow) {
    setEditing(l);
    setForm(toForm(l));
    setTab("identity");
    setError(null);
    setOpen(true);
  }
  useEffect(() => {
    if (!editId) return;
    const l = landlords.find((x) => x.id === editId);
    if (l) openEdit(l);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);
  function save() {
    setError(null);
    startTransition(async () => {
      const res = editing
        ? await updateLandlord(editing.id, form)
        : await createLandlord(form);
      if (!res.ok) return setError(res.error);
      setOpen(false);
      toast.success("Landlord saved.");
      router.refresh();
    });
  }
  async function remove(l: LandlordRow) {
    if (!(await confirm({ message: `Delete landlord "${l.full_name ?? ""}"? This cannot be undone.`, danger: true, confirmLabel: "Delete" }))) return;
    startTransition(async () => {
      const res = await deleteLandlord(l.id);
      if (!res.ok) return toast.error(res.error);
      router.refresh();
    });
  }

  const filtered = landlords.filter((l) => {
    if (!query.trim()) return true;
    const s = query.toLowerCase();
    return (
      (l.full_name ?? "").toLowerCase().includes(s) ||
      (l.email ?? "").toLowerCase().includes(s)
    );
  });
  const individual = isIndividualType(form.landlord_type);
  const trust = isTrustType(form.landlord_type);

  return (
    <>
      <Topbar
        search="Search landlords…"
        action={
          perms.create ? (
            <Button size="toolbar" className="gap-[6px]" onClick={openCreate}>
              <Plus strokeWidth={1.8} className="h-[16px] w-[16px]" />
              Add landlord
            </Button>
          ) : undefined
        }
      />
      <main className="flex flex-1 flex-col gap-[22px] overflow-y-auto thin-scroll px-[34px] py-[30px]">
        <div>
          <h1 className="text-[26px] font-semibold tracking-[-0.01em] text-text">Landlords</h1>
          <p className="mt-[2px] text-[14px] text-muted">Landlord portfolios, statements and contacts.</p>
        </div>
        <Input
          placeholder="Search by name or email…"
          className="max-w-[460px]"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Card className="overflow-x-auto p-0">
          <div className="grid min-w-[680px] grid-cols-[2fr_1.2fr_0.7fr_auto] items-center gap-4 border-b border-border px-6 py-4 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">
            <span>Name</span>
            <span>Type</span>
            <span>Properties</span>
            <span className="text-right">Action</span>
          </div>
          {filtered.length === 0 && (
            <div className="grid place-items-center py-16 text-center">
              <p className="text-[15px] font-medium text-text-2">No landlords yet</p>
              <p className="mt-1 text-[13px] text-muted">
                {perms.create ? "Add your first landlord to get started." : "No records available."}
              </p>
            </div>
          )}
          {filtered.map((l) => (
            <div
              key={l.id}
              className="grid min-w-[680px] grid-cols-[2fr_1.2fr_0.7fr_auto] items-center gap-4 border-b border-border px-6 py-4 text-[14px] last:border-b-0"
            >
              <Link href={`/landlords/${l.id}`} className="truncate font-medium text-text hover:text-accent">{l.full_name || "—"}</Link>
              <span className="truncate text-text-2">{l.landlord_type || "—"}</span>
              <span><Badge tone="muted">{l.property_count ?? 0}</Badge></span>
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
        title={editing ? "Edit landlord" : "Add landlord"}
        subtitle="Add or edit the landlord information"
        footer={
          <>
            {error && <span className="mr-auto text-[13px] font-medium text-[var(--bad)]">{error}</span>}
            <Button variant="ghost" size="toolbar" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="toolbar" onClick={save} disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? "Save changes" : "Create landlord"}
            </Button>
          </>
        }
      >
        <Tabs tabs={TABS} value={tab} onChange={setTab} className="mb-6" />
        {tab === "identity" && (
          <div className="grid grid-cols-2 gap-5">
            <SelectField label="Landlord type" value={form.landlord_type} onChange={(v) => set("landlord_type", v)} options={options.landlord_type} className="col-span-2" />
            {individual ? (
              <>
                <Field label="First name"><Input value={form.first_name} onChange={(e) => set("first_name", e.target.value)} /></Field>
                <Field label="Last name"><Input value={form.last_name} onChange={(e) => set("last_name", e.target.value)} /></Field>
              </>
            ) : (
              <Field label={trust ? "Trust name" : "Company name"} className="col-span-2">
                <Input value={form.entity_name} onChange={(e) => set("entity_name", e.target.value)} placeholder={trust ? "e.g. The Smith Family Trust" : "e.g. Acme Properties Ltd"} />
              </Field>
            )}
            <p className="col-span-2 text-[12.5px] text-muted">Contact for all landlords is the office, so contact details aren&apos;t needed here.</p>
          </div>
        )}
        {tab === "company" && (
          <div className="grid grid-cols-2 gap-5">
            {individual ? (
              <p className="col-span-2 rounded-md border border-dashed border-border px-4 py-3 text-[13px] text-muted">
                These fields apply to Company / Trust landlords. Set the landlord type to a company or trust to use them.
              </p>
            ) : (
              <>
                <Field label="VAT number"><Input value={form.vat_number} onChange={(e) => set("vat_number", e.target.value)} /></Field>
                <Field label="Registration date"><Input type="date" value={form.company_registration_date} onChange={(e) => set("company_registration_date", e.target.value)} /></Field>
                {trust ? (
                  <Field label="Trustee name" className="col-span-2"><Input value={form.trustee_name} onChange={(e) => set("trustee_name", e.target.value)} /></Field>
                ) : (
                  <Field label="Director name" className="col-span-2"><Input value={form.director_name} onChange={(e) => set("director_name", e.target.value)} /></Field>
                )}
              </>
            )}
          </div>
        )}
        {tab === "bank" && (
          <div className="grid grid-cols-2 gap-5">
            <p className="col-span-2 text-[12.5px] text-muted">Stored once per landlord — used when raising invoices/statements.</p>
            <Field label="Account name" className="col-span-2"><Input value={form.bank_account_name} onChange={(e) => set("bank_account_name", e.target.value)} /></Field>
            <Field label="Sort code"><Input value={form.bank_sort_code} onChange={(e) => set("bank_sort_code", e.target.value)} placeholder="00-00-00" /></Field>
            <Field label="Account number"><Input value={form.bank_account_number} onChange={(e) => set("bank_account_number", e.target.value)} /></Field>
            <Field label="Bank name"><Input value={form.bank_name} onChange={(e) => set("bank_name", e.target.value)} /></Field>
            <Field label="Payment reference"><Input value={form.bank_reference} onChange={(e) => set("bank_reference", e.target.value)} /></Field>
          </div>
        )}
        {tab === "notes" && (
          <Field label="Notes">
            <Textarea rows={6} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Internal notes about this landlord…" />
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
        {(options ?? []).map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </Select>
    </Field>
  );
}
