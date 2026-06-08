import { cn } from "@/lib/utils";

export type Bar = { label: string; value: number; current?: boolean };

/** Rent-collection bar chart — gold fill to % height, current month full. */
export function Bars({
  data,
  height = 150,
  className,
}: {
  data: Bar[];
  height?: number;
  className?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <div
      className={cn("flex items-end gap-[10px]", className)}
      style={{ height }}
    >
      {data.map((d, i) => {
        const h = (d.value / max) * 100;
        return (
          <div
            key={i}
            className="flex h-full flex-1 flex-col items-center justify-end gap-2"
          >
            <div className="relative w-full max-w-[26px] flex-1 rounded-[6px_6px_3px_3px] bg-surface-2">
              <span
                className={cn(
                  "absolute inset-x-0 bottom-0 rounded-[6px_6px_3px_3px] bg-gold-gradient",
                  d.current ? "opacity-100" : "opacity-[0.62]",
                )}
                style={{ height: `${h}%` }}
              />
            </div>
            <span
              className={cn(
                "text-[11px]",
                d.current ? "font-semibold text-accent" : "text-muted",
              )}
            >
              {d.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
