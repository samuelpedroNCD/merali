"use client";

import { Download } from "lucide-react";

export function VatExportButton({
  rows,
}: {
  rows: { quarter: string; collected: number; paid: number; net: number }[];
}) {
  function exportCsv() {
    const head = ["Quarter", "VAT collected (sales)", "VAT paid (purchases)", "Net VAT due"];
    const lines = rows.map((r) =>
      [r.quarter, r.collected.toFixed(2), r.paid.toFixed(2), r.net.toFixed(2)].join(","),
    );
    const csv = [head.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "vat-return.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      onClick={exportCsv}
      className="inline-flex items-center gap-1 text-[13px] font-semibold text-accent hover:underline"
    >
      <Download strokeWidth={1.6} className="h-[14px] w-[14px]" /> VAT CSV
    </button>
  );
}
