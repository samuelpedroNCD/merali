"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import type { OptionCategory } from "@/lib/data/option-admin";
import { CATEGORY_LABELS } from "@/lib/option-categories";
import { addOptionValue, renameOptionValue, setOptionActive } from "./option-actions";

export function OptionSetsManager({ optionSets }: { optionSets: OptionCategory[] }) {
  const router = useRouter();
  const toast = useToast();
  const [category, setCategory] = useState(optionSets[0]?.category ?? "");
  const [newValue, setNewValue] = useState("");
  const [pending, start] = useTransition();

  const current = optionSets.find((o) => o.category === category);

  function act(fn: () => Promise<{ ok: boolean; error?: string }>, msg?: string) {
    start(async () => {
      const res = await fn();
      if (!res.ok) return toast.error(res.error ?? "Couldn't save. Please try again.");
      if (msg) toast.success(msg);
      router.refresh();
    });
  }

  return (
    <Card className="max-w-[760px]">
      <h3 className="text-[16px] font-semibold text-text">Option sets</h3>
      <p className="mb-5 mt-1 text-[15px] text-muted">
        Manage the dropdown values used across the app. Deactivating hides a value from new
        forms without affecting existing records.
      </p>

      <div className="mb-5 max-w-[320px]">
        <Select value={category} onChange={(e) => setCategory(e.target.value)}>
          {optionSets.map((o) => (
            <option key={o.category} value={o.category}>
              {CATEGORY_LABELS[o.category] ?? o.category}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        {current?.values.map((v) => (
          <ValueRow
            key={v.id}
            id={v.id}
            label={v.label}
            active={v.active}
            pending={pending}
            onRename={(label) => act(() => renameOptionValue(v.id, label), "Renamed.")}
            onToggle={() => act(() => setOptionActive(v.id, !v.active))}
          />
        ))}
        {(!current || current.values.length === 0) && (
          <p className="text-[15px] text-muted">No values in this category yet.</p>
        )}
      </div>

      <div className="mt-4 flex gap-2">
        <Input
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          placeholder="Add a new value…"
          className="h-[44px] max-w-[320px]"
        />
        <Button
          variant="ghost"
          size="toolbar"
          className="gap-[6px]"
          disabled={pending || !newValue.trim()}
          onClick={() =>
            act(async () => {
              const r = await addOptionValue(category, newValue);
              setNewValue("");
              return r;
            }, "Added.")
          }
        >
          <Plus strokeWidth={1.8} className="h-[16px] w-[16px]" /> Add
        </Button>
      </div>
    </Card>
  );
}

function ValueRow({
  label, active, pending, onRename, onToggle,
}: {
  id: string;
  label: string;
  active: boolean;
  pending: boolean;
  onRename: (label: string) => void;
  onToggle: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(label);

  return (
    <div className="flex items-center gap-2 rounded-md border border-border px-3 py-2">
      {editing ? (
        <>
          <Input value={text} onChange={(e) => setText(e.target.value)} className="h-9 flex-1" />
          <Button variant="ghost" size="sm" disabled={pending} onClick={() => { onRename(text); setEditing(false); }}>
            <Check className="h-4 w-4" />
          </Button>
        </>
      ) : (
        <>
          <span className={`flex-1 text-[13.5px] ${active ? "text-text" : "text-muted line-through"}`}>{label}</span>
          <button onClick={() => setEditing(true)} className="text-[12.5px] font-medium text-accent">Rename</button>
          <button onClick={onToggle} disabled={pending} className="text-[12.5px] font-medium text-text-2">
            {active ? "Deactivate" : "Activate"}
          </button>
        </>
      )}
      {pending && <Loader2 className="h-4 w-4 animate-spin text-muted" />}
    </div>
  );
}
