import * as React from "react";
import { cn } from "@/lib/utils";

/** Field wrapper: label (12.5px / 600) above the control. */
export function Field({
  label,
  htmlFor,
  hint,
  children,
  className,
}: {
  label?: string;
  htmlFor?: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-[9px]", className)}>
      {label && (
        <label
          htmlFor={htmlFor}
          className="text-[12.5px] font-semibold tracking-[0.04em] text-text"
        >
          {label}
        </label>
      )}
      {children}
      {hint && <p className="text-[12px] text-muted">{hint}</p>}
    </div>
  );
}

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  leadingIcon?: React.ReactNode;
  trailing?: React.ReactNode;
}

/** Input shell: h54, radius md, 1px border, surface bg, optional lead/trail. */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, leadingIcon, trailing, ...props }, ref) => {
    return (
      <div
        className={cn(
          "flex h-[54px] items-center gap-[10px] rounded-md border border-border bg-surface px-4",
          "focus-within:border-accent/60 transition-colors",
          className,
        )}
      >
        {leadingIcon && (
          <span className="flex shrink-0 text-muted [&_svg]:h-[18px] [&_svg]:w-[18px]">
            {leadingIcon}
          </span>
        )}
        <input
          ref={ref}
          className="min-w-0 flex-1 border-0 bg-transparent text-[15px] text-text outline-none placeholder:text-muted"
          {...props}
        />
        {trailing && <span className="shrink-0 text-muted">{trailing}</span>}
      </div>
    );
  },
);
Input.displayName = "Input";

/** Textarea matching the input language. */
export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      className={cn(
        "min-h-[96px] w-full rounded-md border border-border bg-surface px-4 py-3 text-[15px] text-text outline-none placeholder:text-muted focus:border-accent/60 transition-colors",
        className,
      )}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

/** Select matching the input language. */
export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => {
  return (
    <select
      ref={ref}
      className={cn(
        "h-[54px] w-full rounded-md border border-border bg-surface px-4 text-[15px] text-text outline-none focus:border-accent/60 transition-colors",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
});
Select.displayName = "Select";
