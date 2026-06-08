import * as React from "react";

/** Page title block: serif-free heading + muted subtitle, optional action. */
export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-[26px] font-semibold tracking-[-0.01em] text-text">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-[2px] text-[14px] text-muted">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}
