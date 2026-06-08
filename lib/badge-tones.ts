// Single source of truth for status → badge-tone mappings. Previously these were
// duplicated as inline `statusTone` helpers across ~8 client components with subtly
// different rules; centralising them removes drift. Constants/pure-function module —
// safe to import from client components.
import type { Tone } from "@/components/ui/badge";

const norm = (s?: string | null) => (s ?? "").toLowerCase().trim();

/** Property status: Occupied / Vacant / Under maintenance / Unavailable. */
export function propertyStatusTone(s?: string | null): Tone {
  const v = norm(s);
  if (v === "occupied") return "good";
  if (v === "vacant") return "warn";
  if (v.includes("maintenance") || v === "unavailable") return "bad";
  return "muted";
}

/** Tenant status: Active / Prospective / Past. */
export function tenantStatusTone(s?: string | null): Tone {
  const v = norm(s);
  if (v === "active") return "good";
  if (v === "prospective") return "warn";
  return "muted";
}

/** Lease/tenancy status: Active / Pending / Renewed / Terminated / Expired / Ended. */
export function leaseStatusTone(s?: string | null): Tone {
  const v = norm(s);
  if (v === "active") return "good";
  if (v === "pending" || v === "renewed") return "warn";
  if (v === "terminated" || v === "expired" || v === "ended") return "bad";
  return "muted";
}

/** Key status: In office / Out / Lost / Returned. */
export function keyStatusTone(s?: string | null): Tone {
  const v = norm(s);
  if (v === "in office" || v === "returned") return "good";
  if (v === "out") return "warn";
  if (v === "lost") return "bad";
  return "muted";
}

/** Invoice / rent-schedule status: Paid / Pending / Partial / Overdue. */
export function invoiceStatusTone(s?: string | null): Tone {
  const v = norm(s);
  if (v === "paid") return "good";
  if (v === "pending" || v === "partial") return "warn";
  if (v === "overdue") return "bad";
  return "muted";
}

/** Supplier status: Active / Preferred (good) else neutral. */
export function supplierStatusTone(s?: string | null): Tone {
  const v = norm(s);
  if (v === "active" || v === "preferred") return "good";
  if (v === "inactive" || v === "blocked") return "bad";
  return "muted";
}

/** Reminder status: Completed (good) / Sent (neutral) / Pending (warn). */
export function reminderStatusTone(s?: string | null): Tone {
  const v = norm(s);
  if (v === "completed") return "good";
  if (v === "sent") return "muted";
  return "warn";
}

/** Maintenance urgency: Emergency / High / Medium / Low. */
export function urgencyTone(u?: string | null): Tone {
  const v = norm(u);
  if (v === "emergency" || v === "high") return "bad";
  if (v === "medium") return "warn";
  return "muted";
}

/** Generic mapper for mixed-entity contexts (e.g. the property detail tabs). */
export function genericStatusTone(s?: string | null): Tone {
  const v = norm(s);
  if (v === "occupied" || v === "active" || v === "in office" || v === "paid" || v === "returned") return "good";
  if (v === "vacant" || v === "out" || v === "pending" || v === "partial") return "warn";
  if (v.includes("maintenance") || v === "unavailable" || v === "lost" || v === "overdue" || v === "expired") return "bad";
  return "muted";
}
