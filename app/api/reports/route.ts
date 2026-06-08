import { type NextRequest, NextResponse } from "next/server";
import { requireUser, can } from "@/lib/auth";
import { REPORTS, buildReport, type ReportType } from "@/lib/data/reports";

export async function GET(request: NextRequest) {
  const user = await requireUser();
  const type = request.nextUrl.searchParams.get("type") as ReportType | null;
  const def = REPORTS.find((r) => r.type === type);
  if (!def) return NextResponse.json({ error: "Unknown report." }, { status: 400 });
  if (!can(user, def.module, "view")) {
    return NextResponse.json({ error: "Not permitted." }, { status: 403 });
  }

  const { filename, csv } = await buildReport(def.type);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
