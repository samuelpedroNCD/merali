"use client";

import { useState } from "react";
import { Download, Loader2, FileSpreadsheet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

export function ReportCard({
  type,
  label,
  description,
}: {
  type: string;
  label: string;
  description: string;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    try {
      const res = await fetch(`/api/reports?type=${type}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Export failed.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${type}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Report downloaded.");
    } catch {
      toast.error("Export failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex flex-col">
      <span className="grid h-10 w-10 place-items-center rounded-lg bg-surface-2 text-accent">
        <FileSpreadsheet strokeWidth={1.6} className="h-5 w-5" />
      </span>
      <h3 className="mt-3 text-[15px] font-semibold text-text">{label}</h3>
      <p className="mt-1 flex-1 text-[13px] text-muted">{description}</p>
      <Button size="toolbar" variant="ghost" className="mt-4 gap-[6px] self-start" onClick={download} disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download strokeWidth={1.6} className="h-[16px] w-[16px]" />}
        Export CSV
      </Button>
    </Card>
  );
}
