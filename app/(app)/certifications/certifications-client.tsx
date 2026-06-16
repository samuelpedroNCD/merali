"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Plus, Pencil, Trash2, Loader2, ExternalLink } from "lucide-react";
import { Topbar } from "@/components/shell/topbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge, type Tone } from "@/components/ui/badge";
import { Input, Field, Select, Textarea } from "@/components/ui/input";
import { Drawer } from "@/components/ui/drawer";
import { fmtDate } from "@/lib/utils";
import type { CertificationRow } from "@/lib/data/certifications";
import { createCertification, updateCertification, deleteCertification, bulkCreateCertifications } from "./actions";

type Perms = { create: boolean; edit: boolean; remove: boolean };
type Opt = { value: string; label: string };
type Form = Record<string, string>;

function expiryInfo(expiry: string | null): { tone: Tone; label: string } {
  if (!expiry) return { tone: "muted", label: "No expiry" };
  const days = Math.ceil((new Date(expiry).getTime() - Date.now()) / 86400000);
  if (days < 0) return { tone: "bad", label: "Expired" };
  if (days <= 30) return { tone: "warn", label: `${days}d left` };
  return { tone: "good", label: "Valid" };
}

function toForm(c?: CertificationRow | null): Form {
  return {
    property_id: c?.property_id ?? "",
    type_id: c?.type_id ?? "",
    expiry_date: c?.expiry_date ?? "",
    document_link: c?.document_link ?? "",
    notes: c?.notes ?? "",
  };
}

