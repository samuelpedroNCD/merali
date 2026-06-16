"use client";

import { useState, useMemo } from "react";
import { Download } from "lucide-react";
import { Topbar } from "@/components/shell/topbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import type { LogRow } from "@/lib/data/logs";

function fmtDateTime(d: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(d));
}

export function LogsClient({ logs }: { logs: LogRow[] }) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");

  const types = useMemo(
    () => Array.from(new Set(logs.map((l) => l.type))).sort(),
    [logs],
  );

  const filtered = useMemo(
    () =>
      logs.filter(
        (l) =>
          (!type || l.type === type) &&
          (!query.trim() ||
            (l.object_label ?? "").toLowerCase().includes(query.toLowerCase()) ||
            (l.creator ?? "").toLowerCase().includes(query.toLowerCase())),
      ),
    [logs, type, query],
  );

  function exportCsv() {
    const head = ["Type", "Object", "Table", "Creator", "Date"];
    const lines = filtered.map((l) =>
      [l.type, (l.object_label ?? "").replace(/,/g, " "), l.object_table ?? "", l.creator ?? "", l.created_at].join(","),
    );
    const blob = new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "activity-logs.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <Topbar
        search="Search logs…"
        action={
          <Button variant="ghost" size="toolbar" className="gap-[6px]" onClick={exportCsv}>
            <Download strokeWidth={1.6} className="h-[16px] w-[16px]" /> Export CSV
          </Button>
        }
      />
      <main className="flex flex-1 flex-col gap-[22px] overflow-y-auto thin-scroll px-[34px] py-[30px]">
        <div>
          <h1 className="text-[26px] font-semibold tracking-[-0.01em] text-text">Logs</h1>
          <p className="mt-[2px] text-[14px] text-muted">Audit trail of actions across the platform.</p>
        </div>
        <div className="flex gap-3">
          <Input placeholder="Search by object or creator…" className="max-w-[380px]" value={query} onChange={(e) => setQuery(e.target.value)} />
          <Select className="h-[54px] max-w-[220px]" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">All types</option>
            {types.map((t) => (<option key={t} value={t}>{t}</option>))}
          </Select>
        </div>
        <Card className="p-0">
          <div className="grid grid-cols-[1.3fr_1.6fr_1fr_1fr] items-center gap-4 border-b border-border px-6 py-4 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">
            <span>Type</span><span>Object</span><span>Creator</span><span>Date</span>
          </div>
          {filtered.length === 0 && (
            <div className="grid place-items-center py-16 text-center">
              <p className="text-[15px] text-muted">No activity logged.</p>
            </div>
          )}
          {filtered.map((l) => (
            <div key={l.id} className="grid grid-cols-[1.3fr_1.6fr_1fr_1fr] items-center gap-4 border-b border-border px-6 py-3 text-[13.5px] last:border-b-0">
              <span className="font-medium text-text">{l.type}</span>
              <span className="truncate text-text-2">{l.object_label || "—"}</span>
              <span className="text-text-2">{l.creator || "—"}</span>
              <span className="text-muted">{fmtDateTime(l.created_at)}</span>
            </div>
          ))}
        </Card>
      </main>
    </>
  );
}
