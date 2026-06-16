"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Search, Building2, Users, Briefcase, Truck, KeyRound, ArrowRight, CornerDownLeft } from "lucide-react";
import type { SearchHit } from "@/app/api/search/route";

const QUICK: { label: string; href: string }[] = [
  { label: "Go to Dashboard", href: "/dashboard" },
  { label: "Go to Properties", href: "/properties" },
  { label: "Go to Tenants", href: "/tenants" },
  { label: "Go to Tenancies", href: "/tenancies" },
  { label: "Go to Payments", href: "/payments" },
  { label: "Go to Maintenance", href: "/maintenance" },
  { label: "Go to Finances", href: "/finances" },
  { label: "Go to Keys", href: "/keys" },
];

const typeIcon = {
  Property: Building2,
  Tenant: Users,
  Landlord: Briefcase,
  Supplier: Truck,
  Key: KeyRound,
} as const;

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Open on Cmd/Ctrl-K or a custom event (topbar search click).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    const onOpen = () => setOpen(true);
    document.addEventListener("keydown", onKey);
    window.addEventListener("merali:command", onOpen);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("merali:command", onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQ("");
      setHits([]);
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  // Debounced search.
  useEffect(() => {
    if (!open) return;
    if (q.trim().length < 2) {
      setHits([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setHits(data.hits ?? []);
        setActive(0);
      } catch {
        setHits([]);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [q, open]);

  const quick = q.trim()
    ? QUICK.filter((x) => x.label.toLowerCase().includes(q.toLowerCase()))
    : QUICK;
  const items = [
    ...hits.map((h) => ({ kind: "hit" as const, ...h })),
    ...quick.map((x) => ({ kind: "quick" as const, label: x.label, href: x.href })),
  ];

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const it = items[active];
      if (it) go(it.href);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-start justify-center px-4 pt-[12vh]">
      <button aria-label="Close" onClick={() => setOpen(false)} className="absolute inset-0 bg-[rgba(46,36,12,0.4)] animate-[fadeIn_.15s_ease]" />
      <div className="relative w-[600px] max-w-full overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--shadow-card)] animate-rise">
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search strokeWidth={1.6} className="h-[18px] w-[18px] text-muted" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search properties, tenants, landlords… or jump to a page"
            className="h-[52px] flex-1 border-0 bg-transparent text-[15px] text-text outline-none placeholder:text-muted"
          />
          <kbd className="rounded border border-border px-1.5 py-0.5 text-[11px] text-muted">esc</kbd>
        </div>
        <div className="max-h-[50vh] overflow-y-auto thin-scroll py-2">
          {items.length === 0 && (
            <p className="px-4 py-6 text-center text-[15px] text-muted">
              {q.trim().length < 2 ? "Type to search…" : "No results."}
            </p>
          )}
          {items.map((it, i) => {
            const Icon = it.kind === "hit" ? typeIcon[it.type] : ArrowRight;
            return (
              <button
                key={`${it.kind}-${i}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(it.href)}
                className={`flex w-full items-center gap-3 px-4 py-[10px] text-left ${active === i ? "bg-surface-2/70" : ""}`}
              >
                <Icon strokeWidth={1.6} className="h-[17px] w-[17px] text-muted" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] text-text">{it.label}</span>
                  {it.kind === "hit" && it.sublabel && <span className="block truncate text-[12px] text-muted">{it.sublabel}</span>}
                </span>
                {it.kind === "hit" && <span className="rounded-pill bg-surface-2 px-2 py-0.5 text-[11px] text-muted">{it.type}</span>}
                {active === i && <CornerDownLeft strokeWidth={1.6} className="h-[14px] w-[14px] text-muted" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}
