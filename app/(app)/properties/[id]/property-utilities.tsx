"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Gauge, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Field, Select, Textarea } from "@/components/ui/input";
import { Drawer } from "@/components/ui/drawer";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import type { PropertyRelated } from "@/lib/data/property-related";
import { saveUtility, deleteUtility } from "./utility-actions";

type Util = PropertyRelated["utilities"][number];
const blank = { utility_type: "", supplier: "", meter_location: "", stop_tap_location: "", serial_number: "", notes: "" };

export function PropertyUtilities({
  propertyId,
  utilities,
  utilityTypes,
  canEdit,
}: {
  propertyId: string;
  utilities: Util[];
  utilityTypes: string[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>(blank);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  function openCreate() {
    setEditId(null); setForm(blank); setError(null); setOpen(true);
  }
  function openEdit(u: Util) {
    setEditId(u.id);
    setForm({
      utility_type: u.utility_type ?? "", supplier: u.supplier ?? "", meter_location: u.meter_location ?? "",
      stop_tap_location: u.stop_tap_location ?? "", serial_number: u.serial_number ?? "", notes: u.notes ?? "",
    });
    setError(null); setOpen(true);
  }
  function save() {
    setError(null);
    start(async () => {
      const res = await saveUtility(propertyId, editId, form);
      if (!res.ok) return setError(res.error);
      setOpen(false); toast.success("Utility saved."); router.refresh();
    });
  }
  async function remove(u: Util) {
    if (!(await confirm({ message: `Delete the ${u.utility_type || "utility"} record? This cannot be undone.`, danger: true, confirmLabel: "Delete" }))) return;
    start(async () => {
      const res = await deleteUtility(propertyId, u.id);
      if (!res.ok) return toast.error(res.error);
      router.refresh();
    });
  }

  return (
    <>
      <Card>
        <div className="mb-[18px] flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-[16px] font-semibold text-text">
            <Gauge strokeWidth={1.6} className="h-[18px] w-[18px] text-accent" /> Utilities ({utilities.length})
          </h3>
          {canEdit && (
            <Button size="toolbar" className="gap-[6px]" onClick={openCreate}>
              <Plus strokeWidth={1.8} className="h-[16px] w-[16px]" /> Add utility
            </Button>
          )}
        </div>
        {utilities.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-muted">No utilities recorded.</p>
        ) : (
          <ul>
            {utilities.map((u) => (
              <li key={u.id} className="flex items-start gap-3 border-t border-border py-[13px] first:border-t-0">
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium text-text">{u.utility_type || "Utility"}{u.supplier ? <span className="font-normal text-muted"> · {u.supplier}</span> : null}</p>
                  <p className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[12.5px] text-muted">
                    {u.meter_location && <span>Meter: {u.meter_location}</span>}
                    {u.stop_tap_location && <span>Stop tap: {u.stop_tap_location}</span>}
                    {u.serial_number && <span>Serial: {u.serial_number}</span>}
                  </p>
                  {u.notes && <p className="mt-1 text-[12.5px] text-text-2">{u.notes}</p>}
                </div>
                {canEdit && (
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(u)} aria-label="Edit" className="grid h-8 w-8 place-items-center rounded-md text-text-2 transition-colors hover:bg-surface-2/60"><Pencil strokeWidth={1.6} className="h-[15px] w-[15px]" /></button>
                    <button onClick={() => remove(u)} aria-label="Delete" className="grid h-8 w-8 place-items-center rounded-md text-[var(--bad)] transition-colors hover:bg-[color-mix(in_oklch,var(--bad)_12%,transparent)]"><Trash2 strokeWidth={1.6} className="h-[15px] w-[15px]" /></button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title={editId ? "Edit utility" : "Add utility"}
        subtitle="Meter and stop-tap details for this property"
        size="md"
        footer={
          <>
            {error && <span className="mr-auto text-[13px] font-medium text-[var(--bad)]">{error}</span>}
            <Button variant="ghost" size="toolbar" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="toolbar" onClick={save} disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />} Save</Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-5">
          <Field label="Utility type">
            <Select value={form.utility_type} onChange={(e) => set("utility_type", e.target.value)}>
              <option value="">Choose…</option>
              {utilityTypes.map((t) => (<option key={t} value={t}>{t}</option>))}
            </Select>
          </Field>
          <Field label="Supplier"><Input value={form.supplier} onChange={(e) => set("supplier", e.target.value)} /></Field>
          <Field label="Meter location"><Input value={form.meter_location} onChange={(e) => set("meter_location", e.target.value)} /></Field>
          <Field label="Stop tap location"><Input value={form.stop_tap_location} onChange={(e) => set("stop_tap_location", e.target.value)} /></Field>
          <Field label="Serial number" className="col-span-2"><Input value={form.serial_number} onChange={(e) => set("serial_number", e.target.value)} /></Field>
          <Field label="Notes" className="col-span-2"><Textarea rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
        </div>
      </Drawer>
    </>
  );
}
