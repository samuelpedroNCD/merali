"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, Check, X } from "lucide-react";
import { Field, Select } from "@/components/ui/input";
import { addOptionValue } from "@/app/(app)/settings/option-actions";
import type { Option } from "@/lib/data/options";

/**
 * A Select with an inline "+ Add new" affordance that writes a new value to the
 * option_set (category) and selects it — so users can add e.g. a property type
 * or landlord type without leaving the form. Requires settings:edit; otherwise
 * the add returns a permission error shown inline.
 */
export function InlineAddSelect({
  label,
  value,
  onChange,
  options,
  category,
  className,
  placeholder = "Choose…",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options?: Option[];
  category: string;
  className?: string;
  placeholder?: string;
}) {
  const router = useRouter();
  const [extra, setExtra] = useState<Option[]>([]);
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const all = [...(options ?? []), ...extra];

  function add() {
    const v = text.trim();
    if (!v) return;
    setErr(null);
    start(async () => {
      const res = await addOptionValue(category, v);
      if (!res.ok) return setErr(res.error);
      setExtra((e) => [...e, { value: v, label: v }]);
      onChange(v);
      setText("");
      setAdding(false);
      router.refresh();
    });
  }

  return (
    <Field label={label} className={className}>
      <div className="flex flex-col gap-2">
        <Select value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">{placeholder}</option>
          {all.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
        </Select>
        {adding ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
              placeholder="New value"
              className="h-9 flex-1 rounded-md border border-border bg-surface px-2 text-[15px] text-text outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            />
            <button type="button" onClick={add} disabled={pending} aria-label="Save" className="grid h-9 w-9 place-items-center rounded-md bg-gold-gradient text-on-gold">
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check strokeWidth={2} className="h-4 w-4" />}
            </button>
            <button type="button" onClick={() => { setAdding(false); setErr(null); }} aria-label="Cancel" className="grid h-9 w-9 place-items-center rounded-md border border-border text-text-2">
              <X strokeWidth={2} className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setAdding(true)} className="inline-flex items-center gap-1 self-start text-[12.5px] font-semibold text-accent hover:underline">
            <Plus strokeWidth={2} className="h-3 w-3" /> Add new
          </button>
        )}
        {err && <p className="text-[12px] text-[var(--bad)]">{err}</p>}
      </div>
    </Field>
  );
}
