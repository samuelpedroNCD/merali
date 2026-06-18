"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Plus, Pencil, Trash2, Loader2, History } from "lucide-react";
import { Topbar } from "@/components/shell/topbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Field, Select, Textarea } from "@/components/ui/input";
import { Drawer } from "@/components/ui/drawer";
import { FilterSelect } from "@/components/ui/filter-select";
import type { Option } from "@/lib/data/options";
import type { KeyRow, KeyTotals } from "@/lib/data/keys";
import { createKey, updateKey, deleteKey } from "./actions";
import { KeyDetailDrawer } from "./key-detail-drawer";

type Perms = { create: boolean; edit: boolean; remove: boolean };
type Opt = { value: string; label: string };
type Form = Record<string, string>;

function toForm(k?: KeyRow | null): Form {
  return {
    key_code: k?.key_code ?? "",
    property_id: k?.property_id ?? "",
    held_by_type: k?.held_by_type ?? "",
    status: k?.status ?? "",
    date_given: k?.date_given ?? "",
    date_returned: k?.date_returned ?? "",
    reference_id: k?.reference_id ?? "",
    notes: k?.notes ?? "",
  };
}

export function KeysClient({
  keys,
  totals,
  properties,
  options,
  perms,
}: {
  keys: KeyRow[];
  totals: KeyTotals;
  properties: Opt[];
  options: Record<string, Option[]>;
  perms: Perms;
}) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [query, setQuery] = useState("");
  const [statusF, setStatusF] = useState("");
  const [heldF, setHeldF] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<KeyRow | null>(null);
  const [form, setForm] = useState<Form>(toForm());
  const [detailKeyId, setDetailKeyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  function openCreate() {
    setEditing(null); setForm(toForm()); setError(null); setOpen(true);
  }
  function openEdit(k: KeyRow) {
    setEditing(k); setForm(toForm(k)); setError(null); setOpen(true);
  }
  function save() {
    setError(null);
    startTransition(async () => {
      const res = editing ? await updateKey(editing.id, form) : await createKey(form);
      if (!res.ok) return setError(res.error);
      setOpen(false); router.refresh(); toast.success("Key saved.");
    });
  }
  async function remove(k: KeyRow) {
    if (!(await confirm({ message: `Delete key "${k.key_code ?? ""}"? This cannot be undone.`, danger: true, confirmLabel: "Delete" }))) return;
    startTransition(async () => {
      const res = await deleteKey(k.id);
      if (!res.ok) return toast.error(res.error);
      router.refresh();
    });
  }

  const filtered = keys.filter((k) => {
    const q = query.trim().toLowerCase();
    return (!q || (k.key_code ?? "").toLowerCase().includes(q))
      && (!statusF || k.status === statusF)
      && (!heldF || k.held_by_type === heldF);
  });

  return (
    <>
      <Topbar
        search="Search by key code…"
        action={
          perms.create ? (
            <Button size="toolbar" className="gap-[6px]" onClick={openCreate}>
              <Plus strokeWidth={1.8} className="h-[16px] w-[16px]" /> Issue new key
            </Button>
          ) : undefined
        }
      />
      <main className="flex flex-1 flex-col gap-[22px] overflow-y-auto thin-scroll px-[34px] py-[30px]">
        <div>
          <h1 className="text-[26px] font-semibold tracking-[-0.01em] text-text">Key Tracker</h1>
          <p className="mt-[2px] text-[14px] text-muted">Track and manage property keys.</p>
        </div>
        <div className="grid grid-cols-2 gap-[18px] lg:grid-cols-4">
          <StatCard label="Total copies" value={totals.total} />
          <StatCard label="Copies out" value={totals.out} />
          <StatCard label="Spare copies" value={totals.spare} />
          <StatCard label="Lost keys" value={totals.lost} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Input placeholder="Search by key code…" className="max-w-[460px]" value={query} onChange={(e) => setQuery(e.target.value)} />
          <FilterSelect value={statusF} onChange={setStatusF} placeholder="All statuses" options={options.key_status ?? []} />
          <FilterSelect value={heldF} onChange={setHeldF} placeholder="All holders" options={options.held_by_type ?? []} />
        </div>
        <Card className="overflow-x-auto p-0">
          <div className="grid min-w-[760px] grid-cols-[1fr_1.8fr_0.7fr_1.1fr_auto] items-center gap-3 border-b border-border px-6 py-4 text-[11.5px] font-semibold uppercase tracking-[0.05em] text-muted">
            <span>Key code</span><span>Property</span><span className="text-center">Copies</span><span>Movement</span><span className="text-right">Action</span>
          </div>
          {filtered.length === 0 && (
            <div className="grid place-items-center py-16 text-center">
              <p className="text-[15px] font-medium text-text-2">No keys yet</p>
              <p className="mt-1 text-[15px] text-muted">{perms.create ? "Add your first key code." : "No records available."}</p>
            </div>
          )}
          {filtered.map((k) => {
            const lost = (k.status ?? "").toLowerCase() === "lost";
            return (
            <div key={k.id} onClick={() => setDetailKeyId(k.id)} className="grid min-w-[760px] cursor-pointer grid-cols-[1fr_1.8fr_0.7fr_1.1fr_auto] items-center gap-3 border-b border-border px-6 py-4 text-[13.5px] transition-colors last:border-b-0 hover:bg-surface-2/40">
              <button onClick={() => setDetailKeyId(k.id)} className="truncate text-left font-semibold text-text hover:text-accent">{k.key_code || "—"}</button>
              <span className="truncate text-text-2">{k.property?.address || "—"}</span>
              <span className="text-center text-text-2">{k.copies_total}</span>
              <span>
                {lost ? <Badge tone="bad" dot>Lost</Badge>
                  : k.copies_out > 0 ? <Badge tone="warn" dot>{k.copies_out} of {k.copies_total} out</Badge>
                  : <Badge tone="good" dot>All in office</Badge>}
              </span>
              <span className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => setDetailKeyId(k.id)} className="grid h-8 w-8 place-items-center rounded-md text-accent transition-colors hover:bg-surface-2/60" aria-label="Movement log: issue / return & history" title="Movement log: issue / return & history">
                  <History strokeWidth={1.6} className="h-[16px] w-[16px]" />
                </button>
                {perms.edit && (
                  <button onClick={() => openEdit(k)} className="grid h-8 w-8 place-items-center rounded-md text-text-2 transition-colors hover:bg-surface-2/60" aria-label="Edit">
                    <Pencil strokeWidth={1.6} className="h-[16px] w-[16px]" />
                  </button>
                )}
                {perms.remove && (
                  <button onClick={() => remove(k)} className="grid h-8 w-8 place-items-center rounded-md text-[var(--bad)] transition-colors hover:bg-[color-mix(in_oklch,var(--bad)_12%,transparent)]" aria-label="Delete">
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
        title={editing ? "Edit key" : "Issue new key"}
        subtitle="Add or edit the key information"
        size="md"
        footer={
          <>
            {error && <span className="mr-auto text-[15px] font-medium text-[var(--bad)]">{error}</span>}
            <Button variant="ghost" size="toolbar" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="toolbar" onClick={save} disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? "Save changes" : "Create key"}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-5">
          <Field label="Key code"><Input value={form.key_code} onChange={(e) => set("key_code", e.target.value)} /></Field>
          <Field label="Reference ID"><Input value={form.reference_id} onChange={(e) => set("reference_id", e.target.value)} /></Field>
          <SelectFieldOpt label="Property" value={form.property_id} onChange={(v) => set("property_id", v)} options={properties} className="col-span-2" />
          <SelectField label="Held by type" value={form.held_by_type} onChange={(v) => set("held_by_type", v)} options={options.held_by_type} />
          <SelectField label="Status" value={form.status} onChange={(v) => set("status", v)} options={options.key_status} />
          <Field label="Date given"><Input type="date" value={form.date_given} onChange={(e) => set("date_given", e.target.value)} /></Field>
          <Field label="Date returned"><Input type="date" value={form.date_returned} onChange={(e) => set("date_returned", e.target.value)} /></Field>
          <Field label="Notes" className="col-span-2"><Textarea rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
        </div>
        {editing && (
          <p className="mt-4 text-[15px] text-muted">
            Use the history button on the key row to issue/return and manage spares.
          </p>
        )}
      </Drawer>

      <KeyDetailDrawer
        keyId={detailKeyId}
        open={!!detailKeyId}
        onClose={() => setDetailKeyId(null)}
        onChanged={() => router.refresh()}
        heldByTypes={options.held_by_type ?? []}
        statuses={options.key_status ?? []}
      />
    </>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <p className="text-[15px] text-muted">{label}</p>
      <p className="mt-2 font-display text-[30px] font-semibold text-text">{value}</p>
    </Card>
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
function SelectFieldOpt({ label, value, onChange, options, className }: { label: string; value: string; onChange: (v: string) => void; options: Opt[]; className?: string; }) {
  return (
    <Field label={label} className={className}>
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Choose…</option>
        {options.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
      </Select>
    </Field>
  );
}
