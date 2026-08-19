"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Plus, Pencil, Trash2, Loader2, Download, Link2, Unlink, AlertCircle } from "lucide-react";
import { Topbar } from "@/components/shell/topbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { invoiceStatusTone as statusTone } from "@/lib/badge-tones";
import { Input, Field, Select, Textarea } from "@/components/ui/input";
import { Drawer } from "@/components/ui/drawer";
import { FilterSelect } from "@/components/ui/filter-select";
import { gbp, fmtDate } from "@/lib/utils";
import type { Option } from "@/lib/data/options";
import type { TransactionRow, LedgerTotals } from "@/lib/data/transactions";
import type { LeaseOption } from "@/lib/data/leases";
import { buildNarrative } from "@/lib/finance/narrative";
import { computeVatFromGross } from "@/lib/finance/vat";
import { createTransaction, updateTransaction, deleteTransaction } from "./actions";
import { ReconcileDrawer } from "./reconcile-drawer";
import { unreconcileTransaction } from "./reconcile-actions";

type Perms = { create: boolean; edit: boolean; remove: boolean };
type Opt = { value: string; label: string };
type Form = Record<string, string>;

function toForm(t?: TransactionRow | null): Form {
  return {
    type: t?.type ?? "Income",
    category: t?.category ?? "",
    amount_gross: t?.amount_gross != null ? String(t.amount_gross) : "",
    vat_rate: t?.vat_rate != null ? String(t.vat_rate) : "0",
    vat_only: t && Number(t.amount_net) === 0 && Number(t.vat_amount) > 0 ? "true" : "false",
    txn_date: t?.txn_date ?? new Date().toISOString().slice(0, 10),
    property_id: t?.property_id ?? "",
    lease_id: t?.lease_id ?? "",
    nominal_code_id: t?.nominal_code_id ?? "",
    bank_account_id: t?.bank_account_id ?? "",
    status: t?.status ?? "",
    reference: t?.reference ?? "",
    receipt_link: t?.receipt_link ?? "",
    notes: t?.notes ?? "",
  };
}

