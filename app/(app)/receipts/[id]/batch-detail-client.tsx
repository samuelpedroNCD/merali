"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Link2, Trash2, Check, Loader2, Pencil } from "lucide-react";
import { Topbar } from "@/components/shell/topbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Field, Select } from "@/components/ui/input";
import { Drawer } from "@/components/ui/drawer";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { gbp, fmtDate } from "@/lib/utils";
import type { BatchDetail, BatchTxn } from "@/lib/data/receipt-batches";
import { createTransaction } from "../../nominal/actions";
import { addToBatch, removeFromBatch, postBatch, setBatchExpected } from "../actions";

type Opt = { value: string; label: string };

export function BatchDetailClient({
  batch,
  unbatched,
  properties,
  nominals,
  shortRef,
  canEdit,
}: {
  batch: BatchDetail;
  unbatched: BatchTxn[];
  properties: Opt[];
  nominals: Opt[];
  shortRef: string | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [pending, start] = useTransition();
  const [addOpen, setAddOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [editExp, setEditExp] = useState(false);
  const [expected, setExpected] = useState(batch.expected_total != null ? String(batch.expected_total) : "");
  const [form, setForm] = useState({ amount_gross: "", txn_date: new Date().toISOString().slice(0, 10), reference: shortRef ?? "", property_id: "", nominal_code_id: "" });
  const [error, setError] = useState<string | null>(null);
  const draft = batch.status === "draft";
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  function refresh() { router.refresh(); }

  function addReceipt() {
    setError(null);
    start(async () => {
      const res = await createTransaction({
        type: "Income", amount_gross: form.amount_gross, vat_rate: 0, txn_date: form.txn_date,
        reference: form.reference, property_id: form.property_id || null, nominal_code_id: form.nominal_code_id || null,
        bank_account_id: batch.bank_account_id, batch_id: batch.id,
      });
      if (!res.ok) return setError(res.error);
      setAddOpen(false);
      setForm({ amount_gross: "", txn_date: form.txn_date, reference: shortRef ?? "", property_id: "", nominal_code_id: "" });
      toast.success("Receipt added.");
      refresh();
    });
  }

  function assign(txnId: string) {
    start(async () => {
      const res = await addToBatch(batch.id, txnId);
      if (!res.ok) return toast.error(res.error);
      refresh();
    });
  }
  function remove(txnId: string) {
    start(async () => {
      const res = await removeFromBatch(batch.id, txnId);
      if (!res.ok) return toast.error(res.error);
      refresh();
    });
  }
  function saveExpected() {
    start(async () => {
      const res = await setBatchExpected(batch.id, expected === "" ? null : Number(expected));
      if (!res.ok) return toast.error(res.error);
      setEditExp(false); refresh();
    });
  }
  async function post() {
    const res = await postBatch(batch.id);
    if (!res.ok) {
      // Offer to post anyway on a variance.
      if (res.error.includes("left to apply") && (await confirm({ message: `${res.error} Post the batch anyway?`, confirmLabel: "Post anyway" }))) {
        const res2 = await postBatch(batch.id, true);
        if (!res2.ok) return toast.error(res2.error);
        toast.success("Batch posted."); return refresh();
      }
      return toast.error(res.error);
    }
    toast.success("Batch posted."); refresh();
  }

  return (
    <>
      <Topbar
        search="Search…"
        action={draft && canEdit ? (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="toolbar" className="gap-[6px]" onClick={() => setAssignOpen(true)}><Link2 strokeWidth={1.6} className="h-[16px] w-[16px]" /> Assign</Button>
            <Button variant="ghost" size="toolbar" className="gap-[6px]" onClick={() => setAddOpen(true)}><Plus strokeWidth={1.8} className="h-[16px] w-[16px]" /> Add receipt</Button>
            <Button size="toolbar" className="gap-[6px]" onClick={() => start(post)} disabled={pending}><Check strokeWidth={1.8} className="h-[16px] w-[16px]" /> Post batch</Button>
          </div>
        ) : undefined}
      />
      <main className="flex flex-1 flex-col gap-[22px] overflow-y-auto thin-scroll px-[34px] py-[30px]">
        <Link href="/receipts" className="inline-flex items-center gap-2 text-[15px] font-medium text-muted hover:text-accent">
          <ArrowLeft strokeWidth={1.6} className="h-4 w-4" /> Receipt batches
        </Link>

        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-[26px] font-semibold tracking-[-0.01em] text-text">{batch.bank || "Batch"}</h1>
            <p className="mt-[2px] text-[14px] text-muted">{batch.entity || "—"}</p>
          </div>
          <Badge tone={draft ? "warn" : "good"} dot>{draft ? "Draft" : "Posted"}</Badge>
        </div>

        <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-3">
          <Card><p className="text-[15px] text-muted">Running total</p><p className="mt-2 font-display text-[28px] font-semibold text-text">{gbp(batch.total)}</p><p className="mt-1 text-[12px] text-muted">{batch.count} receipt{batch.count === 1 ? "" : "s"}</p></Card>
          <Card>
            <p className="flex items-center gap-2 text-[15px] text-muted">Expected {draft && canEdit && !editExp && <button onClick={() => setEditExp(true)} className="text-muted hover:text-accent"><Pencil className="h-[13px] w-[13px]" /></button>}</p>
            {editExp ? (
              <div className="mt-2 flex items-center gap-2">
                <Input type="number" step="0.01" value={expected} onChange={(e) => setExpected(e.target.value)} className="h-[40px] max-w-[140px]" />
                <Button size="toolbar" onClick={saveExpected} disabled={pending}>Save</Button>
              </div>
            ) : (
              <p className="mt-2 font-display text-[28px] font-semibold text-text">{batch.expected_total != null ? gbp(batch.expected_total) : "—"}</p>
            )}
          </Card>
          <Card><p className="text-[15px] text-muted">Left to apply</p><p className={`mt-2 font-display text-[28px] font-semibold ${batch.left_to_apply == null ? "text-muted" : batch.left_to_apply === 0 ? "text-[var(--good)]" : "text-[var(--bad)]"}`}>{batch.left_to_apply != null ? gbp(batch.left_to_apply) : "—"}</p></Card>
        </div>

        <Card className="overflow-x-auto p-0">
          <div className="grid min-w-[760px] grid-cols-[1fr_2fr_1fr_1fr_auto] gap-4 border-b border-border px-6 py-4 text-[11.5px] font-semibold uppercase tracking-[0.05em] text-muted">
            <span>Date</span><span>Reference / property</span><span>Type</span><span className="text-right">Amount</span><span className="text-right">Action</span>
          </div>
          {batch.transactions.length === 0 ? (
            <p className="px-6 py-10 text-center text-[15px] text-muted">No receipts in this batch yet.{draft ? " Add one, or assign existing bank receipts." : ""}</p>
          ) : (
            batch.transactions.map((t) => (
              <div key={t.id} className="grid min-w-[760px] grid-cols-[1fr_2fr_1fr_1fr_auto] items-center gap-4 border-b border-border px-6 py-3 text-[13.5px] last:border-b-0">
                <span className="text-text-2">{t.txn_date ? fmtDate(t.txn_date) : "—"}</span>
                <span className="truncate text-text-2">{[t.reference, t.property].filter(Boolean).join(" · ") || "—"}</span>
                <span className={t.type === "Income" ? "text-[var(--good)]" : "text-[var(--bad)]"}>{t.type || "—"}</span>
                <span className="text-right tabular-nums font-semibold text-text">{t.amount_gross != null ? gbp(t.amount_gross) : "—"}</span>
                <span className="flex justify-end">
                  {draft && canEdit && (
                    <button onClick={() => remove(t.id)} disabled={pending} className="grid h-8 w-8 place-items-center rounded-md text-[var(--bad)] transition-colors hover:bg-[color-mix(in_oklch,var(--bad)_12%,transparent)]" aria-label="Remove from batch">
                      <Trash2 strokeWidth={1.6} className="h-[15px] w-[15px]" />
                    </button>
                  )}
                </span>
              </div>
            ))
          )}
        </Card>
      </main>

      {/* Add a new receipt straight into the batch */}
      <Drawer open={addOpen} onClose={() => setAddOpen(false)} title="Add receipt" subtitle={`Booked to ${batch.bank ?? "this batch"}`} size="md"
        footer={<>
          {error && <span className="mr-auto text-[15px] font-medium text-[var(--bad)]">{error}</span>}
          <Button variant="ghost" size="toolbar" onClick={() => setAddOpen(false)}>Cancel</Button>
          <Button size="toolbar" onClick={addReceipt} disabled={pending || !form.amount_gross}>{pending && <Loader2 className="h-4 w-4 animate-spin" />} Add</Button>
        </>}>
        <div className="grid grid-cols-2 gap-5">
          <Field label="Amount (gross, £)"><Input type="number" step="0.01" min={0} value={form.amount_gross} onChange={(e) => set("amount_gross", e.target.value)} /></Field>
          <Field label="Date"><Input type="date" value={form.txn_date} onChange={(e) => set("txn_date", e.target.value)} /></Field>
          <Field label="Reference" hint="Defaults to the bank's reference"><Input value={form.reference} onChange={(e) => set("reference", e.target.value)} /></Field>
          <Field label="Property (optional)"><Select value={form.property_id} onChange={(e) => set("property_id", e.target.value)}><option value="">None</option>{properties.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select></Field>
          <Field label="Nominal (optional)" className="col-span-2"><Select value={form.nominal_code_id} onChange={(e) => set("nominal_code_id", e.target.value)}><option value="">Uncategorised</option>{nominals.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select></Field>
        </div>
      </Drawer>

      {/* Assign existing unbatched receipts on this bank */}
      <Drawer open={assignOpen} onClose={() => setAssignOpen(false)} title="Assign existing receipts" subtitle="Unbatched transactions on this bank" size="md"
        footer={<Button variant="ghost" size="toolbar" onClick={() => setAssignOpen(false)}>Done</Button>}>
        {unbatched.length === 0 ? (
          <p className="text-[15px] text-muted">No unbatched receipts on this bank. Imported/reconciled bank transactions on this account will appear here.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {unbatched.map((t) => (
              <li key={t.id} className="flex items-center gap-3 rounded-md border border-border px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium text-text">{t.reference || t.property || "Receipt"}</p>
                  <p className="text-[12.5px] text-muted">{t.txn_date ? fmtDate(t.txn_date) : "—"} · {t.amount_gross != null ? gbp(t.amount_gross) : "—"}</p>
                </div>
                <Button size="toolbar" variant="ghost" onClick={() => assign(t.id)} disabled={pending}>Add</Button>
              </li>
            ))}
          </ul>
        )}
      </Drawer>
    </>
  );
}
