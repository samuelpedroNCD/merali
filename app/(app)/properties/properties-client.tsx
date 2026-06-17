"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import Link from "next/link";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { Topbar } from "@/components/shell/topbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { propertyStatusTone as statusTone } from "@/lib/badge-tones";
import { Input, Field, Select, Textarea } from "@/components/ui/input";
import { Drawer } from "@/components/ui/drawer";
import { InlineAddSelect } from "@/components/ui/inline-add-select";
import { Tabs } from "@/components/ui/tabs";
import { AddressAutocomplete } from "@/components/ui/address-autocomplete";
import { gbp } from "@/lib/utils";
import type { Option } from "@/lib/data/options";
import type { PropertyRow } from "@/lib/data/properties";
import { isChildConfig } from "@/lib/property-config";
import { createProperty, updateProperty, deleteProperty } from "./actions";

const TABS = [
  { key: "identification", label: "Identification" },
  { key: "ownership", label: "Ownership & Registration" },
  { key: "notes", label: "Notes" },
];

type Perms = { create: boolean; edit: boolean; remove: boolean };
type Form = Record<string, string>;
type TitleDoc = { doc_date: string; tenure: string; title_number: string };

function toForm(p?: PropertyRow | null): Form {
  return {
    address: p?.address ?? "",
    flat: p?.flat ?? "",
    town: p?.town ?? "",
    post_code: p?.post_code ?? "",
    country: p?.country ?? "United Kingdom",
    area: p?.area ?? "",
    internal_code: p?.internal_code ?? "",
    configuration: p?.configuration ?? "",
    parent_property_id: p?.parent_property_id ?? "",
    class: p?.class ?? "",
    property_type: p?.property_type ?? "",
    status: p?.status ?? "",
    tenancy_class: p?.tenancy_class ?? "",
    property_tax: p?.property_tax ?? "",
    bedrooms: p?.bedrooms != null ? String(p.bedrooms) : "",
    landlord_id: p?.landlord_id ?? "",
    date_acquired: p?.date_acquired ?? "",
    leasehold_register_number: p?.leasehold_register_number ?? "",
    target_rent: p?.target_rent != null ? String(p.target_rent) : "",
    target_rent_month: p?.target_rent_month ?? "",
    notes: p?.notes ?? "",
  };
}

