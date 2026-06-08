import * as React from "react";
import { ChevronUp, ChevronDown, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface StatProps {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: LucideIcon;
  /** Percent change (e.g. +4.2). */
  delta?: number;
  /** When true, an increase is good (green up). When false (arrears/cost),
   * a decrease is good — the colour inverts. */
  goodWhenUp?: boolean;
  className?: string;
}

/** KPI / stat card: label → serif value → delta + sub. */
export function Stat({
  label,
  value,
  sub,
  icon: Icon,
  delta,
  goodWhenUp = true,
  className,
}: StatProps) {
  const up = (delta ?? 0) >= 0;
  const isGood = up === goodWhenUp;
  const showDelta = delta !== undefined && delta !== null;

  return (
    <Card className={cn("flex-1", className)}>
      <div className="flex items-start justify-between">
        <p className="text-[13px] font-medium text-muted">{label}</p>
        {Icon && (
          <Icon strokeWidth={1.6} className="h-[18px] w-[18px] text-muted" />
        )}
      </div>
      <p className="my-[6px] font-display text-[32px] font-semibold leading-none tracking-[-0.02em] text-text">
        {value}
      </p>
      <div className="flex items-center gap-2 text-[12.5px]">
        {showDelta && (
          <span
            className={cn(
              "inline-flex items-center gap-[2px] font-semibold",
              isGood ? "text-[var(--good)]" : "text-[var(--bad)]",
            )}
          >
            {up ? (
              <ChevronUp className="h-[14px] w-[14px]" />
            ) : (
              <ChevronDown className="h-[14px] w-[14px]" />
            )}
            {Math.abs(delta!)}%
          </span>
        )}
        {sub && <span className="text-muted">{sub}</span>}
      </div>
    </Card>
  );
}
