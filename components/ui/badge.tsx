import * as React from "react";
import { cn } from "@/lib/utils";

export type Tone = "good" | "warn" | "bad" | "muted" | "accent";

const toneClass: Record<Tone, string> = {
  good: "pill-good",
  warn: "pill-warn",
  bad: "pill-bad",
  muted: "pill-muted",
  accent: "pill-accent",
};

/** Status pill: 12px/600, padding 4×10, pill radius, colour text on 14% tint. */
export function Badge({
  tone = "muted",
  dot = false,
  className,
  children,
}: {
  tone?: Tone;
  dot?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-[5px] rounded-pill px-[10px] py-[4px] text-[11.5px] font-semibold tracking-[0.02em]",
        toneClass[tone],
        className,
      )}
    >
      {dot && (
        <span className="h-[6px] w-[6px] rounded-full bg-current opacity-90" />
      )}
      {children}
    </span>
  );
}
