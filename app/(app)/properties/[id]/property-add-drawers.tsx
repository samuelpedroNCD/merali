"use client";

import { useState, useTransition } from "react";
import { Loader2, Trash2, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Field, Select, Textarea } from "@/components/ui/input";
import { Drawer } from "@/components/ui/drawer";
import { useToast } from "@/components/ui/toast";
import type { Option } from "@/lib/data/options";
import type { LeaseOption } from "@/lib/data/leases";
import { createMaintenance } from "../../maintenance/actions";
import { createTransaction } from "../../nominal/actions";
import { createKey } from "../../keys/actions";
import { createDocument } from "../../documents/actions";
import { createLease } from "../../tenancies/actions";

type Opt = { value: string; label: string };
type Form = Record<string, string>;

export type PropertyAddData = {
  tenants: Opt[];
  staff: Opt[];
  suppliers: Opt[];
  nominals: Opt[];
  leases: LeaseOption[];
  options: Record<string, Option[]>;
};

/**
 * Property-scoped "quick add" create drawers. Each opens in place on the
 * property page, pre-scoped to `propertyId` (the property selector is omitted —
 * the value is injected into the payload), and reuses the same server actions as
 * the standalone modules. On success it closes and calls onSaved (router.refresh).
 */
export function PropertyAddDrawer({
  tab,
  propertyId,
  open,
  onClose,
  onSaved,
  data,
}: {
  tab: string;
  propertyId: string;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  data: PropertyAddData;
}) {
  // Remount on each open (key flips with `open`) so every sub-drawer starts from
  // a clean form — no reset-in-effect needed.
  const k = String(open);
  switch (tab) {
    case "maintenance":
      return <MaintenanceAdd key={k} propertyId={propertyId} open={open} onClose={onClose} onSaved={onSaved} data={data} />;
    case "financial":
      return <TransactionAdd key={k} propertyId={propertyId} open={open} onClose={onClose} onSaved={onSaved} data={data} />;
    case "documents":
      return <DocumentAdd key={k} propertyId={propertyId} open={open} onClose={onClose} onSaved={onSaved} />;
    case "keys":
      return <KeyAdd key={k} propertyId={propertyId} open={open} onClose={onClose} onSaved={onSaved} data={data} />;
    case "tenants":
      return <LeaseAdd key={k} propertyId={propertyId} open={open} onClose={onClose} onSaved={onSaved} data={data} />;
    default:
      return null;
  }
}

type SubProps = {
  propertyId: string;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  data: PropertyAddData;
};

/** Shared submit helper. */
function useSave(onClose: () => void, onSaved: () => void, message: string) {
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    start(async () => {
      const res = await action();
      if (!res.ok) return setError(res.error ?? "Couldn't save. Please try again.");
      onClose();
      onSaved();
      toast.success(message);
    });
  }
  return { error, setError, pending, run };
}

// ---------------------------------------------------------------- Maintenance
function MaintenanceAdd({ propertyId, open, onClose, onSaved, data }: SubProps) {
  const { options, staff, suppliers } = data;
  const blank = (): Form => ({
    description: "", status: "Needs Booking", urgency: "", type: "",
    planned_date: "", completion_date: "", assigned_staff_id: "", supplier_id: "",
    cost: "", response_time: "", resolution_time: "", notes: "",
  });
  const [form, setForm] = useState<Form>(blank());
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const { error, pending, run } = useSave(onClose, onSaved, "Job saved.");

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Book new job"
      subtitle="Add a maintenance job for this property"
      size="lg"
      footer={<FooterButtons error={error} pending={pending} onClose={onClose} onSave={() => run(() => createMaintenance({ ...form, property_id: propertyId }))} label="Create job" />}
    >
      <div className="grid grid-cols-2 gap-5">
        <Field label="Description" className="col-span-2"><Textarea rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} /></Field>
        <SelectField label="Status" value={form.status} onChange={(v) => set("status", v)} options={options.maintenance_status} />
        <SelectField label="Urgency" value={form.urgency} onChange={(v) => set("urgency", v)} options={options.maintenance_urgency} />
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
    </Drawer>
  );
}

