import * as React from "react";
import { cn } from "@/lib/utils";

export interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Show a warn-coloured notification dot, top-right. */
  notify?: boolean;
}

/** 42×42 icon button, radius md, 1px border, surface bg, icon in text-2. */
export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, notify = false, children, type = "button", ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "relative grid h-[42px] w-[42px] place-items-center rounded-md border border-border bg-surface text-text-2",
          "transition-colors hover:bg-surface-2/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
          "[&_svg]:h-[18px] [&_svg]:w-[18px]",
          className,
        )}
        {...props}
      >
        {children}
        {notify && (
          <span className="absolute right-[9px] top-[9px] h-[7px] w-[7px] rounded-full bg-[var(--warn)] ring-2 ring-surface" />
        )}
      </button>
    );
  },
);
IconButton.displayName = "IconButton";
