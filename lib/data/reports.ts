import { createClient } from "@/lib/supabase/server";
import { toCsv } from "@/lib/csv";

export type ReportType = "compliance" | "financial" | "maintenance" | "arrears" | "activity";

export const REPORTS: {
  type: ReportType;
  label: string;
  description: string;
  module: string; // permission module needed to view/export
}[] = [
  { type: "financial", label: "Financial transactions", description: "Every ledger entry with net / VAT / gross and status.", module: "finance" },
  { type: "arrears", label: "Rent arrears", description: "Outstanding rent per tenancy, past due date.", module: "finance" },
  { type: "compliance", label: "Compliance certificates", description: "All certifications with expiry status per property.", module: "certifications" },
  { type: "maintenance", label: "Maintenance jobs", description: "Jobs with status, urgency, assignee, supplier and cost.", module: "maintenance" },
  { type: "activity", label: "Activity log", description: "Full audit trail of significant actions.", module: "logs" },
];

const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);

/** Build a CSV report. Returns { filename, csv }. */
export async function buildReport(type: ReportType): Promise<{ filename: string; csv: string }> {
  const supabase = await createClient();

  if (type === "financial") {
    const { data } = await supabase
      .from("transaction")
      .select("txn_date, type, category, amount_net, vat_amount, amount_gross, status, property:property_id(address)")
      .order("txn_date", { ascending: false })
      .limit(5000);
    const rows = (data ?? []).map((t) => [
      t.txn_date ?? "", one(t.property as { address?: string })?.address ?? "", t.type ?? "", t.category ?? "",
      t.amount_net ?? "", t.vat_amount ?? "", t.amount_gross ?? "", t.status ?? "",
    ]);
    return { filename: "financial-transactions.csv", csv: toCsv(["Date", "Property", "Type", "Category", "Net", "VAT", "Gross", "Status"], rows) };
  }

  if (type === "arrears") {
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await supabase
      .from("rent_schedule")
      .select("due_date, amount_due, amount_collected, invoice_status, tenant:tenant_id(full_name), property:property_id(address)")
      .neq("invoice_status", "Paid")
      .lt("due_date", today)
      .order("due_date", { ascending: true })
      .limit(5000);
    const rows = (data ?? []).map((r) => {
      const due = Number(r.amount_due ?? 0);
      const col = Number(r.amount_collected ?? 0);
      return [
        one(r.tenant as { full_name?: string })?.full_name ?? "", one(r.property as { address?: string })?.address ?? "",
        r.due_date ?? "", due.toFixed(2), col.toFixed(2), (due - col).toFixed(2), r.invoice_status ?? "",
      ];
    });
    return { filename: "rent-arrears.csv", csv: toCsv(["Tenant", "Property", "Due date", "Amount due", "Collected", "Outstanding", "Status"], rows) };
  }

  if (type === "compliance") {
    const today = new Date();
    const { data } = await supabase
      .from("certification")
      .select("expiry_date, notes, type:type_id(name), property:property_id(address)")
      .order("expiry_date", { ascending: true })
      .limit(5000);
    const rows = (data ?? []).map((c) => {
      const exp = c.expiry_date ? new Date(c.expiry_date as string) : null;
      const status = !exp ? "No expiry" : exp < today ? "Expired" : "Valid";
      return [
        one(c.type as { name?: string })?.name ?? "", one(c.property as { address?: string })?.address ?? "",
        c.expiry_date ?? "", status,
      ];
    });
    return { filename: "compliance-certificates.csv", csv: toCsv(["Certificate", "Property", "Expiry date", "Status"], rows) };
  }

  if (type === "maintenance") {
    const { data } = await supabase
      .from("maintenance")
      .select("description, status, urgency, planned_date, completion_date, cost, property:property_id(address), staff:assigned_staff_id(full_name), supplier:supplier_id(business_name)")
      .order("created_at", { ascending: false })
      .limit(5000);
    const rows = (data ?? []).map((m) => [
      one(m.property as { address?: string })?.address ?? "", m.description ?? "", m.status ?? "", m.urgency ?? "",
      one(m.staff as { full_name?: string })?.full_name ?? "", one(m.supplier as { business_name?: string })?.business_name ?? "",
      m.cost ?? "", m.planned_date ?? "", m.completion_date ?? "",
    ]);
    return { filename: "maintenance-jobs.csv", csv: toCsv(["Property", "Description", "Status", "Urgency", "Assigned to", "Supplier", "Cost", "Planned", "Completed"], rows) };
  }

  // activity
  const { data } = await supabase
    .from("activity_log")
    .select("type, object_label, created_at, creator:creator_id(full_name)")
    .order("created_at", { ascending: false })
    .limit(5000);
  const rows = (data ?? []).map((a) => [
    a.created_at ?? "", a.type ?? "", a.object_label ?? "", one(a.creator as { full_name?: string })?.full_name ?? "",
  ]);
  return { filename: "activity-log.csv", csv: toCsv(["When", "Type", "Detail", "By"], rows) };
}
