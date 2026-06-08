"use client";

import { cn } from "@/lib/utils";

/** Pill tab bar (used in detail pages and drawer wizards). */
export function Tabs({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: { key: string; label: string }[];
  value: string;
  onChange: (key: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {tabs.map((t) => {
        const active = t.key === value;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            className={cn(
              "rounded-pill px-[14px] py-[7px] text-[13px] font-semibold transition-colors",
              active
                ? "bg-gold-gradient text-on-gold"
                : "border border-border bg-surface text-text-2 hover:bg-surface-2/60",
            )}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