// ---------------------------------------------------------------- Transaction
function TransactionAdd({ propertyId, open, onClose, onSaved, data }: SubProps) {
  const { options, nominals, leases } = data;
  // Tenancies for this property; default to the single active one if unambiguous.
  const propertyLeases = leases.filter((l) => l.property_id === propertyId);
  const activeLeases = propertyLeases.filter((l) => l.active);
  const defaultLease = activeLeases.length === 1 ? activeLeases[0].value : "";
  const blank = (): Form => ({
    type: "Income", category: "", amount_gross: "", vat_rate: "0",
    txn_date: new Date().toISOString().slice(0, 10), nominal_code_id: "",
    lease_id: defaultLease,
    status: "", reference: "", receipt_link: "", notes: "",
  });
  const [form, setForm] = useState<Form>(blank());
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const { error, pending, run } = useSave(onClose, onSaved, "Transaction saved.");

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Add transaction"
      subtitle="Record income or an expense for this property"
      size="md"
      footer={<FooterButtons error={error} pending={pending} onClose={onClose} onSave={() => run(() => createTransaction({ ...form, property_id: propertyId }))} label="Create transaction" />}
    >
      <div className="grid grid-cols-2 gap-5">
        <SelectField label="Type" value={form.type} onChange={(v) => set("type", v)} options={options.transaction_type} />
        <SelectField label="Category" value={form.category} onChange={(v) => set("category", v)} options={options.transaction_category} />
        <SelectFieldOpt label="Nominal code" value={form.nominal_code_id} onChange={(v) => set("nominal_code_id", v)} options={nominals} className="col-span-2" />
        {propertyLeases.length > 0 && (
          <SelectFieldOpt label="Tenancy" value={form.lease_id} onChange={(v) => set("lease_id", v)} options={propertyLeases} className="col-span-2" />
        )}
        <Field label="Amount (gross, £)"><Input type="number" step="0.01" min={0} value={form.amount_gross} onChange={(e) => set("amount_gross", e.target.value)} /></Field>
        <SelectField label="VAT rate (%)" value={form.vat_rate} onChange={(v) => set("vat_rate", v)} options={options.vat_rate} />
        <Field label="Date"><Input type="date" value={form.txn_date} onChange={(e) => set("txn_date", e.target.value)} /></Field>
        <SelectField label="Status" value={form.status} onChange={(v) => set("status", v)} options={options.invoice_status} />
        <Field label="Reference"><Input value={form.reference} onChange={(e) => set("reference", e.target.value)} placeholder="e.g. #J083" /></Field>
        <Field label="Receipt / proof link" className="col-span-2"><Input value={form.receipt_link} onChange={(e) => set("receipt_link", e.target.value)} placeholder="https://…" /></Field>
        <Field label="Notes" className="col-span-2"><Textarea rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
      </div>
    </Drawer>
  );
}

// ------------------------------------------------------------------- Document
function DocumentAdd({ propertyId, open, onClose, onSaved }: Omit<SubProps, "data">) {
  const blank = (): Form => ({ name: "", external_link: "", expiry_date: "" });
  const [form, setForm] = useState<Form>(blank());
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const { error, pending, run } = useSave(onClose, onSaved, "Document saved.");

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Upload document"
      subtitle="Add an external document link for this property"
      size="md"
      footer={<FooterButtons error={error} pending={pending} onClose={onClose} onSave={() => run(() => createDocument({ ...form, linked_to: "Property", entity_id: propertyId }))} label="Save document" />}
    >
      <div className="grid grid-cols-1 gap-5">
        <Field label="Name"><Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Tenancy agreement" /></Field>
        <Field label="Link"><Input value={form.external_link} onChange={(e) => set("external_link", e.target.value)} placeholder="https://…" /></Field>
        <Field label="Expiration date"><Input type="date" value={form.expiry_date} onChange={(e) => set("expiry_date", e.target.value)} /></Field>
      </div>
    </Drawer>
  );
}

// ------------------------------------------------------------------------ Key
function KeyAdd({ propertyId, open, onClose, onSaved, data }: SubProps) {
  const { options } = data;
  const blank = (): Form => ({
    key_code: "", held_by_type: "", status: "", date_given: "",
    date_returned: "", reference_id: "", notes: "",
  });
  const [form, setForm] = useState<Form>(blank());
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const { error, pending, run } = useSave(onClose, onSaved, "Key saved.");

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Issue new key"
      subtitle="Add a key for this property"
      size="md"
      footer={<FooterButtons error={error} pending={pending} onClose={onClose} onSave={() => run(() => createKey({ ...form, property_id: propertyId }))} label="Create key" />}
    >
      <div className="grid grid-cols-2 gap-5">
        <Field label="Key code"><Input value={form.key_code} onChange={(e) => set("key_code", e.target.value)} /></Field>
        <Field label="Reference ID"><Input value={form.reference_id} onChange={(e) => set("reference_id", e.target.value)} /></Field>
        <SelectField label="Held by type" value={form.held_by_type} onChange={(v) => set("held_by_type", v)} options={options.held_by_type} />
        <SelectField label="Status" value={form.status} onChange={(v) => set("status", v)} options={options.key_status} />
        <Field label="Date given"><Input type="date" value={form.date_given} onChange={(e) => set("date_given", e.target.value)} /></Field>
        <Field label="Date returned"><Input type="date" value={form.date_returned} onChange={(e) => set("date_returned", e.target.value)} /></Field>
        <Field label="Notes" className="col-span-2"><Textarea rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
      </div>
    </Drawer>
  );
}

