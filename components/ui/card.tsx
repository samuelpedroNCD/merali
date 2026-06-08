import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-surface px-6 py-[22px]",
        className,
      )}
      {...props}
    />
  );
}

/** Card header: h3 title left, optional action right (space-between, mb 18). */
export function CardHeader({
  title,
  action,
  className,
}: {
  title: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-[18px] flex items-center justify-between gap-3",
        className,
      )}
    >
      <h3 className="whitespace-nowrap text-[16px] font-semibold tracking-[-0.01em] text-text">
        {title}
      </h3>
      {action}
    </div>
  );
}