export function NominalClient({
  transactions,
  totals,
  properties,
  leases,
  options,
  nominals,
  banks,
  narratives,
  optedPropertyIds,
  perms,
}: {
  transactions: TransactionRow[];
  totals: LedgerTotals;
  properties: Opt[];
  leases: LeaseOption[];
  options: Record<string, Option[]>;
  nominals: Opt[];
  banks: { value: string; label: string; short_ref: string | null }[];
  narratives: string[];
  optedPropertyIds: string[];
  perms: Perms;
}) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [typeFilter, setTypeFilter] = useState("");
  const [statusF, setStatusF] = useState("");
  const [propertyF, setPropertyF] = useState("");
  const [reviewOnly, setReviewOnly] = useState(false);
  const [reconcileId, setReconcileId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TransactionRow | null>(null);
  const [form, setForm] = useState<Form>(toForm());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  // Narrative for a tenancy: "<Surname> <Initial> <Rent|Arrears>" (WS6). Only
  // pre-fill when the notes field hasn't been typed into, so we never clobber it.
  function narrativeFor(leaseId: string): string | null {
    const l = leases.find((x) => x.value === leaseId);
    return l ? buildNarrative(l.tenant_name, l.tenancy_status) : null;
  }
  const withNarrative = (f: Form, leaseId: string): Form => {
    const n = leaseId ? narrativeFor(leaseId) : null;
    return n && !f.notes.trim() ? { ...f, notes: n } : f;
  };

  function onLeaseChange(v: string) {
    setForm((f) => withNarrative({ ...f, lease_id: v }, v));
  }

  // Picking a property auto-selects its single active tenancy (still overridable),
  // and defaults standard-rate VAT when the property is opted to tax (WS13).
  function onPropertyChange(v: string) {
    setForm((f) => {
      const active = leases.filter((l) => l.property_id === v && l.active);
      const lease_id = active.length === 1 ? active[0].value : "";
      let next = withNarrative({ ...f, property_id: v, lease_id }, lease_id);
      if (optedPropertyIds.includes(v) && (next.vat_rate === "0" || next.vat_rate === "")) {
        next = { ...next, vat_rate: "20" };
      }
      return next;
    });
  }

  const optedSelected = !!form.property_id && optedPropertyIds.includes(form.property_id);
  const vatBreakdown = form.vat_only === "true"
    ? { net: 0, vat: Number(form.amount_gross) || 0, gross: Number(form.amount_gross) || 0 }
    : computeVatFromGross(Number(form.amount_gross) || 0, Number(form.vat_rate) || 0);

  const [narrSearch, setNarrSearch] = useState("");
  const narrHits = narrSearch.trim()
    ? narratives.filter((n) => n.toLowerCase().includes(narrSearch.trim().toLowerCase())).slice(0, 40)
    : [];

  // Picking a bank defaults the reference to its short-ref (WS1), still editable.
  function onBankChange(v: string) {
    const bank = banks.find((b) => b.value === v);
    setForm((f) => ({ ...f, bank_account_id: v, reference: v && bank?.short_ref ? bank.short_ref : f.reference }));
  }

  const rows = useMemo(
    () =>
      transactions.filter(
        (t) =>
          (!typeFilter || t.type === typeFilter) &&
          (!statusF || t.status === statusF) &&
          (!propertyF || t.property_id === propertyF) &&
          (!reviewOnly || t.needs_review),
      ),
    [transactions, typeFilter, statusF, propertyF, reviewOnly],
  );
  const needsReviewCount = useMemo(
    () => transactions.filter((t) => t.needs_review).length,
    [transactions],
  );

  function openCreate() {
    setEditing(null); setForm(toForm()); setError(null); setOpen(true);
  }
  function openEdit(t: TransactionRow) {
    setEditing(t); setForm(toForm(t)); setError(null); setOpen(true);
  }
  function save() {
    setError(null);
    startTransition(async () => {
      const res = editing ? await updateTransaction(editing.id, form) : await createTransaction(form);
      if (!res.ok) return setError(res.error);
      setOpen(false); router.refresh(); toast.success("Transaction saved.");
    });
  }
  async function remove(t: TransactionRow) {
    if (!(await confirm({ message: "Delete this transaction? This cannot be undone.", danger: true, confirmLabel: "Delete" }))) return;
    startTransition(async () => {
      const res = await deleteTransaction(t.id);
      if (!res.ok) return toast.error(res.error);
      router.refresh();
    });
  }
  async function unmatch(t: TransactionRow) {
    if (!(await confirm({ message: "Unmatch this transaction from its rent instalment? It returns to the review queue and the instalment is recalculated.", confirmLabel: "Unmatch" }))) return;
    startTransition(async () => {
      const res = await unreconcileTransaction(t.id);
      if (!res.ok) return toast.error(res.error);
      toast.success("Unmatched.");
      router.refresh();
    });
  }

  function exportCsv() {
    const head = ["Date", "Property", "Type", "Category", "Net", "VAT", "Gross", "Status", "Reference"];
    const lines = rows.map((t) =>
      [
        t.txn_date ?? "",
        (t.property?.address ?? "").replace(/,/g, " "),
        t.type ?? "",
        t.category ?? "",
        t.amount_net ?? 0,
        t.vat_amount ?? 0,
        t.amount_gross ?? 0,
        t.status ?? "",
        (t.reference ?? "").replace(/,/g, " "),
      ].join(","),
    );
    const csv = [head.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "nominal-ledger.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <Topbar
        search="Search transactions…"
        action={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="toolbar" className="gap-[6px]" onClick={exportCsv}>
              <Download strokeWidth={1.6} className="h-[16px] w-[16px]" /> Export CSV
            </Button>
            {perms.create && (
              <Button size="toolbar" className="gap-[6px]" onClick={openCreate}>
                <Plus strokeWidth={1.8} className="h-[16px] w-[16px]" /> Add transaction
              </Button>
            )}
          </div>
        }
      />
      <main className="flex flex-1 flex-col gap-[22px] overflow-y-auto thin-scroll px-[34px] py-[30px]">
        <div>
          <h1 className="text-[26px] font-semibold tracking-[-0.01em] text-text">Nominal ledger</h1>
          <p className="mt-[2px] text-[14px] text-muted">Every transaction across the portfolio.</p>
        </div>

        <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-3">
          <TotalCard label="Total credits" value={gbp(totals.credits)} tone="good" />
          <TotalCard label="Total debits" value={`-${gbp(totals.debits)}`} tone="bad" />
          <TotalCard label="Net balance" value={gbp(totals.net)} tone={totals.net >= 0 ? "good" : "bad"} />
        </div>

        {needsReviewCount > 0 && (
          <button
            onClick={() => setReviewOnly((v) => !v)}
            className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${reviewOnly ? "border-[var(--warn)] bg-[color-mix(in_oklch,var(--warn)_8%,transparent)]" : "border-border hover:bg-surface-2/50"}`}
          >
            <AlertCircle strokeWidth={1.7} className="h-[18px] w-[18px] text-[var(--warn)]" />
            <span className="flex-1 text-[13.5px] text-text">
              <span className="font-semibold">{needsReviewCount}</span> bank transaction{needsReviewCount === 1 ? "" : "s"} need reconciling.
            </span>
            <span className="text-[12.5px] font-semibold text-accent">{reviewOnly ? "Show all" : "Review"}</span>
          </button>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Select className="h-[44px] max-w-[200px]" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">All types</option>
            {(options.transaction_type ?? []).map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
          </Select>
          <FilterSelect value={statusF} onChange={setStatusF} placeholder="All statuses" options={options.invoice_status ?? []} />
          <FilterSelect value={propertyF} onChange={setPropertyF} placeholder="All properties" options={properties} />
        </div>

        <Card className="overflow-x-auto p-0">
          <div className="grid min-w-[1040px] grid-cols-[0.9fr_1.5fr_0.7fr_1fr_0.8fr_0.7fr_0.8fr_0.7fr_auto] items-center gap-3 border-b border-border px-6 py-4 text-[11.5px] font-semibold uppercase tracking-[0.05em] text-muted">
            <span>Date</span><span>Property</span><span>Type</span><span>Category</span><span className="text-right">Net</span><span className="text-right">VAT</span><span className="text-right">Gross</span><span>Status</span><span className="text-right">Action</span>
          </div>
          {rows.length === 0 && (
            <div className="grid place-items-center py-16 text-center">
              <p className="text-[15px] font-medium text-text-2">No transactions yet</p>
              <p className="mt-1 text-[15px] text-muted">{perms.create ? "Add a transaction or sync a bank account." : "No records available."}</p>
            </div>
          )}
          {rows.map((t) => (
            <div key={t.id} onClick={() => perms.edit && openEdit(t)} className="grid min-w-[1040px] cursor-pointer grid-cols-[0.9fr_1.5fr_0.7fr_1fr_0.8fr_0.7fr_0.8fr_0.7fr_auto] items-center gap-3 border-b border-border px-6 py-4 text-[13.5px] transition-colors last:border-b-0 hover:bg-surface-2/40">
              <span className="text-text-2">{t.txn_date ? fmtDate(t.txn_date) : "—"}</span>
              <span className="truncate text-text-2">{t.property?.address || t.plaid_institution || "—"}</span>
              <span className={t.type === "Income" ? "text-[var(--good)]" : "text-[var(--bad)]"}>{t.type || "—"}</span>
              <span className="truncate text-text-2">{t.category || "—"}</span>
              <span className="text-right text-text-2">{t.amount_net != null ? gbp(t.amount_net) : "—"}</span>
              <span className="text-right text-muted">{t.vat_amount != null ? gbp(t.vat_amount) : "—"}</span>
              <span className="text-right font-semibold text-text">{t.amount_gross != null ? gbp(t.amount_gross) : "—"}</span>
              <span>{t.needs_review ? <Badge tone="warn" dot>Review</Badge> : t.status ? <Badge tone={statusTone(t.status)}>{t.status}</Badge> : <span className="text-muted">—</span>}</span>
              <span className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                {perms.edit && t.needs_review && (
                  <button onClick={() => setReconcileId(t.id)} className="grid h-8 w-8 place-items-center rounded-md text-accent transition-colors hover:bg-surface-2/60" aria-label="Reconcile" title="Reconcile">
                    <Link2 strokeWidth={1.7} className="h-[16px] w-[16px]" />
                  </button>
                )}
                {perms.edit && t.reconciled_with && (
                  <button onClick={() => unmatch(t)} className="grid h-8 w-8 place-items-center rounded-md text-muted transition-colors hover:bg-surface-2/60 hover:text-[var(--bad)]" aria-label="Unmatch" title="Unmatch from rent instalment">
                    <Unlink strokeWidth={1.6} className="h-[16px] w-[16px]" />
                  </button>
                )}
                {perms.edit && (
                  <button onClick={() => openEdit(t)} className="grid h-8 w-8 place-items-center rounded-md text-text-2 transition-colors hover:bg-surface-2/60" aria-label="Edit">
                    <Pencil strokeWidth={1.6} className="h-[16px] w-[16px]" />
                  </button>
                )}
                {perms.remove && (
                  <button onClick={() => remove(t)} className="grid h-8 w-8 place-items-center rounded-md text-[var(--bad)] transition-colors hover:bg-[color-mix(in_oklch,var(--bad)_12%,transparent)]" aria-label="Delete">
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
        title={editing ? "Edit transaction" : "Add transaction"}
        subtitle="Record income or an expense"
        size="md"
        footer={
          <>
            {error && <span className="mr-auto text-[15px] font-medium text-[var(--bad)]">{error}</span>}
            <Button variant="ghost" size="toolbar" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="toolbar" onClick={save} disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? "Save changes" : "Create transaction"}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-5">
          <SelectField label="Type" value={form.type} onChange={(v) => set("type", v)} options={options.transaction_type} />
          <SelectField label="Category" value={form.category} onChange={(v) => set("category", v)} options={options.transaction_category} />
          <SelectFieldOpt label="Nominal code" value={form.nominal_code_id} onChange={(v) => set("nominal_code_id", v)} options={nominals} placeholder="Choose…" className="col-span-2" />
          <Field label={form.vat_only === "true" ? "VAT amount (£)" : "Amount (gross, £)"}><Input type="number" step="0.01" min={0} value={form.amount_gross} onChange={(e) => set("amount_gross", e.target.value)} /></Field>
          {form.vat_only === "true" ? (
            <div className="flex items-end pb-1 text-[13px] text-muted">VAT-only line — the amount is the VAT</div>
          ) : (
            <SelectField label="VAT rate (%)" value={form.vat_rate} onChange={(v) => set("vat_rate", v)} options={options.vat_rate} />
          )}
          <div className="col-span-2 -mt-1 flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-surface-2/40 px-4 py-2 text-[13px]">
            <span className="tabular-nums text-text-2">Net <span className="font-semibold text-text">{gbp(vatBreakdown.net)}</span> · VAT <span className="font-semibold text-text">{gbp(vatBreakdown.vat)}</span> · Total <span className="font-semibold text-text">{gbp(vatBreakdown.gross)}</span></span>
            <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-muted">
              <input type="checkbox" checked={form.vat_only === "true"} onChange={(e) => set("vat_only", e.target.checked ? "true" : "false")} className="h-4 w-4 accent-[var(--gold)]" /> VAT only
            </label>
          </div>
          {optedSelected && <p className="col-span-2 -mt-2 text-[12.5px] text-accent">This property is opted to tax — VAT applies.</p>}
          <SelectFieldOpt label="Property" value={form.property_id} onChange={onPropertyChange} options={properties} placeholder="Choose…" />
          <SelectFieldOpt label="Tenancy" value={form.lease_id} onChange={onLeaseChange} options={leases} placeholder="None / not tenancy-specific" />
          <Field label="Date"><Input type="date" value={form.txn_date} onChange={(e) => set("txn_date", e.target.value)} /></Field>
          <SelectField label="Status" value={form.status} onChange={(v) => set("status", v)} options={options.invoice_status} />
          <SelectFieldOpt label="Bank account" value={form.bank_account_id} onChange={onBankChange} options={banks} placeholder="None" />
          <Field label="Reference" hint="Auto-fills from the bank"><Input value={form.reference} onChange={(e) => set("reference", e.target.value)} placeholder="e.g. LB" /></Field>
          <Field label="Receipt / proof link" className="col-span-2"><Input value={form.receipt_link} onChange={(e) => set("receipt_link", e.target.value)} placeholder="https://…" /></Field>
          <div className="col-span-2">
            <Field label="Details / narrative" hint="Pre-fills as “Surname Initial Rent/Arrears” from the tenancy; editable">
              <Textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
            </Field>
            {narratives.length > 0 && (
              <div className="mt-2">
                <Input placeholder="Reuse a previous note…" value={narrSearch} onChange={(e) => setNarrSearch(e.target.value)} className="h-[40px]" />
                {narrSearch.trim() && (
                  <ul className="mt-1 max-h-[150px] overflow-y-auto thin-scroll rounded-md border border-border">
                    {narrHits.length === 0 ? (
                      <li className="px-3 py-2 text-[13px] text-muted">No matches</li>
                    ) : narrHits.map((n) => (
                      <li key={n}>
                        <button type="button" onClick={() => { set("notes", n); setNarrSearch(""); }} className="block w-full truncate px-3 py-2 text-left text-[13.5px] text-text-2 hover:bg-surface-2/60">{n}</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
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

function TotalCard({ label, value, tone }: { label: string; value: string; tone: "good" | "bad" }) {
  return (
    <Card>
      <p className="text-[15px] font-medium text-muted">{label}</p>
      <p className={`mt-2 font-display text-[28px] font-semibold ${tone === "good" ? "text-text" : "text-[var(--bad)]"}`}>{value}</p>
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
function SelectFieldOpt({ label, value, onChange, options, placeholder = "Choose…", className }: { label: string; value: string; onChange: (v: string) => void; options: Opt[]; placeholder?: string; className?: string; }) {
  return (
    <Field label={label} className={className}>
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{placeholder}</option>
        {options.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
      </Select>
    </Field>
  );
}
