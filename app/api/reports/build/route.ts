import { type NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { runReport, type ReportFilters } from "@/lib/data/report-sources";
import { toCsv } from "@/lib/csv";

export async function POST(request: NextRequest) {
  await requireUser();
  let body: { source?: string; fields?: string[]; filters?: ReportFilters; format?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const { source = "", fields = [], filters = {}, format } = body;
  const { header, rows } = await runReport(source, fields, filters);

  if (format === "csv") {
    const csv = toCsv(header, rows);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${source || "report"}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }
  // Preview: cap rows so the response stays small.
  return NextResponse.json({ header, rows: rows.slice(0, 200), total: rows.length });
}
