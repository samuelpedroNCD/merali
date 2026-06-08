import { cn } from "@/lib/utils";

/** Occupancy donut — conic-gradient ring, surface hole, serif % centre. */
export function Donut({
  percent,
  size = 168,
  caption,
  className,
}: {
  percent: number;
  size?: number;
  caption?: string;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, percent));
  const deg = pct * 3.6;
  const showCaption = caption && size >= 130;

  return (
    <div
      className={cn("relative grid place-items-center", className)}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: `conic-gradient(var(--c-accent) 0 ${deg}deg, var(--c-surface-2) 0)`,
      }}
    >
      {/* Hole */}
      <div
        className="absolute rounded-full bg-surface"
        style={{ inset: "12%" }}
      />
      <div className="relative grid place-items-center text-center">
        <span
          className="font-display font-semibold leading-none text-text"
          style={{ fontSize: size * 0.21 }}
        >
          {Math.round(pct)}%
        </span>
        {showCaption && (
          <span className="mt-1 text-[11.5px] text-muted">{caption}</span>
        )}
      </div>
    </div>
  );
}
