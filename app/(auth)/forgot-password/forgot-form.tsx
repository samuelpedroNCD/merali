"use client";

import { useState } from "react";
import { Mail, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function ForgotForm() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const email = String(new FormData(e.currentTarget).get("email") ?? "").trim();
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  if (sent) {
    return (
      <div className="rounded-[11px] border border-[var(--line)] bg-[var(--paper)] p-5 text-[14px] text-[var(--ink-2)]">
        Check your email for a reset link. If it doesn’t arrive, confirm the address is correct or contact an administrator.
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex h-[54px] items-center gap-[10px] rounded-[11px] border border-[var(--line)] bg-[var(--paper)] px-4 focus-within:border-[var(--gold)]/60">
        <Mail strokeWidth={1.6} className="h-[18px] w-[18px] text-[var(--ink-3)]" />
        <input name="email" type="email" required placeholder="you@meralilettings.com" className="min-w-0 flex-1 border-0 bg-transparent text-[15px] text-[var(--ink)] outline-none placeholder:text-[var(--ink-3)]" />
      </div>
      {error && <p className="text-[15px] font-medium text-[var(--bad)]">{error}</p>}
      <button type="submit" disabled={loading} className="flex h-[54px] w-full items-center justify-center gap-2 rounded-[11px] bg-gold-gradient text-[15px] font-bold tracking-[0.02em] text-[var(--on-gold)] shadow-[var(--shadow-btn)] hover:brightness-[1.03] disabled:opacity-60">
        {loading ? "Sending…" : "Send reset link"}
        {!loading && <ArrowRight strokeWidth={1.8} className="h-[17px] w-[17px]" />}
      </button>
    </form>
  );
}
