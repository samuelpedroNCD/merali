import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "gold" | "ghost" | "subtle" | "danger";
type Size = "form" | "toolbar" | "sm";

const base =
  "inline-flex items-center justify-center gap-2 font-sans font-semibold whitespace-nowrap rounded-md transition-[transform,background,box-shadow,border-color] duration-150 disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40";

const sizes: Record<Size, string> = {
  form: "h-[54px] px-5 text-[15px]",
  toolbar: "h-[42px] px-4 text-[14px]",
  sm: "h-9 px-3 text-[13px]",
};

const variants: Record<Variant, string> = {
  gold: "bg-gold-gradient text-on-gold font-bold shadow-[var(--shadow-btn)] hover:brightness-[1.03] active:translate-y-px",
  ghost:
    "bg-transparent border border-border text-text hover:bg-surface-2/60",
  subtle: "bg-surface-2 text-text hover:bg-surface-2/70 border border-border",
  danger:
    "bg-transparent border border-border text-[var(--bad)] hover:bg-[color-mix(in_oklch,var(--bad)_12%,transparent)]",
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "gold", size = "toolbar", type = "button", ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(base, sizes[size], variants[variant], className)}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