// ---------------------------------------------------------------------- Lease
type Review = { effective_date: string; new_amount: string };

function LeaseAdd({ propertyId, open, onClose, onSaved, data }: SubProps) {
  const { tenants, options, nominals } = data;
  const blank = (): Form => ({
    tenancy_code: "", start_date: "", end_date: "", move_in_date: "", renewal_date: "",
    rent_amount: "", payment_frequency: "", status: "", rent_nominal_id: "",
    deposit_amount: "", deposit_scheme: "", deposit_reference: "",
    deposit_protected_date: "", deposit_returned_date: "",
    exclude_from_reminders: "false", notes: "",
  });
  const [form, setForm] = useState<Form>(blank());
  const [tenantIds, setTenantIds] = useState<string[]>([]);
  const [lead, setLead] = useState<string>("");
  const [reviews, setReviews] = useState<Review[]>([]);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const { error, pending, run } = useSave(onClose, onSaved, "Lease saved.");

  function toggleTenant(id: string) {
    setTenantIds((cur) => {
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
      setLead((ld) => (next.includes(ld) ? ld : next[0] ?? ""));
      return next;
    });
  }

  function submit() {
    const cleanReviews = reviews
      .filter((r) => r.effective_date && r.new_amount !== "")
      .map((r) => ({ effective_date: r.effective_date, new_amount: Number(r.new_amount) }));
    return createLease({
      ...form,
      property_id: propertyId,
      tenant_ids: tenantIds,
      lead_tenant_id: lead,
      reviews: cleanReviews,
    });
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="New tenancy"
      subtitle="Lease terms — the rent schedule regenerates on save"
      size="lg"
      footer={<FooterButtons error={error} pending={pending} onClose={onClose} onSave={() => run(submit)} label="Create lease" />}
    >
      <div className="grid grid-cols-2 gap-5">
        <div className="col-span-2">
          <p className="mb-2 text-[12.5px] font-semibold text-text">Tenants <span className="font-normal text-muted">— one or more; the lead receives statements</span></p>
          <div className="max-h-[200px] overflow-y-auto thin-scroll rounded-md border border-border">
            {tenants.length === 0 && <p className="px-3 py-3 text-[15px] text-muted">No tenants yet — add tenants first.</p>}
            {tenants.map((t) => {
              const checked = tenantIds.includes(t.value);
              return (
                <div key={t.value} className="flex items-center gap-3 border-b border-border px-3 py-2 last:border-b-0">
                  <label className="flex flex-1 cursor-pointer items-center gap-2 text-[13.5px] text-text">
                    <input type="checkbox" checked={checked} onChange={() => toggleTenant(t.value)} className="h-4 w-4 accent-[var(--gold)]" />
                    {t.label}
                  </label>
                  {checked && (
                    <label className="flex cursor-pointer items-center gap-1 text-[12px] text-muted">
                      <input type="radio" name="lead-tenant-add" checked={lead === t.value} onChange={() => setLead(t.value)} className="accent-[var(--gold)]" /> Lead
                    </label>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <Field label="Lease start"><Input type="date" value={form.start_date} onChange={(e) => set("start_date", e.target.value)} /></Field>
        <Field label="Lease end"><Input type="date" value={form.end_date} onChange={(e) => set("end_date", e.target.value)} /></Field>
        <Field label="Agreed rent (£)"><Input type="number" step="0.01" min={0} value={form.rent_amount} onChange={(e) => set("rent_amount", e.target.value)} /></Field>
        <SelectField label="Payment frequency" value={form.payment_frequency} onChange={(v) => set("payment_frequency", v)} options={options.payment_frequency} />
        <SelectFieldOpt label="Rent nominal" value={form.rent_nominal_id} onChange={(v) => set("rent_nominal_id", v)} options={nominals} />
        <SelectField label="Tenancy code" value={form.tenancy_code} onChange={(v) => set("tenancy_code", v)} options={options.tenancy_code} />
        <Field label="Move-in date"><Input type="date" value={form.move_in_date} onChange={(e) => set("move_in_date", e.target.value)} /></Field>
        <Field label="Renewal date"><Input type="date" value={form.renewal_date} onChange={(e) => set("renewal_date", e.target.value)} /></Field>
        <SelectField label="Status" value={form.status} onChange={(v) => set("status", v)} options={options.lease_status} className="col-span-2" />

        <div className="col-span-2 rounded-md border border-border p-3">
          <p className="mb-2 text-[12.5px] font-semibold text-text">Rent reviews / increases <span className="font-normal text-muted">— amount applies from the effective date</span></p>
          {reviews.length === 0 && <p className="mb-2 text-[12.5px] text-muted">No reviews — rent stays at the agreed amount.</p>}
          {reviews.map((r, i) => (
            <div key={i} className="mb-2 grid grid-cols-[1fr_1fr_auto] items-center gap-2">
              <Input type="date" value={r.effective_date} onChange={(e) => setReviews((rs) => rs.map((x, idx) => idx === i ? { ...x, effective_date: e.target.value } : x))} />
              <Input type="number" step="0.01" min={0} placeholder="New rent (£)" value={r.new_amount} onChange={(e) => setReviews((rs) => rs.map((x, idx) => idx === i ? { ...x, new_amount: e.target.value } : x))} />
              <button type="button" onClick={() => setReviews((rs) => rs.filter((_, idx) => idx !== i))} aria-label="Remove" className="grid h-9 w-9 place-items-center rounded-md text-[var(--bad)] hover:bg-[color-mix(in_oklch,var(--bad)_12%,transparent)]"><Trash2 strokeWidth={1.6} className="h-[15px] w-[15px]" /></button>
            </div>
          ))}
          <button type="button" onClick={() => setReviews((rs) => [...rs, { effective_date: "", new_amount: "" }])} className="text-[12.5px] font-semibold text-accent hover:underline">+ Add review</button>
        </div>

        <div className="col-span-2 grid grid-cols-2 gap-5 rounded-md border border-border p-3">
          <p className="col-span-2 text-[12.5px] font-semibold text-text">Deposit</p>
          <Field label="Amount (£)"><Input type="number" step="0.01" min={0} value={form.deposit_amount} onChange={(e) => set("deposit_amount", e.target.value)} /></Field>
          <SelectField label="Scheme" value={form.deposit_scheme} onChange={(v) => set("deposit_scheme", v)} options={options.deposit_scheme} />
          <Field label="Reference"><Input value={form.deposit_reference} onChange={(e) => set("deposit_reference", e.target.value)} /></Field>
          <Field label="Protected date"><Input type="date" value={form.deposit_protected_date} onChange={(e) => set("deposit_protected_date", e.target.value)} /></Field>
          <Field label="Returned date"><Input type="date" value={form.deposit_returned_date} onChange={(e) => set("deposit_returned_date", e.target.value)} /></Field>
        </div>

        <label className="col-span-2 flex cursor-pointer items-center gap-3 rounded-md border border-border px-4 py-3">
          <input type="checkbox" checked={form.exclude_from_reminders === "true"} onChange={(e) => set("exclude_from_reminders", e.target.checked ? "true" : "false")} className="h-4 w-4 accent-[var(--gold)]" />
          <span className="text-[15px] text-text">Exclude this tenancy from overdue-rent reminders</span>
        </label>
        <Field label="Notes" className="col-span-2"><Textarea rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
        <div className="col-span-2 flex items-center gap-2 rounded-md border border-border bg-surface-2/40 px-4 py-3 text-[15px] text-text-2">
          <CalendarClock strokeWidth={1.6} className="h-4 w-4 text-accent" />
          On save, the rent schedule is generated from the start/end dates at the chosen frequency — paid instalments are preserved.
        </div>
      </div>
    </Drawer>
  );
}

// ------------------------------------------------------------------- shared UI
function FooterButtons({ error, pending, onClose, onSave, label }: { error: string | null; pending: boolean; onClose: () => void; onSave: () => void; label: string }) {
  return (
    <>
      {error && <span className="mr-auto text-[15px] font-medium text-[var(--bad)]">{error}</span>}
      <Button variant="ghost" size="toolbar" onClick={onClose}>Cancel</Button>
      <Button size="toolbar" onClick={onSave} disabled={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />} {label}
      </Button>
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

function SelectFieldOpt({ label, value, onChange, options, className }: { label: string; value: string; onChange: (v: string) => void; options: Opt[]; className?: string }) {
  return (
    <Field label={label} className={className}>
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Choose…</option>
        {options.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
      </Select>
    </Field>
  );
}
