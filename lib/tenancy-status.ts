// Tenancy status derived from its dates (server-free so client + server share it).
// The client wants status to be Current / Past / Future and to update automatically
// from the tenancy dates rather than being set by hand.

export type TenancyStatus = "Current" | "Past" | "Future";

type DateLike = {
  start_date?: string | null;
  commencement_date?: string | null;
  end_date?: string | null;
};

/** Current/Past/Future from the tenancy's commencement (or start) and end dates. */
export function tenancyStatus(l: DateLike, today: string = new Date().toISOString().slice(0, 10)): TenancyStatus {
  const start = l.commencement_date || l.start_date || null;
  if (start && start > today) return "Future";
  if (l.end_date && l.end_date < today) return "Past";
  return "Current";
}

/** Map the derived status onto the stored lease.status vocabulary (kept for backend logic). */
export function statusToStored(s: TenancyStatus): string {
  return s === "Current" ? "Active" : s === "Future" ? "Pending" : "Ended";
}

/** Badge tone for the derived status. */
export function tenancyStatusTone(s: TenancyStatus): "good" | "warn" | "muted" {
  return s === "Current" ? "good" : s === "Future" ? "warn" : "muted";
}
