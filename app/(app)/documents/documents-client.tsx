"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Plus, Trash2, Loader2, ExternalLink } from "lucide-react";
import { Topbar } from "@/components/shell/topbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Field, Select } from "@/components/ui/input";
import { Drawer } from "@/components/ui/drawer";
import { fmtDate } from "@/lib/utils";
import type { Option } from "@/lib/data/options";
import type { DocumentRow } from "@/lib/data/documents";
import { createDocument, deleteDocument, getEntityOptions } from "./actions";

type Perms = { create: boolean; remove: boolean };
const blank = { name: "", external_link: "", linked_to: "", entity_id: "", expiry_date: "", tag: "" };

export function DocumentsClient({
  documents,
  options,
  perms,
}: {
  documents: DocumentRow[];
  options: Record<string, Option[]>;
  perms: Perms;
}) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...blank });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [entityOpts, setEntityOpts] = useState<{ value: string; label: string }[]>([]);
  const [entityLoading, setEntityLoading] = useState(false);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function onLinkedToChange(v: string) {
    setForm((f) => ({ ...f, linked_to: v, entity_id: "" }));
    setEntityOpts([]);
    if (v && v !== "General") {
      setEntityLoading(true);
      setEntityOpts(await getEntityOptions(v));
      setEntityLoading(false);
    }
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await createDocument(form);
      if (!res.ok) return setError(res.error);
      setOpen(false);
      toast.success("Document saved.");
      setForm({ ...blank });
      router.refresh();
    });
  }
  async function remove(d: DocumentRow) {
    if (!(await confirm({ message: `Delete document "${d.name}"? This cannot be undone.`, danger: true, confirmLabel: "Delete" }))) return;
    startTransition(async () => {
      const res = await deleteDocument(d.id);
      if (!res.ok) return toast.error(res.error);
      router.refresh();
    });
  }

  const filtered = documents.filter(
    (d) => !query.trim() || d.name.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <>
      <Topbar
        search="Search documents…"
        action={
          perms.create ? (
            <Button
              size="toolbar"
              className="gap-[6px]"
              onClick={() => {
                setForm({ ...blank });
                setError(null);
                setOpen(true);
              }}
            >
              <Plus strokeWidth={1.8} className="h-[16px] w-[16px]" />
              Upload document
            </Button>
          ) : undefined
        }
      />
      <main className="flex flex-1 flex-col gap-[22px] overflow-y-auto thin-scroll px-[34px] py-[30px]">
        <div>
          <h1 className="text-[26px] font-semibold tracking-[-0.01em] text-text">Documents</h1>
          <p className="mt-[2px] text-[14px] text-muted">Document records and external links.</p>
        </div>
        <Input placeholder="Search documents…" className="max-w-[460px]" value={query} onChange={(e) => setQuery(e.target.value)} />
        <Card className="overflow-x-auto p-0">
          <div className="grid min-w-[560px] grid-cols-[2fr_1fr_1fr_auto] items-center gap-4 border-b border-border px-6 py-4 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">
            <span>Name</span><span>Related to</span><span>Expiry</span><span className="text-right">Action</span>
          </div>
          {filtered.length === 0 && (
            <div className="grid place-items-center py-16 text-center">
              <p className="text-[15px] font-medium text-text-2">No documents yet</p>
              <p className="mt-1 text-[15px] text-muted">{perms.create ? "Add a document link to get started." : "No records available."}</p>
            </div>
          )}
          {filtered.map((d) => (
            <div key={d.id} className="grid min-w-[560px] grid-cols-[2fr_1fr_1fr_auto] items-center gap-4 border-b border-border px-6 py-4 text-[14px] last:border-b-0">
              <a href={d.external_link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 truncate font-medium text-text hover:text-accent">
                {d.name}
                <ExternalLink strokeWidth={1.6} className="h-[14px] w-[14px] shrink-0 text-muted" />
              </a>
              <span>{d.linked_to ? <Badge tone="muted">{d.linked_to}</Badge> : <span className="text-muted">—</span>}</span>
              <span className="text-text-2">{d.expiry_date ? fmtDate(d.expiry_date) : "—"}</span>
              <span className="flex justify-end">
                {perms.remove && (
                  <button onClick={() => remove(d)} className="grid h-8 w-8 place-items-center rounded-md text-[var(--bad)] transition-colors hover:bg-[color-mix(in_oklch,var(--bad)_12%,transparent)]" aria-label="Delete">
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
        title="Upload document"
        subtitle="Add an external document link"
        size="md"
        footer={
          <>
            {error && <span className="mr-auto text-[15px] font-medium text-[var(--bad)]">{error}</span>}
            <Button variant="ghost" size="toolbar" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="toolbar" onClick={save} disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Save document
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-5">
          <Field label="Name"><Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Tenancy agreement" /></Field>
          <Field label="Link"><Input value={form.external_link} onChange={(e) => set("external_link", e.target.value)} placeholder="https://…" /></Field>
          <Field label="What is this document related to?">
            <Select value={form.linked_to} onChange={(e) => onLinkedToChange(e.target.value)}>
              <option value="">Choose…</option>
              {(options.document_linked_to ?? []).map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
            </Select>
          </Field>
          {form.linked_to && form.linked_to !== "General" && (
            <Field label={`Which ${form.linked_to.toLowerCase()}?`}>
              <Select value={form.entity_id} onChange={(e) => set("entity_id", e.target.value)} disabled={entityLoading}>
                <option value="">{entityLoading ? "Loading…" : "Choose…"}</option>
                {entityOpts.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
              </Select>
            </Field>
          )}
          <Field label="Expiration date"><Input type="date" value={form.expiry_date} onChange={(e) => set("expiry_date", e.target.value)} /></Field>
        </div>
      </Drawer>
    </>
  );
}
