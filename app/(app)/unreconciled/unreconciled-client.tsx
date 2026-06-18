"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Link2, Check, X } from "lucide-react";
import { Topbar } from "@/components/shell/topbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Field, Select } from "@/components/ui/input";
import { Drawer } from "@/components/ui/drawer";
import { useToast } from "@/components/ui/toast";
import { gbp, fmtDate } from "@/lib/utils";
import type { Option } from "@/lib/data/options";
import type { TransactionRow } from "@/lib/data/transactions";
import type { LeaseOption } from "@/lib/data/leases";
import { ReconcileDrawer } from "../nominal/reconcile-drawer";
import { dismissReview } from "../nominal/reconcile-actions";
import { approveTransaction } from "./actions";

type Opt = { value: string; label: string };
type Form = { type: string; category: string; nominal_code_id: string; property_id: string; lease_id: string };

export function UnreconciledClient({
  transactions,
  properties,
  leases,
  nominals,
  options,
  canEdit,
}: {
  transactions: TransactionRow[];
  properties: Opt[];
  leases: LeaseOption[];
  nominals: Opt[];
  options: Record<string, Option[]>;
  canEdit: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [reconcileId, setReconcileId] = useState<string | null>(null);
  const [approveId, setApproveId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>({ type: "", category: "", nominal_code_id: "", property_id: "", lease_id: "" });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (k: keyof Form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  function openApprove(t: TransactionRow) {
    setForm({
      type: t.type ?? "",
      category: t.category ?? "",
      nominal_code_id: t.nominal_code_id ?? "",
      property_id: t.property_id ?? "",
      lease_id: t.lease_id ?? "",
    });
    setError(null);
    setApproveId(t.id);
  }
  function onPropertyChange(v: string) {
    setForm((f) => {
      const active = leases.filter((l) => l.property_id === v && l.active);
      return { ...f, property_id: v, lease_id: active.length === 1 ? active[0].value : "" };
    });
  }
  function saveApprove() {
    setError(null);
    start(async () => {
      const res = await approveTransaction(approveId!, form);
      if (!res.ok) return setError(res.error);
      setApproveId(null);
      toast.success("Transaction approved.");
      router.refresh();
    });
  }
  function dismiss(id: string) {
    start(async () => {
      const res = await dismissReview(id);
      if (!res.ok) return toast.error(res.error);
      toast.success("Marked reviewed.");
      router.refresh();
    });
  }

  return (
    <>
      <Topbar search="Search…" />
      <main className="flex flex-1 flex-col gap-[22px] overflow-y-auto thin-scroll px-[34px] py-[30px]">
        <div>
          <h1 className="text-[26px] font-semibold tracking-[-0.01em] text-text">Unreconciled</h1>
          <p className="mt-[2px] text-[15px] text-muted">Imported bank transactions awaiting review — assign and approve, or match to a rent instalment.</p>
        </div>

        <Card className="overflow-x-auto p-0">
          <div className="grid min-w-[960px] grid-cols-[0.9fr_0.7fr_0.8fr_1.6fr_1.1fr_auto] items-center gap-3 border-b border-border px-6 py-4 text-[11.5px] font-semibold uppercase tracking-[0.05em] text-muted">
            <span>Date</span><span>Type</span><span className="text-right">Amount</span><span>Reference</span><span>Property</span><span className="text-right">Action</span>
          </div>
          {transactions.length === 0 && (
            <div className="grid place-items-center py-16 text-center">
              <p className="text-[15px] font-medium text-text-2">Nothing to review</p>
              <p className="mt-1 text-[15px] text-muted">All imported transactions have been reconciled.</p>
            </div>
          )}
          {transactions.map((t) => (
            <div key={t.id} className="grid min-w-[960px] grid-cols-[0.9fr_0.7fr_0.8fr_1.6fr_1.1fr_auto] items-center gap-3 border-b border-border px-6 py-4 text-[13.5px] last:border-b-0">
              <span className="text-text-2">{t.txn_date ? fmtDate(t.txn_date) : "—"}</span>
              <span className={t.type === "Income" ? "text-[var(--good)]" : "text-[var(--bad)]"}>{t.type || "—"}</span>
              <span className="text-right font-semibold text-text">{t.amount_gross != null ? gbp(t.amount_gross) : "—"}</span>
              <span className="truncate text-text-2" title={t.reference ?? ""}>{t.reference || t.plaid_institution || "—"}</span>
              <span className="truncate text-text-2">{t.property?.address ?? <span className="text-muted">Unassigned</span>}</span>
              <span className="flex justify-end gap-1">
                {canEdit && (
                  <>
                    {t.type === "Income" && (
                      <button onClick={() => setReconcileId(t.id)} className="grid h-8 w-8 place-items-center rounded-md text-accent transition-colors hover:bg-surface-2/60" aria-label="Match to rent" title="Match to a rent instalment">
                        <Link2 strokeWidth={1.7} className="h-[16px] w-[16px]" />
                      </button>
                    )}
                    <button onClick={() => openApprove(t)} className="grid h-8 w-8 place-items-center rounded-md text-[var(--good)] transition-colors hover:bg-surface-2/60" aria-label="Approve" title="Assign & approve">
                      <Check strokeWidth={1.8} className="h-[16px] w-[16px]" />
                    </button>
                    <button onClick={() => dismiss(t.id)} disabled={pending} className="grid h-8 w-8 place-items-center rounded-md text-muted transition-colors hover:bg-surface-2/60" aria-label="Dismiss" title="Mark reviewed without assigning">
                      <X strokeWidth={1.8} className="h-[16px] w-[16px]" />
                    </button>
                  </>
                )}
              </span>
            </div>
          ))}
        </Card>
      </main>

      <Drawer
        open={!!approveId}
        onClose={() => setApproveId(null)}
        title="Approve transaction"
        subtitle="Assign where this belongs, then approve"
        size="md"
        footer={
          <>
            {error && <span className="mr-auto text-[15px] font-medium text-[var(--bad)]">{error}</span>}
            <Button variant="ghost" size="toolbar" onClick={() => setApproveId(null)}>Cancel</Button>
            <Button size="toolbar" onClick={saveApprove} disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />} Approve
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-5">
          <SelectField label="Type" value={form.type} onChange={(v) => set("type", v)} options={options.transaction_type} />
          <SelectField label="Category" value={form.category} onChange={(v) => set("category", v)} options={options.transaction_category} />
          <SelectFieldOpt label="Nominal code" value={form.nominal_code_id} onChange={(v) => set("nominal_code_id", v)} options={nominals} className="col-span-2" />
          <SelectFieldOpt label="Property" value={form.property_id} onChange={onPropertyChange} options={properties} className="col-span-2" />
          <SelectFieldOpt label="Tenancy" value={form.lease_id} onChange={(v) => set("lease_id", v)} options={leases} placeholder="None / not tenancy-specific" className="col-span-2" />
        </div>
      </Drawer>

      <ReconcileDrawer
        txnId={reconcileId}
        open={!!reconcileId}
        onClose={() => setReconcileId(null)}
        onChanged={() => router.refresh()}
      />
    </>
  );
}

function SelectField({ label, value, onChange, options, className }: { label: string; value: string; onChange: (v: string) => void; options?: Option[]; className?: string }) {
  return (
    <Field label={label} className={className}>
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Choose…</option>
        {(options ?? []).map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
      </Select>
    </Field>
  );
}
function SelectFieldOpt({ label, value, onChange, options, placeholder = "Choose…", className }: { label: string; value: string; onChange: (v: string) => void; options: Opt[]; placeholder?: string; className?: string }) {
  return (
    <Field label={label} className={className}>
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{placeholder}</option>
        {options.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
      </Select>
    </Field>
  );
}