export function CertificationsClient({
  certs,
  types,
  properties,
  perms,
}: {
  certs: CertificationRow[];
  types: Opt[];
  properties: Opt[];
  perms: Perms;
}) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CertificationRow | null>(null);
  const [form, setForm] = useState<Form>(toForm());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  // Bulk add
  type BulkRow = { type_id: string; expiry_date: string; document_link: string };
  const emptyRow: BulkRow = { type_id: "", expiry_date: "", document_link: "" };
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkProperty, setBulkProperty] = useState("");
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([{ ...emptyRow }, { ...emptyRow }, { ...emptyRow }]);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const setRow = (i: number, k: keyof BulkRow, v: string) =>
    setBulkRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)));
  function openBulk() {
    setBulkProperty(""); setBulkRows([{ ...emptyRow }, { ...emptyRow }, { ...emptyRow }]); setBulkError(null); setBulkOpen(true);
  }
  function saveBulk() {
    setBulkError(null);
    startTransition(async () => {
      const res = await bulkCreateCertifications(bulkProperty, bulkRows);
      if (!res.ok) return setBulkError(res.error);
      setBulkOpen(false); toast.success("Certificates added."); router.refresh();
    });
  }

  function openCreate() {
    setEditing(null); setForm(toForm()); setError(null); setOpen(true);
  }
  function openEdit(c: CertificationRow) {
    setEditing(c); setForm(toForm(c)); setError(null); setOpen(true);
  }
  function save() {
    setError(null);
    startTransition(async () => {
      const res = editing ? await updateCertification(editing.id, form) : await createCertification(form);
      if (!res.ok) return setError(res.error);
      setOpen(false); router.refresh(); toast.success("Certificate saved.");
    });
  }
  async function remove(c: CertificationRow) {
    if (!(await confirm({ message: "Delete this certification? This cannot be undone.", danger: true, confirmLabel: "Delete" }))) return;
    startTransition(async () => {
      const res = await deleteCertification(c.id);
      if (!res.ok) return toast.error(res.error);
      router.refresh();
    });
  }

  return (
    <>
      <Topbar
        search="Search certifications…"
        action={
          perms.create ? (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="toolbar" className="gap-[6px]" onClick={openBulk}>
                <Plus strokeWidth={1.8} className="h-[16px] w-[16px]" /> Bulk add
              </Button>
              <Button size="toolbar" className="gap-[6px]" onClick={openCreate}>
                <Plus strokeWidth={1.8} className="h-[16px] w-[16px]" /> New certification
              </Button>
            </div>
          ) : undefined
        }
      />
      <main className="flex flex-1 flex-col gap-[22px] overflow-y-auto thin-scroll px-[34px] py-[30px]">
        <div>
          <h1 className="text-[26px] font-semibold tracking-[-0.01em] text-text">Certifications</h1>
          <p className="mt-[2px] text-[14px] text-muted">Compliance certificates and expiry tracking.</p>
        </div>
        <Card className="overflow-x-auto p-0">
          <div className="grid min-w-[640px] grid-cols-[1.4fr_1.6fr_1fr_0.9fr_auto] items-center gap-4 border-b border-border px-6 py-4 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">
            <span>Type</span><span>Property</span><span>Expiry</span><span>Status</span><span className="text-right">Action</span>
          </div>
          {certs.length === 0 && (
            <div className="grid place-items-center py-16 text-center">
              <p className="text-[15px] font-medium text-text-2">No certifications yet</p>
              <p className="mt-1 text-[15px] text-muted">{perms.create ? "Add a certification to track its expiry." : "No records available."}</p>
            </div>
          )}
          {certs.map((c) => {
            const info = expiryInfo(c.expiry_date);
            return (
              <div key={c.id} onClick={() => perms.edit && openEdit(c)} className="grid min-w-[640px] cursor-pointer grid-cols-[1.4fr_1.6fr_1fr_0.9fr_auto] items-center gap-4 border-b border-border px-6 py-4 text-[14px] transition-colors last:border-b-0 hover:bg-surface-2/40">
                <span className="inline-flex items-center gap-2 truncate font-medium text-text">
                  {c.type?.name || "—"}
                  {c.document_link && (
                    <a href={c.document_link} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-muted hover:text-accent">
                      <ExternalLink strokeWidth={1.6} className="h-[14px] w-[14px]" />
                    </a>
                  )}
                </span>
                <span className="truncate text-text-2">{c.property?.address || "—"}</span>
                <span className="text-text-2">{c.expiry_date ? fmtDate(c.expiry_date) : "—"}</span>
                <span><Badge tone={info.tone} dot>{info.label}</Badge></span>
                <span className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                  {perms.edit && (
                    <button onClick={() => openEdit(c)} className="grid h-8 w-8 place-items-center rounded-md text-text-2 transition-colors hover:bg-surface-2/60" aria-label="Edit">
                      <Pencil strokeWidth={1.6} className="h-[16px] w-[16px]" />
                    </button>
                  )}
                  {perms.remove && (
                    <button onClick={() => remove(c)} className="grid h-8 w-8 place-items-center rounded-md text-[var(--bad)] transition-colors hover:bg-[color-mix(in_oklch,var(--bad)_12%,transparent)]" aria-label="Delete">
                      <Trash2 strokeWidth={1.6} className="h-[16px] w-[16px]" />
                    </button>
                  )}
                </span>
              </div>
            );
          })}
        </Card>
      </main>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Edit certification" : "New certification"}
        subtitle="Add or edit the certification"
        size="md"
        footer={
          <>
            {error && <span className="mr-auto text-[15px] font-medium text-[var(--bad)]">{error}</span>}
            <Button variant="ghost" size="toolbar" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="toolbar" onClick={save} disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? "Save changes" : "Create"}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-5">
          <Field label="Property">
            <Select value={form.property_id} onChange={(e) => set("property_id", e.target.value)}>
              <option value="">Choose…</option>
              {properties.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
            </Select>
          </Field>
          <Field label="Type">
            <Select value={form.type_id} onChange={(e) => set("type_id", e.target.value)}>
              <option value="">Choose…</option>
              {types.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
            </Select>
          </Field>
          <Field label="Expiry date"><Input type="date" value={form.expiry_date} onChange={(e) => set("expiry_date", e.target.value)} /></Field>
          <Field label="Document link"><Input value={form.document_link} onChange={(e) => set("document_link", e.target.value)} placeholder="https://…" /></Field>
          <Field label="Notes"><Textarea rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
        </div>
      </Drawer>

      <Drawer
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        title="Bulk add certificates"
        subtitle="Add several certificate links for one property at once"
        size="md"
        footer={
          <>
            {bulkError && <span className="mr-auto text-[15px] font-medium text-[var(--bad)]">{bulkError}</span>}
            <Button variant="ghost" size="toolbar" onClick={() => setBulkOpen(false)}>Cancel</Button>
            <Button size="toolbar" onClick={saveBulk} disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />} Add all</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Property">
            <Select value={bulkProperty} onChange={(e) => setBulkProperty(e.target.value)}>
              <option value="">Choose…</option>
              {properties.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
            </Select>
          </Field>
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-[1.2fr_0.9fr_1.6fr] gap-2 text-[11.5px] font-semibold uppercase tracking-[0.05em] text-muted">
              <span>Type</span><span>Expiry</span><span>Document link</span>
            </div>
            {bulkRows.map((r, i) => (
              <div key={i} className="grid grid-cols-[1.2fr_0.9fr_1.6fr] gap-2">
                <Select value={r.type_id} onChange={(e) => setRow(i, "type_id", e.target.value)}>
                  <option value="">—</option>
                  {types.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
                </Select>
                <Input type="date" value={r.expiry_date} onChange={(e) => setRow(i, "expiry_date", e.target.value)} />
                <Input value={r.document_link} onChange={(e) => setRow(i, "document_link", e.target.value)} placeholder="https://…" />
              </div>
            ))}
            <button type="button" onClick={() => setBulkRows((rs) => [...rs, { ...emptyRow }])} className="self-start text-[12.5px] font-semibold text-accent hover:underline">+ Add row</button>
          </div>
        </div>
      </Drawer>
    </>
  );
}
