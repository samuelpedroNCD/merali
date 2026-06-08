"use client";

import { useState, useMemo, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Plus, Pencil, Trash2, Loader2, ChevronDown, MapPin, MessageSquare } from "lucide-react";
import { Topbar } from "@/components/shell/topbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { urgencyTone } from "@/lib/badge-tones";
import { Input, Field, Select, Textarea } from "@/components/ui/input";
import { Drawer } from "@/components/ui/drawer";
import { gbp, fmtDate, cn } from "@/lib/utils";
import type { Option } from "@/lib/data/options";
import type { MaintenanceRow, CommentRow } from "@/lib/data/maintenance";
import { MAINTENANCE_STATUSES } from "@/lib/maintenance-statuses";
import {
  createMaintenance,
  updateMaintenance,
  deleteMaintenance,
  setMaintenanceStatus,
  fetchComments,
  addComment,
} from "./actions";

type Perms = { create: boolean; edit: boolean; remove: boolean };
type Opt = { value: string; label: string };
type Form = Record<string, string>;

function toForm(m?: MaintenanceRow | null): Form {
  return {
    description: m?.description ?? "",
    status: m?.status ?? "Needs Booking",
    urgency: m?.urgency ?? "",
    type: m?.type ?? "",
    property_id: m?.property_id ?? "",
    planned_date: m?.planned_date ?? "",
    completion_date: m?.completion_date ?? "",
    assigned_staff_id: m?.assigned_staff_id ?? "",
    supplier_id: m?.supplier_id ?? "",
    cost: m?.cost != null ? String(m.cost) : "",
    response_time: m?.response_time ?? "",
    resolution_time: m?.resolution_time ?? "",
    notes: m?.notes ?? "",
  };
}

