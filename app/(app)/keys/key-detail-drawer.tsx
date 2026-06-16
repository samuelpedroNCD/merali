"use client";

import { useEffect, useState, useTransition } from "react";
import { ArrowUpRight, ArrowDownLeft, Loader2, Trash2, KeyRound, Plus } from "lucide-react";
import { Drawer } from "@/components/ui/drawer";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { keyStatusTone as statusTone } from "@/lib/badge-tones";
import { Input, Field, Select } from "@/components/ui/input";
import { fmtDate } from "@/lib/utils";
import type { Option } from "@/lib/data/options";
import type { KeyDetail, SpareRow } from "@/lib/data/keys";
import {
  fetchKeyDetail, issueKey, returnKey, issueSpare, returnSpare, addSpare, deleteSpare,
} from "./actions";

type Opt = Option;
const isOut = (s?: string | null) => (s ?? "").toLowerCase() === "out";

export function KeyDetailDrawer({
  keyId,
  open,
  onClose,
  onChanged,
  heldByTypes,
  statuses,
}: {
  keyId: string | null;
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
  heldByTypes: Opt[];
  statuses: Opt[];
}) {
  const [detail, setDetail] = useState<KeyDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();
  const [spareRef, setSpareRef] = useState("");

  // issue/return form state for the main key
  const [heldBy, setHeldBy] = useState("");
  const [holder, setHolder] = useState("");
  const [date, setDate] = useState("");
  const [statusAfter, setStatusAfter] = useState("In Office");

  async function refresh() {
    if (!keyId) return;
    setLoading(true);
    const d = await fetchKeyDetail(keyId);
    setDetail(d);
    setLoading(false);
  }
  useEffect(() => {
    if (open && keyId) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, keyId]);

  function act(fn: () => Promise<{ ok: boolean; error?: string }>) {
    start(async () => {
      const res = await fn();
      if (!res.ok) return toast.error(res.error ?? "Couldn't update the key. Please try again.");
      setHolder(""); setHeldBy(""); setDate("");
      await refresh();
      onChanged();
    });
  }

  const k = detail?.key;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={k?.key_code || "Key"}
      subtitle={k?.property?.address || "Key history & issue/return"}
      size="lg"
      footer={<Button size="toolbar" onClick={onClose}>Close</Button>}
    >
      {loading || !detail ? (
        <div className="grid place-items-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted" /></div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Summary + issue/return */}
          <div className="rounded-lg border border-border p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[14px] font-semibold text-text">Main key</span>
              {k?.status ? <Badge tone={statusTone(k.status)} dot>{k.status}</Badge> : null}
            </div>
            {isOut(k?.status) ? (
              <div className="grid grid-cols-2 gap-4">
                <Field label="Return date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
                <Field label="Status after">
                  <Select value={statusAfter} onChange={(e) => setStatusAfter(e.target.value)}>
                    {statuses.filter((o) => o.value !== "Out").map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
                  </Select>
                </Field>
                <div className="col-span-2">
                  <Button size="toolbar" onClick={() => act(() => returnKey(k!.id, { date_returned: date, status_after: statusAfter, notes: "" }))} disabled={pending} className="gap-[6px]">
                    {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowDownLeft strokeWidth={1.8} className="h-[16px] w-[16px]" />}
                    Return key
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <Field label="Held by type">
                  <Select value={heldBy} onChange={(e) => setHeldBy(e.target.value)}>
                    <option value="">Choose…</option>
                    {heldByTypes.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
                  </Select>
                </Field>
                <Field label="Holder name"><Input value={holder} onChange={(e) => setHolder(e.target.value)} placeholder="Who's receiving it" /></Field>
                <Field label="Date given"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
                <div className="flex items-end">
                  <Button size="toolbar" onClick={() => act(() => issueKey(k!.id, { held_by_type: heldBy, holder, date_given: date, notes: "" }))} disabled={pending} className="gap-[6px]">
                    {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpRight strokeWidth={1.8} className="h-[16px] w-[16px]" />}
                    Issue key
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Spares */}
          <div className="rounded-lg border border-border p-4">
            <div className="mb-3 flex items-center gap-2 text-[14px] font-semibold text-text">
              <KeyRound strokeWidth={1.6} className="h-4 w-4 text-accent" /> Spare keys ({detail.spares.length})
            </div>
            <div className="flex flex-col gap-2">
              {detail.spares.map((sp) => (
                <SpareRowItem key={sp.id} spare={sp} keyId={k!.id} heldByTypes={heldByTypes} statuses={statuses} onAct={act} pending={pending} />
              ))}
              {detail.spares.length === 0 && <p className="text-[15px] text-muted">No spares yet.</p>}
            </div>
            <div className="mt-3 flex gap-2">
              <Input placeholder="Spare reference…" value={spareRef} onChange={(e) => setSpareRef(e.target.value)} className="h-[44px]" />
              <Button variant="ghost" size="toolbar" className="gap-[6px]" disabled={pending || !spareRef.trim()} onClick={() => act(async () => { const r = await addSpare(k!.id, spareRef); setSpareRef(""); return r; })}>
                <Plus strokeWidth={1.8} className="h-[16px] w-[16px]" /> Add spare
              </Button>
            </div>
          </div>

          {/* History timeline */}
          <div>
            <p className="mb-3 text-[14px] font-semibold text-text">History</p>
            {detail.log.length === 0 ? (
              <p className="text-[15px] text-muted">No issue/return events yet.</p>
            ) : (
              <ul className="flex flex-col">
                {detail.log.map((l) => {
                  const out = !!l.action_out_when && l.is_open;
                  const returned = !!l.action_in_when;
                  return (
                    <li key={l.id} className="flex gap-3 border-t border-border py-3 first:border-t-0">
                      <span className={`mt-[2px] grid h-7 w-7 shrink-0 place-items-center rounded-full ${returned && !l.is_open ? "bg-[color-mix(in_oklch,var(--good)_16%,transparent)]" : "bg-surface-2"}`}>
                        {returned && !l.is_open
                          ? <ArrowDownLeft strokeWidth={1.7} className="h-[16px] w-[16px] text-[var(--good)]" />
                          : <ArrowUpRight strokeWidth={1.7} className="h-[16px] w-[16px] text-[var(--warn)]" />}
                      </span>
                      <div className="min-w-0 flex-1 text-[15px]">
                        <p className="font-medium text-text">
                          {l.is_spare_snapshot ? "Spare " : ""}{out && !returned ? "Issued" : l.is_open ? "Issued (out)" : "Returned"}
                          {l.held_by_type_snapshot ? ` · ${l.held_by_type_snapshot}` : ""}
                          {l.holder ? ` · ${l.holder}` : ""}
                        </p>
                        <p className="text-muted">
                          {l.action_out_when ? `Out ${fmtDate(l.action_out_when)}${l.issued_by_name ? ` by ${l.issued_by_name}` : ""}` : ""}
                          {l.action_in_when ? `${l.action_out_when ? " · " : ""}In ${fmtDate(l.action_in_when)}${l.received_by_name ? ` by ${l.received_by_name}` : ""}` : ""}
                          {l.status_after_return ? ` · ${l.status_after_return}` : ""}
                        </p>
                      </div>
                      {l.is_open && <Badge tone="warn">Open</Badge>}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </Drawer>
  );
}

function SpareRowItem({
  spare, keyId, heldByTypes, statuses, onAct, pending,
}: {
  spare: SpareRow;
  keyId: string;
  heldByTypes: Opt[];
  statuses: Opt[];
  onAct: (fn: () => Promise<{ ok: boolean; error?: string }>) => void;
  pending: boolean;
}) {
  const [expand, setExpand] = useState(false);
  const [heldBy, setHeldBy] = useState("");
  const [holder, setHolder] = useState("");
  const out = isOut(spare.status);

  return (
    <div className="rounded-md border border-border px-3 py-2">
      <div className="flex items-center gap-3">
        <span className="flex-1 truncate text-[13.5px] text-text">{spare.reference || "Spare"}</span>
        {spare.status ? <Badge tone={statusTone(spare.status)}>{spare.status}</Badge> : <Badge tone="muted">In Office</Badge>}
        <button onClick={() => setExpand((v) => !v)} className="text-[12.5px] font-medium text-accent">{out ? "Return" : "Issue"}</button>
        <button onClick={() => onAct(() => deleteSpare(spare.id))} disabled={pending} className="grid h-7 w-7 place-items-center rounded-md text-[var(--bad)] hover:bg-[color-mix(in_oklch,var(--bad)_12%,transparent)]" aria-label="Delete spare">
          <Trash2 strokeWidth={1.6} className="h-[14px] w-[14px]" />
        </button>
      </div>
      {expand && (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          {out ? (
            <Button size="sm" onClick={() => onAct(async () => { const r = await returnSpare(keyId, spare.id, { date_returned: "", status_after: "In Office", notes: "" }); setExpand(false); return r; })} disabled={pending}>
              Confirm return
            </Button>
          ) : (
            <>
              <Select value={heldBy} onChange={(e) => setHeldBy(e.target.value)} className="h-9 max-w-[150px] text-[15px]">
                <option value="">Held by…</option>
                {heldByTypes.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
              </Select>
              <Input value={holder} onChange={(e) => setHolder(e.target.value)} placeholder="Holder" className="h-9 max-w-[160px] text-[15px]" />
              <Button size="sm" onClick={() => onAct(async () => { const r = await issueSpare(keyId, spare.id, { held_by_type: heldBy, holder, date_given: "", notes: "" }); setExpand(false); return r; })} disabled={pending}>
                Confirm issue
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
