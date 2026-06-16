"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Download, Play, Save, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Field, Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import type { SourceMeta } from "@/lib/data/report-sources";
import { saveTemplate, deleteTemplate } from "./report-actions";

type Opt = { value: string; label: string };
type Filters = { dateFrom?: string; dateTo?: string; property_id?: string; status?: string; search?: string };
type Template = { id: string; name: string; source: string; fields: string[]; filters: Filters };
type Preview = { header: string[]; rows: unknown[][]; total: number };

export function ReportBuilder({
  sources,
  properties,
  templates,
}: {
  sources: SourceMeta[];
  properties: Opt[];
  templates: Template[];
}) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [sourceKey, setSourceKey] = useState(sources[0]?.key ?? "");
  const source = sources.find((s) => s.key === sourceKey);
  const [fields, setFields] = useState<string[]>(sources[0]?.fields.map((f) => f.key) ?? []);
  const [filters, setFilters] = useState<Filters>({});
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, start] = useTransition();

  function pickSource(key: string) {
    setSourceKey(key);
    const s = sources.find((x) => x.key === key);
    setFields(s?.fields.map((f) => f.key) ?? []);
    setFilters({});
    setPreview(null);
  }
  function toggleField(k: string) {
    setFields((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]));
  }
  const setF = (k: keyof Filters, v: string) => setFilters((f) => ({ ...f, [k]: v || undefined }));

  async function run() {
    setBusy(true);
    try {
      const res = await fetch("/api/reports/build", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: sourceKey, fields, filters }),
      });
      if (!res.ok) { toast.error("Couldn't run the report."); return; }
      setPreview(await res.json());
    } finally { setBusy(false); }
  }
  async function exportCsv() {
    setBusy(true);
    try {
      const res = await fetch("/api/reports/build", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: sourceKey, fields, filters, format: "csv" }),
      });
      if (!res.ok) { toast.error("Export failed."); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `${sourceKey}.csv`; a.click();
      URL.revokeObjectURL(url);
    } finally { setBusy(false); }
  }
  async function save() {
    const name = window.prompt("Save this report as:");
    if (!name?.trim()) return;
    start(async () => {
      const res = await saveTemplate({ name: name.trim(), source: sourceKey, fields, filters });
      if (!res.ok) return toast.error(res.error);
      toast.success("Report saved."); router.refresh();
    });
  }
  function load(t: Template) {
    setSourceKey(t.source);
    setFields(t.fields?.length ? t.fields : sources.find((s) => s.key === t.source)?.fields.map((f) => f.key) ?? []);
    setFilters(t.filters ?? {});
    setPreview(null);
  }
  async function removeTemplate(t: Template) {
    if (!(await confirm({ message: `Delete saved report "${t.name}"?`, danger: true, confirmLabel: "Delete" }))) return;
    start(async () => {
      const res = await deleteTemplate(t.id);
      if (!res.ok) return toast.error(res.error);
      router.refresh();
    });
  }

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[16px] font-semibold text-text">Report builder</h3>
        {templates.length > 0 && (
          <Select className="h-[40px] max-w-[220px]" value="" onChange={(e) => { const t = templates.find((x) => x.id === e.target.value); if (t) load(t); }}>
            <option value="">Load saved report…</option>
            {templates.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
          </Select>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
        <div className="flex flex-col gap-4">
          <Field label="Data source">
            <Select value={sourceKey} onChange={(e) => pickSource(e.target.value)}>
              {sources.map((s) => (<option key={s.key} value={s.key}>{s.label}</option>))}
            </Select>
          </Field>

          <div>
            <p className="mb-2 text-[12.5px] font-semibold text-text">Columns</p>
            <div className="flex flex-col gap-1.5 rounded-md border border-border p-3">
              {source?.fields.map((f) => (
                <label key={f.key} className="flex cursor-pointer items-center gap-2 text-[15px] text-text-2">
                  <input type="checkbox" checked={fields.includes(f.key)} onChange={() => toggleField(f.key)} className="h-3.5 w-3.5 accent-[var(--gold)]" />
                  {f.label}
                </label>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <p className="text-[12.5px] font-semibold text-text">Filters</p>
            {source?.hasDate && (
              <div className="grid grid-cols-2 gap-2">
                <Field label="From"><Input type="date" value={filters.dateFrom ?? ""} onChange={(e) => setF("dateFrom", e.target.value)} /></Field>
                <Field label="To"><Input type="date" value={filters.dateTo ?? ""} onChange={(e) => setF("dateTo", e.target.value)} /></Field>
              </div>
            )}
            {source?.hasProperty && (
              <Field label="Property">
                <Select value={filters.property_id ?? ""} onChange={(e) => setF("property_id", e.target.value)}>
                  <option value="">All properties</option>
                  {properties.map((p) => (<option key={p.value} value={p.value}>{p.label}</option>))}
                </Select>
              </Field>
            )}
            <Field label={sourceKey === "transactions" ? "Type (Income/Expense)" : sourceKey === "occupancy" ? "Occupancy (Occupied/Vacant)" : "Status"}>
              <Input value={filters.status ?? ""} onChange={(e) => setF("status", e.target.value)} placeholder="Any" />
            </Field>
            <Field label="Search"><Input value={filters.search ?? ""} onChange={(e) => setF("search", e.target.value)} placeholder="Address / code…" /></Field>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="toolbar" className="gap-[6px]" onClick={run} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play strokeWidth={1.8} className="h-[15px] w-[15px]" />} Run</Button>
            <Button variant="ghost" size="toolbar" className="gap-[6px]" onClick={exportCsv} disabled={busy}><Download strokeWidth={1.6} className="h-[15px] w-[15px]" /> CSV</Button>
            <Button variant="ghost" size="toolbar" className="gap-[6px]" onClick={save} disabled={pending}>{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save strokeWidth={1.6} className="h-[15px] w-[15px]" />} Save</Button>
          </div>

          {templates.length > 0 && (
            <div className="border-t border-border pt-3">
              <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.05em] text-muted">Saved reports</p>
              <ul className="flex flex-col gap-1">
                {templates.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-2 text-[15px]">
                    <button onClick={() => load(t)} className="truncate text-left text-text-2 hover:text-accent">{t.name}</button>
                    <button onClick={() => removeTemplate(t)} aria-label="Delete" className="text-[var(--bad)] hover:opacity-80"><Trash2 strokeWidth={1.6} className="h-[14px] w-[14px]" /></button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Preview */}
        <div className="min-w-0 overflow-x-auto rounded-md border border-border">
          {!preview ? (
            <p className="px-4 py-10 text-center text-[15px] text-muted">Choose a source and columns, then <strong>Run</strong> to preview.</p>
          ) : preview.rows.length === 0 ? (
            <p className="px-4 py-10 text-center text-[15px] text-muted">No matching rows.</p>
          ) : (
            <table className="w-full text-[15px]">
              <thead>
                <tr className="border-b border-border bg-surface-2/40 text-left text-[11.5px] font-semibold uppercase tracking-[0.05em] text-muted">
                  {preview.header.map((h, i) => (<th key={i} className="whitespace-nowrap px-3 py-2">{h}</th>))}
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((r, i) => (
                  <tr key={i} className="border-b border-border last:border-b-0">
                    {r.map((c, j) => (<td key={j} className="whitespace-nowrap px-3 py-1.5 text-text-2">{c === null || c === "" ? "—" : String(c)}</td>))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {preview && <p className="px-3 py-2 text-[12px] text-muted">{preview.total} row{preview.total === 1 ? "" : "s"}{preview.total > preview.rows.length ? ` (showing first ${preview.rows.length})` : ""}. Use CSV for the full export.</p>}
        </div>
      </div>
    </Card>
  );
}