export function MaintenanceClient({
  jobs,
  properties,
  suppliers,
  staff,
  options,
  perms,
}: {
  jobs: MaintenanceRow[];
  properties: Opt[];
  suppliers: Opt[];
  staff: Opt[];
  options: Record<string, Option[]>;
  perms: Perms;
}) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MaintenanceRow | null>(null);
  const [form, setForm] = useState<Form>(toForm());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const grouped = useMemo(() => {
    const g: Record<string, MaintenanceRow[]> = {};
    for (const st of MAINTENANCE_STATUSES) g[st] = [];
    for (const j of jobs) (g[j.status ?? "Needs Booking"] ??= []).push(j);
    return g;
  }, [jobs]);

  function openCreate() {
    setEditing(null); setForm(toForm()); setError(null); setOpen(true);
  }
  function openEdit(m: MaintenanceRow) {
    setEditing(m); setForm(toForm(m)); setError(null); setOpen(true);
  }
  function save() {
    setError(null);
    startTransition(async () => {
      const res = editing ? await updateMaintenance(editing.id, form) : await createMaintenance(form);
      if (!res.ok) return setError(res.error);
      setOpen(false); router.refresh(); toast.success("Job saved.");
    });
  }
  async function remove(m: MaintenanceRow) {
    if (!(await confirm({ message: "Delete this maintenance job? This cannot be undone.", danger: true, confirmLabel: "Delete" }))) return;
    startTransition(async () => {
      const res = await deleteMaintenance(m.id);
      if (!res.ok) return toast.error(res.error);
      router.refresh();
    });
  }
  function move(id: string, status: string) {
    startTransition(async () => {
      const res = await setMaintenanceStatus(id, status);
      if (!res.ok) return toast.error(res.error);
      router.refresh();
    });
  }
  function toggle(st: string) {
    setCollapsed((c) => {
      const n = new Set(c);
      if (n.has(st)) n.delete(st); else n.add(st);
      return n;
    });
  }

  return (
    <>
      <Topbar
        search="Search by name…"
        action={
          perms.create ? (
            <Button size="toolbar" className="gap-[6px]" onClick={openCreate}>
              <Plus strokeWidth={1.8} className="h-[16px] w-[16px]" /> Book new job
            </Button>
          ) : undefined
        }
      />
      <main className="flex flex-1 flex-col gap-[14px] overflow-y-auto thin-scroll px-[34px] py-[30px]">
        <div className="mb-2">
          <h1 className="text-[26px] font-semibold tracking-[-0.01em] text-text">Maintenance</h1>
          <p className="mt-[2px] text-[14px] text-muted">Track jobs across their lifecycle.</p>
        </div>

        {MAINTENANCE_STATUSES.map((st) => {
          const items = grouped[st] ?? [];
          const isCollapsed = collapsed.has(st);
          return (
            <Card key={st} className="p-0">
              <button
                onClick={() => toggle(st)}
                className="flex w-full items-center justify-between px-6 py-4"
              >
                <span className="flex items-center gap-2 text-[15px] font-semibold text-text">
                  {st} <span className="text-muted">({items.length})</span>
                </span>
                <ChevronDown
                  strokeWidth={1.6}
                  className={cn("h-5 w-5 text-muted transition-transform", isCollapsed && "-rotate-90")}
                />
              </button>
              {!isCollapsed && items.length > 0 && (
                <div className="border-t border-border">
                  {items.map((m) => (
                    <div key={m.id} className="flex items-center gap-4 border-b border-border px-6 py-3 last:border-b-0">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-medium text-text">{m.description || "Untitled job"}</p>
                        <p className="mt-[2px] flex items-center gap-1 truncate text-[12.5px] text-muted">
                          {m.property?.address && (
                            <>
                              <MapPin strokeWidth={1.6} className="h-[13px] w-[13px]" />
                              {m.property.address}
                            </>
                          )}
                          {m.staff?.full_name && <span>· {m.staff.full_name}</span>}
                          {m.supplier?.business_name && <span>· {m.supplier.business_name}</span>}
                        </p>
                      </div>
                      {m.cost != null && <span className="text-[13px] text-text-2">{gbp(Number(m.cost))}</span>}
                      {m.planned_date && <span className="text-[12.5px] text-muted">{fmtDate(m.planned_date)}</span>}
                      {m.urgency && <Badge tone={urgencyTone(m.urgency)}>{m.urgency}</Badge>}
                      {perms.edit && (
                        <select
                          value={m.status ?? st}
                          onChange={(e) => move(m.id, e.target.value)}
                          className="h-8 rounded-md border border-border bg-surface px-2 text-[12.5px] text-text-2 outline-none"
                        >
                          {MAINTENANCE_STATUSES.map((s) => (<option key={s} value={s}>{s}</option>))}
                        </select>
                      )}
                      <div className="flex gap-1">
                        {perms.edit && (
                          <button onClick={() => openEdit(m)} className="grid h-8 w-8 place-items-center rounded-md text-text-2 transition-colors hover:bg-surface-2/60" aria-label="Edit">
                            <Pencil strokeWidth={1.6} className="h-[16px] w-[16px]" />
                          </button>
                        )}
                        {perms.remove && (
                          <button onClick={() => remove(m)} className="grid h-8 w-8 place-items-center rounded-md text-[var(--bad)] transition-colors hover:bg-[color-mix(in_oklch,var(--bad)_12%,transparent)]" aria-label="Delete">
                            <Trash2 strokeWidth={1.6} className="h-[16px] w-[16px]" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </main>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Edit maintenance" : "Book new job"}
        subtitle="Add or edit the maintenance information"
        size="lg"
        footer={
          <>
            {error && <span className="mr-auto text-[13px] font-medium text-[var(--bad)]">{error}</span>}
            <Button variant="ghost" size="toolbar" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="toolbar" onClick={save} disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? "Save changes" : "Create job"}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-5">
          <Field label="Description" className="col-span-2"><Textarea rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} /></Field>
          <SelectField label="Status" value={form.status} onChange={(v) => set("status", v)} options={options.maintenance_status} />
          <SelectField label="Urgency" value={form.urgency} onChange={(v) => set("urgency", v)} options={options.maintenance_urgency} />
          <SelectFieldOpt label="Property" value={form.property_id} onChange={(v) => set("property_id", v)} options={properties} />
          <SelectField label="Type" value={form.type} onChange={(v) => set("type", v)} options={options.maintenance_type} />
          <Field label="Planned date"><Input type="date" value={form.planned_date} onChange={(e) => set("planned_date", e.target.value)} /></Field>
          <Field label="Completion date"><Input type="date" value={form.completion_date} onChange={(e) => set("completion_date", e.target.value)} /></Field>
          <SelectFieldOpt label="Assigned staff" value={form.assigned_staff_id} onChange={(v) => set("assigned_staff_id", v)} options={staff} />
          <SelectFieldOpt label="Related supplier" value={form.supplier_id} onChange={(v) => set("supplier_id", v)} options={suppliers} />
          <Field label="Cost (£)"><Input type="number" step="0.01" value={form.cost} onChange={(e) => set("cost", e.target.value)} /></Field>
          <Field label="Response time"><Input value={form.response_time} onChange={(e) => set("response_time", e.target.value)} placeholder="e.g. 2 hours" /></Field>
          <Field label="Resolution time"><Input value={form.resolution_time} onChange={(e) => set("resolution_time", e.target.value)} placeholder="e.g. 3 days" /></Field>
          <Field label="Notes" className="col-span-2"><Textarea rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
        </div>
        {editing && <CommentsSection maintenanceId={editing.id} />}
      </Drawer>
    </>
  );
}

function CommentsSection({ maintenanceId }: { maintenanceId: string }) {
  const toast = useToast();
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [text, setText] = useState("");
  const [pending, start] = useTransition();

  useEffect(() => {
    fetchComments(maintenanceId).then(setComments);
  }, [maintenanceId]);

  function add() {
    if (!text.trim()) return;
    start(async () => {
      const res = await addComment(maintenanceId, text);
      if (!res.ok) return toast.error(res.error);
      setText("");
      setComments(await fetchComments(maintenanceId));
    });
  }

  return (
    <div className="mt-6 border-t border-border pt-5">
      <div className="mb-3 flex items-center gap-2 text-[14px] font-semibold text-text">
        <MessageSquare strokeWidth={1.6} className="h-4 w-4 text-accent" /> Comments ({comments.length})
      </div>
      <div className="flex flex-col gap-3">
        {comments.map((c) => (
          <div key={c.id} className="rounded-md border border-border bg-surface-2/30 px-3 py-2">
            <p className="text-[13.5px] text-text">{c.message}</p>
            <p className="mt-1 text-[11.5px] text-muted">
              {c.author || "—"} · {fmtDate(c.created_at)}
            </p>
          </div>
        ))}
        {comments.length === 0 && <p className="text-[13px] text-muted">No comments yet.</p>}
      </div>
      <div className="mt-3 flex gap-2">
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a comment…" className="h-[44px]" />
        <Button variant="ghost" size="toolbar" onClick={add} disabled={pending || !text.trim()}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Post"}
        </Button>
      </div>
    </div>
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
