"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2, Check, X, Sparkles } from "lucide-react";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { gbp, fmtDate } from "@/lib/utils";
import {
  fetchSuggestions, reconcileTransaction, dismissReview, type SuggestionsResult,
} from "./reconcile-actions";

export function ReconcileDrawer({
  txnId,
  open,
  onClose,
  onChanged,
}: {
  txnId: string | null;
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [data, setData] = useState<SuggestionsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!open || !txnId) return;
    setLoading(true);
    setSelected(null);
    fetchSuggestions(txnId).then((d) => {
      setData(d);
      setSelected(d?.suggestions[0]?.id ?? null);
      setLoading(false);
    });
  }, [open, txnId]);

  function confirm() {
    if (!txnId || !selected) return;
    start(async () => {
      const res = await reconcileTransaction(txnId, selected);
      if (!res.ok) return toast.error(res.error);
      toast.success("Reconciled.");
      onChanged();
      onClose();
    });
  }
  function dismiss() {
    if (!txnId) return;
    start(async () => {
      const res = await dismissReview(txnId);
      if (!res.ok) return toast.error(res.error);
      toast.success("Marked reviewed.");
      onChanged();
      onClose();
    });
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Reconcile transaction"
      subtitle="Match this bank payment to an expected rent instalment"
      size="md"
      footer={
        <>
          <Button variant="ghost" size="toolbar" onClick={dismiss} disabled={pending} className="gap-[6px]">
            <X strokeWidth={1.6} className="h-[16px] w-[16px]" /> Dismiss
          </Button>
          <Button size="toolbar" onClick={confirm} disabled={pending || !selected} className="gap-[6px]">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check strokeWidth={1.8} className="h-[16px] w-[16px]" />}
            Confirm match
          </Button>
        </>
      }
    >
      {loading || !data ? (
        <div className="grid place-items-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted" /></div>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="rounded-lg border border-border bg-surface-2/40 p-4">
            <p className="text-[12px] uppercase tracking-[0.12em] text-muted">Bank payment</p>
            <p className="mt-1 font-display text-[24px] font-semibold text-text">{gbp(data.txn.amount)}</p>
            <p className="text-[15px] text-muted">{data.txn.date ? fmtDate(data.txn.date) : "—"}{data.txn.reference ? ` · ${data.txn.reference}` : ""}</p>
          </div>

          <div>
            <p className="mb-2 flex items-center gap-2 text-[15px] font-semibold text-text">
              <Sparkles strokeWidth={1.6} className="h-4 w-4 text-accent" /> Suggested matches
            </p>
            {data.suggestions.length === 0 ? (
              <p className="rounded-md border border-dashed border-border p-4 text-[15px] text-muted">
                No matching rent instalments found. You can dismiss this as reviewed, or record it as a manual transaction.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {data.suggestions.map((s) => (
                  <li key={s.id}>
                    <button
                      onClick={() => setSelected(s.id)}
                      className={`flex w-full items-center gap-3 rounded-md border px-4 py-3 text-left transition-colors ${selected === s.id ? "border-accent bg-[color-mix(in_oklch,var(--c-accent)_8%,transparent)]" : "border-border hover:bg-surface-2/50"}`}
                    >
                      <span className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border ${selected === s.id ? "border-accent bg-accent" : "border-border"}`}>
                        {selected === s.id && <span className="h-[6px] w-[6px] rounded-full bg-surface" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-medium text-text">{s.tenant || s.property || "Rent instalment"}</p>
                        <p className="truncate text-[12.5px] text-muted">Due {fmtDate(s.due_date)} · {gbp(s.outstanding)} outstanding</p>
                      </div>
                      <Badge tone={s.score >= 80 ? "good" : "muted"}>{s.score}% match</Badge>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Drawer>
  );
}
