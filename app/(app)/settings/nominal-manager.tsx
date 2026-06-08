"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Pencil } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Field, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import type { NominalCode } from "@/lib/data/nominals";
import { saveNominal, setNominalActive } from "./nominal-actions";

export function NominalManager({ nominals }: { nominals: NominalCode[] }) {
  const router = useRouter();
  const toast = useToast();
  const [editId, setEditId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState("Expense");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function reset() { setEditId(null); setCode(""); setName(""); setType("Expense"); setError(null); }
  function edit(n: NominalCode) { setEditId(n.id); setCode(n.code); setName(n.name); setType(n.type); setError(null); }
  function save() {
    setError(null);
    start(async () => {
      const res = await saveNominal(editId, { code, name, type });
      if (!res.ok) return setError(res.error);
      reset(); toast.success("Nominal saved."); router.refresh();
    });
  }
  function toggle(n: NominalCode) {
    start(async () => {
      const res = await setNominalActive(n.id, !n.active);
      if (!res.ok) return toast.error(res.error);
      router.refresh();
    });
  }

  return (
    <Card className="max-w-[760px]">
      <h3 className="text-[16px] font-semibold text-text">Nominal codes</h3>
      <p className="mb-4 mt-1 text-[13px] text-muted">Your chart of accounts — assign these to transactions and to a tenancy&apos;s rent. Used to group finance for your accountant.</p>

      <div className="mb-5 grid grid-cols-[0.8fr_1.6fr_1fr_auto] items-end gap-3 rounded-md border border-border bg-surface-2/40 p-3">
        <Field label="Code"><Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="4000" /></Field>
        <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Rent received" /></Field>
        <Field label="Type">
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            <option>Income</option><option>Expense</option><option>Both</option>
          </Select>
        </Field>
        <div className="flex gap-2">
          <Button size="toolbar" onClick={save} disabled={pending} className="gap-[6px]">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus strokeWidth={1.8} className="h-[16px] w-[16px]" />}
            {editId ? "Save" : "Add"}
          </Button>
          {editId && <Button variant="ghost" size="toolbar" onClick={reset}>Cancel</Button>}
        </div>
      </div>
      {error && <p className="mb-3 text-[13px] font-medium text-[var(--bad)]">{error}</p>}

      <div className="overflow-hidden rounded-md border border-border">
        <div className="grid grid-cols-[0.7fr_1.8fr_0.8fr_0.8fr_auto] items-center gap-3 border-b border-border bg-surface-2/40 px-4 py-2 text-[11.5px] font-semibold uppercase tracking-[0.05em] text-muted">
          <span>Code</span><span>Name</span><span>Type</span><span>Active</span><span className="text-right">Edit</span>
        </div>
        {nominals.map((n) => (
          <div key={n.id} className="grid grid-cols-[0.7fr_1.8fr_0.8fr_0.8fr_auto] items-center gap-3 border-b border-border px-4 py-2.5 text-[13.5px] last:border-b-0">
            <span className="font-semibold text-text">{n.code}</span>
            <span className="truncate text-text-2">{n.name}</span>
            <span><Badge tone={n.type === "Income" ? "good" : n.type === "Both" ? "muted" : "warn"}>{n.type}</Badge></span>
            <button onClick={() => toggle(n)} className="text-left">
              <Badge tone={n.active ? "good" : "muted"} dot>{n.active ? "Active" : "Off"}</Badge>
            </button>
            <span className="flex justify-end">
              <button onClick={() => edit(n)} aria-label="Edit" className="grid h-8 w-8 place-items-center rounded-md text-text-2 hover:bg-surface-2/60"><Pencil strokeWidth={1.6} className="h-[15px] w-[15px]" /></button>
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
