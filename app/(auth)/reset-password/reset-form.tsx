"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function ResetForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const pw = String(fd.get("password") ?? "");
    const pw2 = String(fd.get("confirm") ?? "");
    if (pw.length < 8) return setError("Password must be at least 8 characters.");
    if (pw !== pw2) return setError("Passwords do not match.");

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: pw });
    setLoading(false);
    if (error) return setError(error.message);
    setDone(true);
    setTimeout(() => router.push("/dashboard"), 1200);
  }

  if (done) {
    return (
      <div className="rounded-[11px] border border-[var(--line)] bg-[var(--paper)] p-5 text-[14px] text-[var(--ink-2)]">
        Password updated. Redirecting you to the dashboard…
      </div>
    );
  }

  const field = (name: string, placeholder: string) => (
    <div className="flex h-[54px] items-center gap-[10px] rounded-[11px] border border-[var(--line)] bg-[var(--paper)] px-4 focus-within:border-[var(--gold)]/60">
      <Lock strokeWidth={1.6} className="h-[17px] w-[17px] text-[var(--ink-3)]" />
      <input name={name} type="password" required placeholder={placeholder} className="min-w-0 flex-1 border-0 bg-transparent text-[15px] text-[var(--ink)] outline-none placeholder:text-[var(--ink-3)]" />
    </div>
  );

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {field("password", "New password")}
      {field("confirm", "Confirm password")}
      {error && <p className="text-[15px] font-medium text-[var(--bad)]">{error}</p>}
      <button type="submit" disabled={loading} className="flex h-[54px] w-full items-center justify-center gap-2 rounded-[11px] bg-gold-gradient text-[15px] font-bold tracking-[0.02em] text-[var(--on-gold)] shadow-[var(--shadow-btn)] hover:brightness-[1.03] disabled:opacity-60">
        {loading ? "Saving…" : "Update password"}
        {!loading && <ArrowRight strokeWidth={1.8} className="h-[17px] w-[17px]" />}
      </button>
    </form>
  );
}
