"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePlaidLink } from "react-plaid-link";
import { Landmark, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LinkBankButton() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const onSuccess = useCallback(
    async (public_token: string) => {
      setBusy(true);
      setMsg("Linking…");
      try {
        const res = await fetch("/api/plaid/exchange", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ public_token }),
        });
        const data = await res.json();
        if (!res.ok) {
          setMsg("Link failed");
        } else {
          setMsg(`Linked · ${data.synced?.added ?? 0} transactions`);
          router.refresh();
        }
      } finally {
        setBusy(false);
        setToken(null);
      }
    },
    [router],
  );

  const { open, ready } = usePlaidLink({
    token,
    onSuccess: (public_token) => onSuccess(public_token),
  });

  useEffect(() => {
    if (token && ready) open();
  }, [token, ready, open]);

  async function start() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/plaid/link-token", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.link_token) {
        setMsg("Couldn't start Plaid");
        setBusy(false);
        return;
      }
      setToken(data.link_token);
      setBusy(false);
    } catch {
      setMsg("Couldn't start Plaid");
      setBusy(false);
    }
  }

  async function sync() {
    setBusy(true);
    setMsg("Syncing…");
    try {
      const res = await fetch("/api/plaid/sync", { method: "POST" });
      const data = await res.json();
      setMsg(res.ok ? `Synced · +${data.added ?? 0}` : "Sync failed");
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {msg && <span className="text-[12.5px] text-muted">{msg}</span>}
      <Button variant="ghost" size="toolbar" className="gap-[6px]" onClick={sync} disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw strokeWidth={1.6} className="h-[16px] w-[16px]" />}
        Sync
      </Button>
      <Button size="toolbar" className="gap-[6px]" onClick={start} disabled={busy}>
        <Landmark strokeWidth={1.6} className="h-[16px] w-[16px]" />
        Link bank account
      </Button>
    </div>
  );
}
