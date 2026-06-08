"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Check, AlertCircle, Info, X } from "lucide-react";

type Tone = "success" | "error" | "info";
type Toast = { id: number; message: string; tone: Tone };

type ToastApi = {
  show: (message: string, tone?: Tone) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const remove = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const show = useCallback(
    (message: string, tone: Tone = "info") => {
      const id = ++idRef.current;
      setToasts((t) => [...t, { id, message, tone }]);
      setTimeout(() => remove(id), 4000);
    },
    [remove],
  );

  const api: ToastApi = {
    show,
    success: (m) => show(m, "success"),
    error: (m) => show(m, "error"),
    info: (m) => show(m, "info"),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      {typeof document !== "undefined" &&
        createPortal(
          <div className="pointer-events-none fixed right-5 top-5 z-[100] flex w-[340px] max-w-[calc(100vw-2.5rem)] flex-col gap-2">
            {toasts.map((t) => (
              <ToastItem key={t.id} toast={t} onClose={() => remove(t.id)} />
            ))}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}

const toneStyles: Record<Tone, { color: string; Icon: typeof Check }> = {
  success: { color: "var(--good)", Icon: Check },
  error: { color: "var(--bad)", Icon: AlertCircle },
  info: { color: "var(--c-accent)", Icon: Info },
};

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const { color, Icon } = toneStyles[toast.tone];
  return (
    <div
      role="status"
      className="animate-[slideInRight_.2s_var(--ease)] pointer-events-auto flex items-start gap-3 rounded-md border border-border bg-surface px-4 py-3 shadow-[var(--shadow-pop)]"
      style={{ borderLeft: `3px solid ${color}` }}
    >
      <Icon strokeWidth={1.8} className="mt-[1px] h-[18px] w-[18px] shrink-0" style={{ color }} />
      <p className="min-w-0 flex-1 text-[13.5px] leading-snug text-text">{toast.message}</p>
      <button
        onClick={onClose}
        aria-label="Dismiss"
        className="shrink-0 text-muted transition-colors hover:text-text-2"
      >
        <X strokeWidth={1.6} className="h-[16px] w-[16px]" />
      </button>
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
