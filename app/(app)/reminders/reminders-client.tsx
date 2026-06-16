"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Plus, Pencil, Trash2, Loader2, Clock, Repeat, Building2 } from "lucide-react";
import { Topbar } from "@/components/shell/topbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { reminderStatusTone as statusTone } from "@/lib/badge-tones";
import { Input, Field, Textarea, Select } from "@/components/ui/input";
import { Drawer } from "@/components/ui/drawer";
import { fmtDate, cn } from "@/lib/utils";
import type { ReminderRow } from "@/lib/data/reminders";
import { createReminder, updateReminder, deleteReminder } from "./actions";

type Perms = { create: boolean; edit: boolean; remove: boolean };
type Opt = { value: string; label: string };

const RECURRENCES = ["None", "Daily", "Weekly", "Monthly", "Yearly"];

export function RemindersClient({
  reminders,
  staff,
  properties,
  perms,
}: {
  reminders: ReminderRow[];
  staff: Opt[];
  properties: Opt[];
  perms: Perms;
}) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ReminderRow | null>(null);
  const [content, setContent] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [assignees, setAssignees] = useState<string[]>([]);
  const [recurrence, setRecurrence] = useState("None");
  const [recurrenceUntil, setRecurrenceUntil] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function openCreate() {
    setEditing(null); setContent(""); setDate(""); setTime(""); setAssignees([]);
    setRecurrence("None"); setRecurrenceUntil(""); setPropertyId(""); setError(null); setOpen(true);
  }
  function openEdit(r: ReminderRow) {
    setEditing(r); setContent(r.content ?? ""); setDate(r.alert_date ?? ""); setTime(r.alert_time?.slice(0, 5) ?? "");
    setAssignees(r.assignees.map((a) => a.id));
    setRecurrence(r.recurrence ?? "None"); setRecurrenceUntil(r.recurrence_until ?? ""); setPropertyId(r.property_id ?? "");
    setError(null); setOpen(true);
  }
  function save() {
    setError(null);
    const payload = {
      content, alert_date: date, alert_time: time, assignees,
      recurrence, recurrence_until: recurrence === "None" ? "" : recurrenceUntil,
      property_id: propertyId,
    };
    startTransition(async () => {
      const res = editing ? await updateReminder(editing.id, payload) : await createReminder(payload);
      if (!res.ok) return setError(res.error);
      setOpen(false); router.refresh(); toast.success("Reminder saved.");
    });
  }
  async function remove(r: ReminderRow) {
    if (!(await confirm({ message: "Delete this reminder? This cannot be undone.", danger: true, confirmLabel: "Delete" }))) return;
    startTransition(async () => {
      const res = await deleteReminder(r.id);
      if (!res.ok) return toast.error(res.error);
      router.refresh();
    });
  }
  function toggleAssignee(id: string) {
    setAssignees((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));
  }

  return (
    <>
      <Topbar
        search="Search reminders…"
        action={
          perms.create ? (
            <Button size="toolbar" className="gap-[6px]" onClick={openCreate}>
              <Plus strokeWidth={1.8} className="h-[16px] w-[16px]" /> New reminder
            </Button>
          ) : undefined
        }
      />
      <main className="flex flex-1 flex-col gap-[22px] overflow-y-auto thin-scroll px-[34px] py-[30px]">
        <div>
          <h1 className="text-[26px] font-semibold tracking-[-0.01em] text-text">Reminders</h1>
          <p className="mt-[2px] text-[14px] text-muted">Scheduled reminders for the team.</p>
        </div>
        {reminders.length === 0 ? (
          <Card>
            <div className="grid place-items-center py-16 text-center">
              <p className="text-[15px] font-medium text-text-2">No reminders yet</p>
              <p className="mt-1 text-[15px] text-muted">{perms.create ? "Create your first reminder." : "No records available."}</p>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-[14px] md:grid-cols-2">
            {reminders.map((r) => (
              <Card key={r.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 text-[12.5px] text-muted">
                    <Clock strokeWidth={1.6} className="h-4 w-4" />
                    {r.alert_date ? fmtDate(r.alert_date) : "—"}{r.alert_time ? ` · ${r.alert_time.slice(0, 5)}` : ""}
                  </div>
                  <Badge tone={statusTone(r.status)} dot>{r.status ?? "Pending"}</Badge>
                </div>
                <p className="mt-3 text-[14px] text-text">{r.content || "—"}</p>
                {(r.recurrence && r.recurrence !== "None") || r.property_name ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-muted">
                    {r.recurrence && r.recurrence !== "None" && (
                      <span className="inline-flex items-center gap-1"><Repeat strokeWidth={1.6} className="h-[13px] w-[13px]" />{r.recurrence}</span>
                    )}
                    {r.property_name && (
                      <span className="inline-flex items-center gap-1 truncate"><Building2 strokeWidth={1.6} className="h-[13px] w-[13px]" />{r.property_name}</span>
                    )}
                  </div>
                ) : null}
                {r.assignees.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {r.assignees.map((a) => (<Badge key={a.id} tone="muted">{a.name}</Badge>))}
                  </div>
                )}
                <div className="mt-4 flex justify-end gap-1">
                  {perms.edit && (
                    <button onClick={() => openEdit(r)} className="grid h-8 w-8 place-items-center rounded-md text-text-2 transition-colors hover:bg-surface-2/60" aria-label="Edit">
                      <Pencil strokeWidth={1.6} className="h-[16px] w-[16px]" />
                    </button>
                  )}
                  {perms.remove && (
                    <button onClick={() => remove(r)} className="grid h-8 w-8 place-items-center rounded-md text-[var(--bad)] transition-colors hover:bg-[color-mix(in_oklch,var(--bad)_12%,transparent)]" aria-label="Delete">
                      <Trash2 strokeWidth={1.6} className="h-[16px] w-[16px]" />
                    </button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Edit reminder" : "New reminder"}
        subtitle="Schedule a reminder for the team"
        size="md"
        footer={
          <>
            {error && <span className="mr-auto text-[15px] font-medium text-[var(--bad)]">{error}</span>}
            <Button variant="ghost" size="toolbar" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="toolbar" onClick={save} disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? "Save changes" : "Create reminder"}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-5">
          <Field label="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Time"><Input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></Field>
          <Field label="Reminder" className="col-span-2"><Textarea rows={3} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Write your reminder…" /></Field>
          <Field label="Repeats">
            <Select value={recurrence} onChange={(e) => setRecurrence(e.target.value)}>
              {RECURRENCES.map((r) => (<option key={r} value={r}>{r}</option>))}
            </Select>
          </Field>
          <Field label="Repeat until">
            <Input type="date" value={recurrenceUntil} onChange={(e) => setRecurrenceUntil(e.target.value)} disabled={recurrence === "None"} />
          </Field>
          <Field label="Linked property (optional)" className="col-span-2">
            <Select value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
              <option value="">No linked property</option>
              {properties.map((p) => (<option key={p.value} value={p.value}>{p.label}</option>))}
            </Select>
          </Field>
          <div className="col-span-2">
            <p className="mb-2 text-[12.5px] font-semibold text-text">Assign to (optional)</p>
            <div className="flex flex-wrap gap-2">
              {staff.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => toggleAssignee(s.value)}
                  className={cn(
                    "rounded-pill border px-[12px] py-[6px] text-[12.5px] font-medium transition-colors",
                    assignees.includes(s.value)
                      ? "border-transparent bg-gold-gradient text-on-gold"
                      : "border-border text-text-2 hover:bg-surface-2/60",
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Drawer>
    </>
  );
}
