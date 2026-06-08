import { requireUser, can } from "@/lib/auth";
import { Topbar } from "@/components/shell/topbar";
import { REPORTS } from "@/lib/data/reports";
import { SOURCE_META } from "@/lib/data/report-sources";
import { listPropertyOptions } from "@/lib/data/leases";
import { createClient } from "@/lib/supabase/server";
import { ReportCard } from "./report-card";
import { ReportBuilder } from "./report-builder";

export default async function ReportsPage() {
  const user = await requireUser();
  const available = REPORTS.filter((r) => can(user, r.module, "view"));

  const supabase = await createClient();
  const [properties, { data: templates }] = await Promise.all([
    listPropertyOptions(),
    supabase.from("report_template").select("id, name, source, fields, filters").order("created_at", { ascending: false }),
  ]);

  return (
    <>
      <Topbar search="Search…" />
      <main className="flex flex-1 flex-col gap-[22px] overflow-y-auto thin-scroll px-[34px] py-[30px]">
        <div>
          <h1 className="text-[26px] font-semibold tracking-[-0.01em] text-text">Reports</h1>
          <p className="mt-[2px] text-[14px] text-muted">Build custom reports — pick any fields and filters — or use a quick export.</p>
        </div>

        <ReportBuilder
          sources={SOURCE_META}
          properties={properties}
          templates={(templates ?? []) as React.ComponentProps<typeof ReportBuilder>["templates"]}
        />

        <div>
          <h2 className="mb-3 text-[16px] font-semibold text-text">Quick exports</h2>
          {available.length === 0 ? (
            <p className="text-[14px] text-muted">You don&apos;t have permission to export any reports.</p>
          ) : (
            <div className="grid grid-cols-1 gap-[14px] md:grid-cols-2 lg:grid-cols-3">
              {available.map((r) => (
                <ReportCard key={r.type} type={r.type} label={r.label} description={r.description} />
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