export function PropertiesClient({
  properties,
  landlords,
  containers,
  options,
  perms,
  editId,
}: {
  properties: PropertyRow[];
  landlords: Option[];
  containers: Option[];
  options: Record<string, Option[]>;
  perms: Perms;
  editId?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PropertyRow | null>(null);
  const [tab, setTab] = useState("identification");
  const [form, setForm] = useState<Form>(toForm());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const [titles, setTitles] = useState<TitleDoc[]>([]);
  const titlesOf = (p?: PropertyRow | null): TitleDoc[] =>
    (p?.titles ?? []).map((t) => ({ doc_date: t.doc_date ?? "", tenure: t.tenure ?? "", title_number: t.title_number ?? "" }));
  const updateTitle = (i: number, k: keyof TitleDoc, v: string) =>
    setTitles((ts) => ts.map((t, idx) => (idx === i ? { ...t, [k]: v } : t)));

  // Parent options exclude the property being edited so it can't be its own parent.
  const parentOptions = containers.filter((c) => c.value !== editing?.id);
  const needsParent = isChildConfig(form.configuration);

  function openCreate() {
    setEditing(null);
    setForm(toForm());
    setTitles([]);
    setTab("identification");
    setError(null);
    setOpen(true);
  }
  function openEdit(p: PropertyRow) {
    setEditing(p);
    setForm(toForm(p));
    setTitles(titlesOf(p));
    setTab("identification");
    setError(null);
    setOpen(true);
  }

  // Auto-open the edit drawer when arriving via ?edit=<id> (from property detail).
  useEffect(() => {
    if (!editId) return;
    const p = properties.find((x) => x.id === editId);
    if (p) openEdit(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  function save() {
    setError(null);
    const payload = { ...form, titles };
    startTransition(async () => {
      const res = editing
        ? await updateProperty(editing.id, payload)
        : await createProperty(payload);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setOpen(false);
      toast.success("Property saved.");
      router.refresh();
    });
  }

  async function remove(p: PropertyRow) {
    if (!(await confirm({ message: `Delete property "${p.address ?? p.internal_code ?? ""}"? This cannot be undone.`, danger: true, confirmLabel: "Delete" }))) return;
    startTransition(async () => {
      const res = await deleteProperty(p.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      router.refresh();
    });
  }

  // Default to top-level properties (buildings + standalones); a search spans all
  // levels so units/sub-buildings remain findable.
  const filtered = properties.filter((p) => {
    const s = query.trim().toLowerCase();
    if (!s) return p.parent_property_id == null;
    return (
      (p.address ?? "").toLowerCase().includes(s) ||
      (p.internal_code ?? "").toLowerCase().includes(s) ||
      (p.town ?? "").toLowerCase().includes(s)
    );
  });

  return (
    <>
      <Topbar
        search="Search properties…"
        action={
          perms.create ? (
            <Button size="toolbar" className="gap-[6px]" onClick={openCreate}>
              <Plus strokeWidth={1.8} className="h-[16px] w-[16px]" />
              Add property
            </Button>
          ) : undefined
        }
      />

      <main className="flex flex-1 flex-col gap-[22px] overflow-y-auto thin-scroll px-[34px] py-[30px]">
        <div>
          <h1 className="text-[26px] font-semibold tracking-[-0.01em] text-text">
            Properties
          </h1>
          <p className="mt-[2px] text-[14px] text-muted">
            Buildings and standalone properties — open one to see its sub-buildings and units. Search spans every level.
          </p>
        </div>

        <Input
          placeholder="Search by address, code or town…"
          className="max-w-[460px]"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <Card className="overflow-x-auto p-0">
          <div className="grid min-w-[760px] grid-cols-[1.8fr_0.7fr_1fr_0.9fr_0.8fr_auto] items-center gap-4 border-b border-border px-6 py-4 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">
            <span>Property</span>
            <span>Code</span>
            <span>Class</span>
            <span>Status</span>
            <span>Target rent</span>
            <span className="text-right">Action</span>
          </div>

          {filtered.length === 0 && (
            <div className="grid place-items-center py-16 text-center">
              <p className="text-[15px] font-medium text-text-2">
                No properties yet
              </p>
              <p className="mt-1 text-[15px] text-muted">
                {perms.create ? "Add your first property to get started." : "No records available."}
              </p>
            </div>
          )}

          {filtered.map((p) => (
            <div
              key={p.id}
              onClick={() => router.push(`/properties/${p.id}`)}
              className="grid min-w-[760px] cursor-pointer grid-cols-[1.8fr_0.7fr_1fr_0.9fr_0.8fr_auto] items-center gap-4 border-b border-border px-6 py-4 text-[14px] transition-colors last:border-b-0 hover:bg-surface-2/40"
            >
              <div className="flex min-w-0 items-center gap-2">
                <Link
                  href={`/properties/${p.id}`}
                  className="truncate font-medium text-text hover:text-accent"
                >
                  {p.address || "—"}
                </Link>
                {p.configuration && <Badge tone="muted">{p.configuration}</Badge>}
              </div>
              <span className="text-text-2">{p.internal_code || "—"}</span>
              <span className="text-text-2">{p.class || "—"}</span>
              <span>
                {p.status ? (
                  <Badge tone={statusTone(p.status)} dot>
                    {p.status}
                  </Badge>
                ) : (
                  <span className="text-muted">—</span>
                )}
              </span>
              <span className="font-display text-[17px] font-semibold text-text">
                {p.target_rent != null ? gbp(p.target_rent) : "—"}
              </span>
              <span className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                {perms.edit && (
                  <button
                    onClick={() => openEdit(p)}
                    className="grid h-8 w-8 place-items-center rounded-md text-text-2 transition-colors hover:bg-surface-2/60"
                    aria-label="Edit"
                  >
                    <Pencil strokeWidth={1.6} className="h-[16px] w-[16px]" />
                  </button>
                )}
                {perms.remove && (
                  <button
                    onClick={() => remove(p)}
                    className="grid h-8 w-8 place-items-center rounded-md text-[var(--bad)] transition-colors hover:bg-[color-mix(in_oklch,var(--bad)_12%,transparent)]"
                    aria-label="Delete"
                  >
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
        title={editing ? "Edit property" : "Add property"}
        subtitle="Add or edit the property information"
        size="lg"
        footer={
          <>
            {error && (
              <span className="mr-auto text-[15px] font-medium text-[var(--bad)]">
                {error}
              </span>
            )}
            <Button variant="ghost" size="toolbar" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="toolbar" onClick={save} disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? "Save changes" : "Create property"}
            </Button>
          </>
        }
      >
        <Tabs tabs={TABS} value={tab} onChange={setTab} className="mb-6" />

        {tab === "identification" && (
          <div className="grid grid-cols-2 gap-5">
            <Field label="Address" className="col-span-2">
              <AddressAutocomplete
                value={form.address}
                onChange={(v) => set("address", v)}
                onResolve={(a) =>
                  setForm((f) => ({
                    ...f,
                    address: a.address || f.address,
                    flat: a.flat || f.flat,
                    town: a.town || f.town,
                    post_code: a.postCode || f.post_code,
                    area: a.area || f.area,
                    country: a.country || f.country,
                    google_place_id: a.placeId,
                  }))
                }
              />
            </Field>
            <Field label="Flat / Unit / sub-building" className="col-span-2">
              <Input
                placeholder="e.g. Flat 2 (if Google didn't capture it)"
                value={form.flat}
                onChange={(e) => set("flat", e.target.value)}
              />
            </Field>
            <SelectField label="Property configuration" value={form.configuration} onChange={(v) => set("configuration", v)} options={options.property_configuration} />
            {needsParent && (
              <SelectField
                label="Parent (building or sub-building)"
                value={form.parent_property_id}
                onChange={(v) => set("parent_property_id", v)}
                options={parentOptions}
                placeholder="Choose a parent…"
                className="col-span-2"
              />
            )}
            <Field label="Internal code">
              <Input value={form.internal_code} onChange={(e) => set("internal_code", e.target.value)} placeholder="e.g. 323A" />
            </Field>
            <Field label="Town">
              <Input value={form.town} onChange={(e) => set("town", e.target.value)} />
            </Field>
            <Field label="Post code">
              <Input value={form.post_code} onChange={(e) => set("post_code", e.target.value)} />
            </Field>
            <Field label="Country">
              <Input value={form.country} onChange={(e) => set("country", e.target.value)} />
            </Field>
            <Field label="Area">
              <Input value={form.area} onChange={(e) => set("area", e.target.value)} />
            </Field>
            <SelectField label="Class" value={form.class} onChange={(v) => set("class", v)} options={options.property_class} className="col-span-2" />
          </div>
        )}

        {tab === "ownership" && (
          <div className="grid grid-cols-2 gap-5">
            <SelectField label="Landlord" value={form.landlord_id} onChange={(v) => set("landlord_id", v)} options={landlords} placeholder="Choose a landlord…" />
            <SelectField label="Status" value={form.status} onChange={(v) => set("status", v)} options={options.property_status} />
            <InlineAddSelect label="Property type" value={form.property_type} onChange={(v) => set("property_type", v)} options={options.property_type} category="property_type" />
            <SelectField label="Property tax" value={form.property_tax} onChange={(v) => set("property_tax", v)} options={options.property_tax} />
            <Field label="Bedrooms">
              <Input type="number" min={0} value={form.bedrooms} onChange={(e) => set("bedrooms", e.target.value)} />
            </Field>
            <Field label="Date acquired">
              <Input type="date" value={form.date_acquired} onChange={(e) => set("date_acquired", e.target.value)} />
            </Field>
            <div className="col-span-2">
              <p className="mb-2 text-[12.5px] font-semibold text-text">Title documents <span className="font-normal text-muted">— date · tenure · title number; add as many as the property has</span></p>
              {titles.length === 0 && <p className="mb-2 text-[12.5px] text-muted">No title documents yet.</p>}
              {titles.map((t, i) => (
                <div key={i} className="mb-2 grid grid-cols-[1fr_1fr_1.2fr_auto] items-center gap-2">
                  <Input type="date" value={t.doc_date} onChange={(e) => updateTitle(i, "doc_date", e.target.value)} />
                  <Select value={t.tenure} onChange={(e) => updateTitle(i, "tenure", e.target.value)}>
                    <option value="">Tenure…</option>
                    <option>Freehold</option>
                    <option>Leasehold</option>
                  </Select>
                  <Input placeholder="Title number" value={t.title_number} onChange={(e) => updateTitle(i, "title_number", e.target.value)} />
                  <button type="button" onClick={() => setTitles((ts) => ts.filter((_, idx) => idx !== i))} aria-label="Remove" className="grid h-9 w-9 place-items-center rounded-md text-[var(--bad)] hover:bg-[color-mix(in_oklch,var(--bad)_12%,transparent)]"><Trash2 strokeWidth={1.6} className="h-[15px] w-[15px]" /></button>
                </div>
              ))}
              <button type="button" onClick={() => setTitles((ts) => [...ts, { doc_date: "", tenure: "", title_number: "" }])} className="text-[12.5px] font-semibold text-accent hover:underline">+ Add title document</button>
            </div>
          </div>
        )}

        {tab === "notes" && (
          <Field label="Notes">
            <Textarea
              rows={6}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Internal notes about this property…"
            />
          </Field>
        )}
      </Drawer>
    </>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder = "Choose…",
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options?: Option[];
  placeholder?: string;
  className?: string;
}) {
  return (
    <Field label={label} className={className}>
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{placeholder}</option>
        {(options ?? []).map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </Field>
  );
}
