"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, Eye, EyeOff, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message || "Unable to sign in. Check your details.");
      setLoading(false);
      return;
    }

    const next = params.get("next") || "/dashboard";
    router.push(next);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col">
      <Field label="Email address">
        <Mail strokeWidth={1.6} className="h-[18px] w-[18px] text-[var(--ink-3)]" />
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="you@meralilettings.com"
          className="min-w-0 flex-1 border-0 bg-transparent text-[15px] text-[var(--ink)] outline-none placeholder:text-[var(--ink-3)]"
        />
      </Field>

      <div className="h-[18px]" />

      <Field label="Password">
        <Lock strokeWidth={1.6} className="h-[17px] w-[17px] text-[var(--ink-3)]" />
        <input
          type={showPw ? "text" : "password"}
          name="password"
          required
          autoComplete="current-password"
          placeholder="••••••••••"
          className="min-w-0 flex-1 border-0 bg-transparent text-[15px] text-[var(--ink)] outline-none placeholder:text-[var(--ink-3)]"
        />
        <button
          type="button"
          onClick={() => setShowPw((v) => !v)}
          className="text-[var(--ink-3)] transition-colors hover:text-[var(--ink-2)]"
          aria-label={showPw ? "Hide password" : "Show password"}
        >
          {showPw ? (
            <EyeOff strokeWidth={1.6} className="h-[18px] w-[18px]" />
          ) : (
            <Eye strokeWidth={1.6} className="h-[18px] w-[18px]" />
          )}
        </button>
      </Field>

      <div className="mb-[26px] mt-4 flex items-center justify-between">
        <label className="flex cursor-pointer items-center gap-[9px] text-[13.5px] text-[var(--ink-2)]">
          <input type="checkbox" className="peer sr-only" />
          <span className="grid h-[17px] w-[17px] place-items-center rounded-[5px] border-[1.5px] border-[var(--line)] bg-[var(--paper)] peer-checked:border-[var(--gold)] peer-checked:bg-[var(--gold)]" />
          Keep me signed in
        </label>
        <Link
          href="/forgot-password"
          className="text-[13.5px] font-semibold text-[var(--gold-deep)] transition-colors hover:text-[var(--gold)]"
        >
          Forgot password?
        </Link>
      </div>

      {error && (
        <p className="mb-3 text-[13px] font-medium text-[var(--bad)]">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="flex h-[54px] w-full items-center justify-center gap-2 rounded-[11px] bg-gold-gradient text-[15px] font-bold tracking-[0.02em] text-[var(--on-gold)] shadow-[var(--shadow-btn)] transition-[filter] hover:brightness-[1.03] disabled:opacity-60"
      >
        {loading ? "Signing in…" : "Sign in"}
        {!loading && <ArrowRight strokeWidth={1.8} className="h-[17px] w-[17px]" />}
      </button>
    </form>
  );
}

/** Local field shell matching login.css (cream form variant). */
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-[9px]">
      <label className="text-[12.5px] font-semibold tracking-[0.04em] text-[var(--ink)]">
        {label}
      </label>
      <div className="flex h-[54px] items-center gap-[10px] rounded-[11px] border border-[var(--line)] bg-[var(--paper)] px-4 transition-colors focus-within:border-[var(--gold)]/60">
        {children}
      </div>
    </div>
  );
}
