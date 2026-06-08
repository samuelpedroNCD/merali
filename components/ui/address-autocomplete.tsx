"use client";

import { useEffect, useRef, useState } from "react";
import { Building2, Loader2 } from "lucide-react";

export type ResolvedAddress = {
  address: string;
  flat: string;
  town: string;
  area: string;
  postCode: string;
  country: string;
  placeId: string;
};

type Suggestion = { placeId: string; description: string };

/** UK address autocomplete backed by the /api/places server proxy. */
export function AddressAutocomplete({
  value,
  onChange,
  onResolve,
  placeholder = "Start typing a UK address…",
}: {
  value: string;
  onChange: (v: string) => void;
  onResolve: (a: ResolvedAddress) => void;
  placeholder?: string;
}) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [openList, setOpenList] = useState(false);
  const [loading, setLoading] = useState(false);
  const tokenRef = useRef<string>(crypto.randomUUID());
  const boxRef = useRef<HTMLDivElement>(null);
  const skipNext = useRef(false);

  // Debounced autocomplete.
  useEffect(() => {
    if (skipNext.current) {
      skipNext.current = false;
      return;
    }
    if (value.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/places?action=autocomplete&input=${encodeURIComponent(value)}&token=${tokenRef.current}`,
        );
        const data = await res.json();
        setSuggestions(data.suggestions ?? []);
        setOpenList(true);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [value]);

  // Close on outside click.
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpenList(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  async function choose(s: Suggestion) {
    setOpenList(false);
    skipNext.current = true;
    onChange(s.description);
    try {
      const res = await fetch(
        `/api/places?action=details&placeId=${encodeURIComponent(s.placeId)}&token=${tokenRef.current}`,
      );
      const a = (await res.json()) as ResolvedAddress;
      onResolve(a);
    } catch {
      /* keep the typed text */
    }
    tokenRef.current = crypto.randomUUID(); // new billing session
  }

  return (
    <div ref={boxRef} className="relative">
      <div className="flex h-[54px] items-center gap-[10px] rounded-md border border-border bg-surface px-4 focus-within:border-accent/60">
        <Building2 strokeWidth={1.6} className="h-[18px] w-[18px] shrink-0 text-muted" />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => suggestions.length && setOpenList(true)}
          placeholder={placeholder}
          autoComplete="off"
          className="min-w-0 flex-1 border-0 bg-transparent text-[15px] text-text outline-none placeholder:text-muted"
        />
        {loading && <Loader2 className="h-4 w-4 animate-spin text-muted" />}
      </div>

      {openList && suggestions.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-[260px] w-full overflow-auto rounded-md border border-border bg-surface py-1 shadow-[var(--shadow-pop)] thin-scroll">
          {suggestions.map((s) => (
            <li key={s.placeId}>
              <button
                type="button"
                onClick={() => choose(s)}
                className="block w-full px-4 py-[10px] text-left text-[14px] text-text transition-colors hover:bg-surface-2/70"
              >
                {s.description}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
