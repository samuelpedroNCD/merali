"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImageIcon, ClipboardCheck, Plus, Trash2, Loader2, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Field, Textarea, Select } from "@/components/ui/input";
import { Drawer } from "@/components/ui/drawer";
import { FileUpload } from "@/components/ui/file-upload";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { fmtDate } from "@/lib/utils";
import type { PropertyRelated } from "@/lib/data/property-related";
import { addPhoto, deletePhoto, addInspection, deleteInspection } from "./media-actions";

type Photos = PropertyRelated["photos"];
type Inspections = PropertyRelated["inspections"];

export function PropertyMedia({
  propertyId,
  photos,
  inspections,
  canEdit,
}: {
  propertyId: string;
  photos: Photos;
  inspections: Inspections;
  canEdit: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [pending, start] = useTransition();

  // Inspection drawer state
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"Move-in" | "Move-out" | "Routine">("Move-in");
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");
  const [insPhotos, setInsPhotos] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  function onPhotoUploaded(url: string, path: string) {
    start(async () => {
      const res = await addPhoto(propertyId, { url, path });
      if (!res.ok) return toast.error(res.error);
      toast.success("Photo added.");
      router.refresh();
    });
  }
  async function removePhoto(id: string) {
    if (!(await confirm({ message: "Remove this photo?", danger: true, confirmLabel: "Remove" }))) return;
    start(async () => {
      const res = await deletePhoto(propertyId, id);
      if (!res.ok) return toast.error(res.error);
      router.refresh();
    });
  }

  function openInspection() {
    setType("Move-in"); setDate(""); setNotes(""); setInsPhotos([]); setError(null); setOpen(true);
  }
  function saveInspection() {
    setError(null);
    start(async () => {
      const res = await addInspection(propertyId, { type, inspection_date: date, notes, photos: insPhotos });
      if (!res.ok) return setError(res.error);
      setOpen(false); toast.success("Inspection logged."); router.refresh();
    });
  }
  async function removeInspection(id: string) {
    if (!(await confirm({ message: "Delete this inspection? This cannot be undone.", danger: true, confirmLabel: "Delete" }))) return;
    start(async () => {
      const res = await deleteInspection(propertyId, id);
      if (!res.ok) return toast.error(res.error);
      router.refresh();
    });
  }

  const typeTone = (t: string) => (t === "Move-in" ? "good" : t === "Move-out" ? "warn" : "muted");

  return (
    <>
      {/* Photo gallery */}
      <Card>
        <div className="mb-[18px] flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-[16px] font-semibold text-text">
            <ImageIcon strokeWidth={1.6} className="h-[18px] w-[18px] text-accent" /> Photos ({photos.length})
          </h3>
          {canEdit && <FileUpload bucket="property-photos" label="Add photo" onUploaded={onPhotoUploaded} />}
        </div>
        {photos.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-muted">No photos yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {photos.map((ph) => (
              <div key={ph.id} className="group relative aspect-[4/3] overflow-hidden rounded-lg border border-border bg-surface-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={ph.url} alt={ph.caption ?? "Property photo"} className="h-full w-full object-cover" />
                {canEdit && (
                  <button
                    onClick={() => removePhoto(ph.id)}
                    aria-label="Remove photo"
                    className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-md bg-[rgba(46,36,12,0.55)] text-white opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <Trash2 strokeWidth={1.7} className="h-[14px] w-[14px]" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Inspections */}
      <Card>
        <div className="mb-[18px] flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-[16px] font-semibold text-text">
            <ClipboardCheck strokeWidth={1.6} className="h-[18px] w-[18px] text-accent" /> Inspections ({inspections.length})
          </h3>
          {canEdit && (
            <Button size="toolbar" className="gap-[6px]" onClick={openInspection}>
              <Plus strokeWidth={1.8} className="h-[16px] w-[16px]" /> Log inspection
            </Button>
          )}
        </div>
        {inspections.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-muted">No inspections recorded.</p>
        ) : (
          <ul>
            {inspections.map((i) => (
              <li key={i.id} className="flex items-start gap-3 border-t border-border py-[13px] first:border-t-0">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge tone={typeTone(i.type)} dot>{i.type}</Badge>
                    <span className="text-[12.5px] text-muted">{i.date ? fmtDate(i.date) : "—"}{i.inspector ? ` · ${i.inspector}` : ""}</span>
                  </div>
                  {i.notes && <p className="mt-1.5 text-[13.5px] text-text-2">{i.notes}</p>}
                  {i.photos.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {i.photos.map((u, n) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={n} src={u} alt="" className="h-14 w-14 rounded-md border border-border object-cover" />
                      ))}
                    </div>
                  )}
                </div>
                {canEdit && (
                  <button onClick={() => removeInspection(i.id)} aria-label="Delete inspection" className="grid h-8 w-8 place-items-center rounded-md text-[var(--bad)] transition-colors hover:bg-[color-mix(in_oklch,var(--bad)_12%,transparent)]">
                    <Trash2 strokeWidth={1.6} className="h-[16px] w-[16px]" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="Log inspection"
        subtitle="Record a move-in, move-out or routine inspection"
        size="md"
        footer={
          <>
            {error && <span className="mr-auto text-[13px] font-medium text-[var(--bad)]">{error}</span>}
            <Button variant="ghost" size="toolbar" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="toolbar" onClick={saveInspection} disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />} Save inspection
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-5">
          <Field label="Type">
            <Select value={type} onChange={(e) => setType(e.target.value as typeof type)}>
              <option>Move-in</option>
              <option>Move-out</option>
              <option>Routine</option>
            </Select>
          </Field>
          <Field label="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Notes" className="col-span-2"><Textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Condition, meter readings, issues found…" /></Field>
          <div className="col-span-2">
            <p className="mb-2 text-[12.5px] font-semibold text-text">Photos</p>
            {insPhotos.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {insPhotos.map((u, n) => (
                  <span key={n} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={u} alt="" className="h-16 w-16 rounded-md border border-border object-cover" />
                    <button onClick={() => setInsPhotos((p) => p.filter((_, idx) => idx !== n))} aria-label="Remove" className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-[var(--bad)] text-white">
                      <X strokeWidth={2} className="h-[12px] w-[12px]" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <FileUpload bucket="property-photos" label="Add photo" onUploaded={(url) => setInsPhotos((p) => [...p, url])} />
          </div>
        </div>
      </Drawer>
    </>
  );
}
