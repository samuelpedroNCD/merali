"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

type ConfirmOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<(v: boolean) => void>(() => {});

  const confirm = useCallback<ConfirmFn>((opts) => {
    setState(opts);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = useCallback(
    (result: boolean) => {
      resolver.current(result);
      setState(null);
    },
    [],
  );

  useEffect(() => {
    if (!state) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(false);
      if (e.key === "Enter") close(true);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [state, close]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[110] grid place-items-center p-4">
            <button
              aria-label="Cancel"
              onClick={() => close(false)}
              className="absolute inset-0 bg-[rgba(46,36,12,0.4)] animate-[fadeIn_.15s_ease]"
            />
            <div
              role="alertdialog"
              aria-modal="true"
              className="relative w-[420px] max-w-full animate-rise rounded-xl border border-border bg-surface p-6 shadow-[var(--shadow-card)]"
            >
              <div className="flex items-start gap-3">
                {state.danger && (
                  <span className="mt-[2px] grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[color-mix(in_oklch,var(--bad)_14%,transparent)]">
                    <AlertTriangle strokeWidth={1.7} className="h-[18px] w-[18px] text-[var(--bad)]" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <h2 className="text-[16px] font-semibold text-text">
                    {state.title ?? "Are you sure?"}
                  </h2>
                  <p className="mt-1 text-[13.5px] leading-snug text-text-2">
                    {state.message}
                  </p>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <Button variant="ghost" size="toolbar" onClick={() => close(false)}>
                  {state.cancelLabel ?? "Cancel"}
                </Button>
                <Button
                  variant={state.danger ? "danger" : "gold"}
                  size="toolbar"
                  onClick={() => close(true)}
                  autoFocus
                >
                  {state.confirmLabel ?? "Confirm"}
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
  return ctx;
}
