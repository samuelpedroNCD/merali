"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type DrawerSize = "md" | "lg" | "xl";

// Width as a share of the viewport — kept within the 40–60% band the brief asks for.
const widthClass: Record<DrawerSize, string> = {
  md: "w-[46vw] min-w-[520px] max-w-[760px]",
  lg: "w-[54vw] min-w-[600px] max-w-[920px]",
  xl: "w-[60vw] min-w-[680px] max-w-[1040px]",
};

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  size?: DrawerSize;
  /** Sticky footer action bar (e.g. Cancel + Save). */
  footer?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Right-anchored drawer — the primary create/edit surface (replaces centred
 * modals). 40–60% viewport width, full height, scrim, slide-in from right.
 */
export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  size = "md",
  footer,
  children,
}: DrawerProps) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const panelRef = React.useRef<HTMLDivElement>(null);

  // Keep the latest onClose in a ref so the focus-trap effect below does NOT
  // depend on it. onClose is typically an inline arrow recreated on every parent
  // render; if the effect depended on it, each keystroke (which re-renders the
  // parent that owns the form state) would tear down and re-run the effect,
  // refocusing the first field and stealing focus after a single character.
  const onCloseRef = React.useRef(onClose);
  React.useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Escape to close + lock body scroll + focus trap while open.
  // Runs once per open/close — never on keystrokes (see onCloseRef above).
  React.useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const focusables = () =>
      Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((el) => el.offsetParent !== null);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (e.key === "Tab") {
        const els = focusables();
        if (els.length === 0) return;
        const first = els[0];
        const last = els[els.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Focus the first field once the panel is mounted.
    const t = setTimeout(() => focusables()[0]?.focus(), 30);

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      clearTimeout(t);
      previouslyFocused?.focus?.();
    };
    // Depends ONLY on `open` — NOT onClose. onClose is an inline arrow recreated
    // every parent render; including it here made the effect tear down and re-run
    // on each keystroke, refocusing the first field. The latest onClose is read
    // via onCloseRef instead.
  }, [open]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50">
      {/* Scrim */}
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-[rgba(46,36,12,0.4)] animate-[fadeIn_.18s_ease] backdrop-blur-[1px]"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        className={cn(
          "absolute right-0 top-0 flex h-full flex-col border-l border-border bg-surface shadow-[var(--shadow-card)]",
          "animate-[slideInRight_.22s_var(--ease)]",
          widthClass[size],
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-border px-7 py-[22px]">
          <div className="min-w-0">
            <h2 className="font-display text-[26px] font-semibold leading-tight tracking-[-0.01em] text-text">
              {title}
            </h2>
            {subtitle && (
              <p className="mt-[2px] text-[13.5px] text-muted">{subtitle}</p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close drawer"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-border text-text-2 transition-colors hover:bg-surface-2/60"
          >
            <X strokeWidth={1.6} className="h-[18px] w-[18px]" />
          </button>
        </div>

        {/* Body */}
        <div className="thin-scroll flex-1 overflow-y-auto px-7 py-6">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-3 border-t border-border bg-surface px-7 py-5">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
