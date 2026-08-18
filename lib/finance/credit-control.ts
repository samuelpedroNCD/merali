// WS14 — Credit control cadence.
//
// Pure decision so it is unit-testable: first chase once arrears are 7 days
// overdue, then weekly. The daily cron (lib/notifications runner) applies it.

const DAY = 86_400_000;
export const FIRST_CHASE_DAYS = 7;
export const CHASE_INTERVAL_DAYS = 7;

/**
 * Should a tenancy be chased now?
 * - Never chased: yes once arrears are >= 7 days overdue.
 * - Chased before: yes once >= 7 days since the last chase.
 * Returns false while under the 7-day threshold, or if never overdue.
 */
export function shouldChase(daysOverdue: number, lastChasedAt: string | null, now: Date = new Date()): boolean {
  if (daysOverdue < FIRST_CHASE_DAYS) return false;
  if (!lastChasedAt) return true;
  const sinceLast = (now.getTime() - new Date(lastChasedAt).getTime()) / DAY;
  return sinceLast >= CHASE_INTERVAL_DAYS;
}

/** Whole days between a past date and now (floored, never negative). */
export function daysOverdue(dueDate: string, now: Date = new Date()): number {
  const d = Math.floor((now.getTime() - new Date(dueDate).getTime()) / DAY);
  return d > 0 ? d : 0;
}
