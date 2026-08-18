"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Loader2 } from "lucide-react";
import { Topbar } from "@/components/shell/topbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Field, Select } from "@/components/ui/input";
import { Drawer } from "@/components/ui/drawer";
import { useToast } from "@/components/ui/toast";
import type { BankAccountRow } from "@/lib/data/bank-accounts";
import { createBankAccount, updateBankAccount } from "./actions";

type Form = { account_name: string; code: string; short_ref: string; entity_id: string; active: string };

const toForm = (b?: BankAccountRow | null): Form => ({
  account_name: b?.account_name ?? "",
  code: b?.code ?? "",
  short_ref: b?.short_ref ?? "",
  entity_id: b?.entity_id ?? "",
  active: b ? String(b.active) : "true",
});

export function BankAccountsClient({
  accounts,
  entities,
  canEdit,
}: {
  accounts: BankAccountRow[];
  entities: { value: string; label: string }[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BankAccountRow | null>(null);
  const [form, setForm] = useState<Form>(toForm());
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (k: keyof Form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  function openCreate() { setEditing(null); setForm(toForm()); setError(null); setOpen(true); }
  function openEdit(b: BankAccountRow) { setEditing(b); setForm(toForm(b)); setError(null); setOpen(true); }

  function save() {
    setError(null);
    start(async () => {
      const res = editing ? await updateBankAccount(editing.id, form) : await createBankAccount(form);
      if (!res.ok) return setError(res.error);
      setOpen(false); router.refresh(); toast.success("Bank account saved.");
    });
  }

  return (
    <>
      <Topbar
        search="Search…"
        action={canEdit ? (
          <Button size="toolbar" className="gap-[6px]" onClick={openCreate}>
            <Plus strokeWidth={1.8} className="h-[16px] w-[16px]" /> Add bank account
          </Button>
        ) : undefined}
      />
      <main className="flex flex-1 flex-col gap-[22px] overflow-y-auto thin-scroll px-[34px] py-[30px]">
        <div>
          <h1 className="text-[26px] font-semibold tracking-[-0.01em] text-text">Bank accounts</h1>
          <p className="mt-[2px] text-[14px] text-muted">Each account is its own ledger account, with a code, a reference and an owning company.</p>
        </div>

        <Card className="overflow-x-auto p-0">
          <div className="grid min-w-[820px] grid-cols-[0.8fr_1.6fr_0.7fr_1.4fr_0.7fr_auto] items-center gap-4 border-b border-border px-6 py-4 text-[11.5px] font-semibold uppercase tracking-[0.05em] text-muted">
            <span>Code</span><span>Account</span><span>Ref</span><span>Company</span><span>Status</span><span className="text-right">Action</span>
          </div>
          {accounts.length === 0 ? (
            <div className="grid place-items-center py-16 text-center">
              <p className="text-[15px] font-medium text-text-2">No bank accounts yet</p>
              <p className="mt-1 text-[15px] text-muted">{canEdit ? "Add your bank accounts so receipts default their reference and post to the right company." : "No records available."}</p>
            </div>
          ) : (
            accounts.map((b) => (
              <div key={b.id} onClick={() => canEdit && openEdit(b)} className={`grid min-w-[820px] grid-cols-[0.8fr_1.6fr_0.7fr_1.4fr_0.7fr_auto] items-center gap-4 border-b border-border px-6 py-4 text-[13.5px] last:border-b-0 ${canEdit ? "cursor-pointer transition-colors hover:bg-surface-2/40" : ""}`}>
                <span className="font-mono text-text-2">{b.code || "—"}</span>
                <span className="truncate font-medium text-text">{b.account_name || b.institution || "—"}</span>
                <span className="font-mono text-text-2">{b.short_ref || "—"}</span>
                <span className="truncate text-text-2">{b.entity || "—"}</span>
                <span>{b.active ? <Badge tone="good" dot>Active</Badge> : <Badge tone="muted" dot>Inactive</Badge>}</span>
                <span className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                  {canEdit && (
                    <button onClick={() => openEdit(b)} className="grid h-8 w-8 place-items-center rounded-md text-text-2 transition-colors hover:bg-surface-2/60" aria-label="Edit">
                      <Pencil strokeWidth={1.6} className="h-[16px] w-[16px]" />
                    </button>
                  )}
                </span>
              </div>
            ))
          )}
        </Card>
      </main>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Edit bank account" : "Add bank account"}
        subtitle="Its code, reference and owning company"
        size="md"
        footer={
          <>
            {error && <span className="mr-auto text-[15px] font-medium text-[var(--bad)]">{error}</span>}
            <Button variant="ghost" size="toolbar" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="toolbar" onClick={save} disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />} {editing ? "Save changes" : "Create"}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-5">
          <Field label="Account name" className="col-span-2"><Input value={form.account_name} onChange={(e) => set("account_name", e.target.value)} placeholder="e.g. Aspengold Limited — Lloyds" /></Field>
          <Field label="Code" hint="Ledger bank code, e.g. 37BA"><Input value={form.code} onChange={(e) => set("code", e.target.value)} /></Field>
          <Field label="Reference" hint="Auto-fills a receipt's reference, e.g. LB / BB"><Input value={form.short_ref} onChange={(e) => set("short_ref", e.target.value)} /></Field>
          <Field label="Company" className="col-span-2">
            <Select value={form.entity_id} onChange={(e) => set("entity_id", e.target.value)}>
              <option value="">Choose…</option>
              {entities.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
            </Select>
          </Field>
          <Field label="Status">
            <Select value={form.active} onChange={(e) => set("active", e.target.value)}>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </Select>
          </Field>
        </div>
      </Drawer>
    </>
  );
}
