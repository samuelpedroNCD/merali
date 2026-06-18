"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2, Check, X, Sparkles } from "lucide-react";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { gbp, fmtDate } from "@/lib/utils";
import {
  fetchSuggestions, reconcileTransaction, dismissReview,
  type SuggestionsResult, type Instalment,
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
  const [manual, setManual] = useState(false);
  const [search, setSearch] = useState("");
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!open || !txnId) return;
    setLoading(true);
    setSelected(null);
    setManual(false);
    setSearch("");
    fetchSuggestions(txnId).then((d) => {
      setData(d);
      setSelected(d?.suggestions[0]?.id ?? null);
      // Open straight into the manual picker when there are no suggestions.
      setManual((d?.suggestions.length ?? 0) === 0);
      setLoading(false);
    });
  }, [open, txnId]);

  const isExpense = !!data && data.txn.type !== "Income";

  // Instalments not already shown as suggestions, for the manual picker.
  const otherInstalments = (data?.allInstalments ?? []).filter(
    (i) => !data?.suggestions.some((s) => s.id === i.id),
  );
  const q = search.trim().toLowerCase();
  const pickerList = (data?.allInstalments ?? []).filter(
    (i) => !q || `${i.tenant ?? ""} ${i.property ?? ""} ${fmtDate(i.due_date)}`.toLowerCase().includes(q),
  );

  // Preview the effect of matching the selected instalment.
  const selectedInst: Instalment | undefined = (data?.allInstalments ?? []).find((i) => i.id === selected);
  const preview = selectedInst
    ? (() => {
        const left = +(selectedInst.outstanding - (data?.txn.amount ?? 0)).toFixed(2);
        return left > 0.01
          ? `Records ${gbp(data!.txn.amount)} of ${gbp(selectedInst.outstanding)} due → ${gbp(left)} still outstanding (Partial)`
          : `Records ${gbp(data!.txn.amount)} against ${gbp(selectedInst.outstanding)} due → settled (Paid)`;
      })()
    : null;

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
          <Button size="toolbar" onClick={confirm} disabled={pending || !selected || isExpense} className="gap-[6px]">
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

          {isExpense ? (
            <p className="rounded-md border border-dashed border-border p-4 text-[15px] text-muted">
              This is an <span className="font-medium text-text">expense</span> — reconciling to rent applies to income only.
              Use <span className="font-medium text-text">Approve</span> on the Unreconciled list to assign it to a property/nominal.
            </p>
          ) : (
          <div>
            <p className="mb-2 flex items-center gap-2 text-[15px] font-semibold text-text">
              <Sparkles strokeWidth={1.6} className="h-4 w-4 text-accent" /> Suggested matches
            </p>
            {data.suggestions.length === 0 ? (
              <p className="mb-3 rounded-md border border-dashed border-border p-4 text-[15px] text-muted">
                No suggested matches. Pick the right instalment below, or dismiss this as reviewed.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {data.suggestions.map((s) => (
                  <li key={s.id}>
                    <button
                      onClick={() => { setSelected(s.id); setManual(false); }}
                      className={`flex w-full items-center gap-3 rounded-md border px-4 py-3 text-left transition-colors ${!manual && selected === s.id ? "border-accent bg-[color-mix(in_oklch,var(--c-accent)_8%,transparent)]" : "border-border hover:bg-surface-2/50"}`}
                    >
                      <span className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border ${!manual && selected === s.id ? "border-accent bg-accent" : "border-border"}`}>
                        {!manual && selected === s.id && <span className="h-[6px] w-[6px] rounded-full bg-surface" />}
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

            {/* Manual picker — any unpaid instalment, for when no suggestion fits. */}
            {(manual || data.suggestions.length === 0) ? (
              data.allInstalments.length === 0 ? (
                <p className="mt-3 rounded-md border border-dashed border-border p-4 text-[15px] text-muted">
                  No unpaid rent instalments{data.suggestions.length === 0 ? "" : " to choose from"}. Dismiss this as reviewed, or assign it from the Unreconciled list with “Approve”.
                </p>
              ) : (
                <div className="mt-3 flex flex-col gap-2">
                  <p className="text-[12.5px] font-semibold uppercase tracking-[0.06em] text-muted">Choose an instalment</p>
                  <Input placeholder="Search tenant, property or date…" value={search} onChange={(e) => setSearch(e.target.value)} />
                  <ul className="flex max-h-[260px] flex-col gap-2 overflow-y-auto thin-scroll">
                    {pickerList.length === 0 && <li className="px-1 py-2 text-[13.5px] text-muted">No instalments match “{search}”.</li>}
                    {pickerList.map((i) => (
                      <li key={i.id}>
                        <button
                          onClick={() => { setSelected(i.id); setManual(true); }}
                          className={`flex w-full items-center gap-3 rounded-md border px-4 py-3 text-left transition-colors ${manual && selected === i.id ? "border-accent bg-[color-mix(in_oklch,var(--c-accent)_8%,transparent)]" : "border-border hover:bg-surface-2/50"}`}
                        >
                          <span className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border ${manual && selected === i.id ? "border-accent bg-accent" : "border-border"}`}>
                            {manual && selected === i.id && <span className="h-[6px] w-[6px] rounded-full bg-surface" />}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[14px] font-medium text-text">{i.tenant || i.property || "Rent instalment"}</p>
                            <p className="truncate text-[12.5px] text-muted">Due {fmtDate(i.due_date)} · {gbp(i.outstanding)} outstanding</p>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            ) : (
              otherInstalments.length > 0 && (
                <button
                  onClick={() => { setManual(true); setSelected(null); setSearch(""); }}
                  className="mt-3 text-[13px] font-semibold text-accent hover:underline"
                >
                  None of these? Choose another instalment
                </button>
              )
            )}

            {preview && (
              <p className="mt-4 rounded-md border border-border bg-surface-2/40 px-4 py-3 text-[13px] text-text-2">{preview}</p>
            )}
          </div>
          )}
        </div>
      )}
    </Drawer>
  );
}
