"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Loader2 } from "lucide-react";
import { Topbar } from "@/components/shell/topbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Field, Select } from "@/components/ui/input";
import { Drawer } from "@/components/ui/drawer";
import { useToast } from "@/components/ui/toast";
import { gbp, fmtDate } from "@/lib/utils";
import type { BatchListRow } from "@/lib/data/receipt-batches";
import { createBatch } from "./actions";

export function ReceiptsClient({
  batches,
  banks,
  canEdit,
}: {
  batches: BatchListRow[];
  banks: { value: string; label: string }[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [bank, setBank] = useState("");
  const [expected, setExpected] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function create() {
    setError(null);
    start(async () => {
      const res = await createBatch({ bank_account_id: bank, expected_total: expected, note: null });
      if (!res.ok) return setError(res.error);
      setOpen(false); setBank(""); setExpected("");
      toast.success("Batch opened.");
      if (res.id) router.push(`/receipts/${res.id}`);
    });
  }

  return (
    <>
      <Topbar
        search="Search…"
        action={canEdit ? (
          <Button size="toolbar" className="gap-[6px]" onClick={() => setOpen(true)}>
            <Plus strokeWidth={1.8} className="h-[16px] w-[16px]" /> New batch
          </Button>
        ) : undefined}
      />
      <main className="flex flex-1 flex-col gap-[22px] overflow-y-auto thin-scroll px-[34px] py-[30px]">
        <div>
          <h1 className="text-[26px] font-semibold tracking-[-0.01em] text-text">Receipt batches</h1>
          <p className="mt-[2px] text-[14px] text-muted">Work one bank at a time: add receipts, watch the running total against the statement, then post.</p>
        </div>

        <Card className="overflow-x-auto p-0">
          <div className="grid min-w-[820px] grid-cols-[1.6fr_1.2fr_0.8fr_1fr_1fr_0.7fr] items-center gap-4 border-b border-border px-6 py-4 text-[11.5px] font-semibold uppercase tracking-[0.05em] text-muted">
            <span>Bank</span><span>Company</span><span className="text-center">Receipts</span><span className="text-right">Running total</span><span className="text-right">Left to apply</span><span>Status</span>
          </div>
          {batches.length === 0 ? (
            <div className="grid place-items-center py-16 text-center">
              <p className="text-[15px] font-medium text-text-2">No batches yet</p>
              <p className="mt-1 text-[15px] text-muted">{canEdit ? "Open a batch for a bank account to start booking receipts." : "No records available."}</p>
            </div>
          ) : (
            batches.map((b) => (
              <Link key={b.id} href={`/receipts/${b.id}`} className="grid min-w-[820px] cursor-pointer grid-cols-[1.6fr_1.2fr_0.8fr_1fr_1fr_0.7fr] items-center gap-4 border-b border-border px-6 py-4 text-[13.5px] transition-colors last:border-b-0 hover:bg-surface-2/40">
                <span className="truncate font-medium text-text">{b.bank || "—"} <span className="text-[12px] text-muted">· {fmtDate(b.created_at)}</span></span>
                <span className="truncate text-text-2">{b.entity || "—"}</span>
                <span className="text-center text-text-2">{b.count}</span>
                <span className="text-right tabular-nums font-semibold text-text">{gbp(b.total)}</span>
                <span className="text-right tabular-nums text-text-2">{b.left_to_apply != null ? gbp(b.left_to_apply) : "—"}</span>
                <span>{b.status === "posted" ? <Badge tone="good" dot>Posted</Badge> : <Badge tone="warn" dot>Draft</Badge>}</span>
              </Link>
            ))
          )}
        </Card>
      </main>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="New receipt batch"
        subtitle="Pick the bank you're working, and the statement total if you have it"
        size="md"
        footer={
          <>
            {error && <span className="mr-auto text-[15px] font-medium text-[var(--bad)]">{error}</span>}
            <Button variant="ghost" size="toolbar" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="toolbar" onClick={create} disabled={pending || !bank}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />} Open batch
            </Button>
          </>
        }
      >
        <div className="grid gap-5">
          <Field label="Bank account">
            <Select value={bank} onChange={(e) => setBank(e.target.value)}>
              <option value="">Choose…</option>
              {banks.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
            </Select>
          </Field>
          <Field label="Expected total (optional)" hint="The statement total for this session, to see left-to-apply">
            <Input type="number" step="0.01" min={0} value={expected} onChange={(e) => setExpected(e.target.value)} placeholder="e.g. 7114.16" />
          </Field>
          {banks.length === 0 && <p className="text-[13px] text-muted">Add a bank account first (Bank accounts page).</p>}
        </div>
      </Drawer>
    </>
  );
}
