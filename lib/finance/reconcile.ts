// Pure matching logic for reconciling a bank transaction against expected rent.
// Used by the reconcile action to rank candidate rent_schedule rows.

export type ScheduleCandidate = {
  id: string;
  due_date: string;
  amount_due: number;
  amount_collected: number;
  invoice_status: string;
};

const daysBetween = (a: string, b: string) =>
  Math.abs(
    Math.round((new Date(a).getTime() - new Date(b).getTime()) / 86_400_000),
  );

/**
 * Score how well a schedule row matches a transaction (0 = no match).
 * Amount must be close (±2% or ±£1); date within 21 days scores higher the
 * nearer it is. Already-paid rows are excluded by the caller.
 */
export function scoreMatch(
  txnAmount: number,
  txnDate: string,
  cand: ScheduleCandidate,
): number {
  const outstanding = cand.amount_due - cand.amount_collected;
  const tolerance = Math.max(1, cand.amount_due * 0.02);
  const amountDiff = Math.abs(txnAmount - outstanding);
  if (amountDiff > tolerance) return 0;

  const dateDiff = daysBetween(txnDate, cand.due_date);
  if (dateDiff > 21) return 0;

  const amountScore = 60 * (1 - amountDiff / tolerance); // up to 60
  const dateScore = Math.max(0, 40 - dateDiff * 2); // up to 40
  return Math.round(amountScore + dateScore);
}

/** Rank candidates best-first, dropping non-matches. */
export function rankMatches(
  txnAmount: number,
  txnDate: string,
  candidates: ScheduleCandidate[],
): { candidate: ScheduleCandidate; score: number }[] {
  return candidates
    .map((c) => ({ candidate: c, score: scoreMatch(txnAmount, txnDate, c) }))
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score);
}
