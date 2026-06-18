// Pure matching logic for reconciling a bank transaction against expected rent.
// Used by the reconcile action to rank candidate rent_schedule rows.

export type ScheduleCandidate = {
  id: string;
  due_date: string;
  amount_due: number;
  amount_collected: number;
  invoice_status: string;
  // Optional identifiers used to boost the score when the bank reference text
  // mentions them (e.g. a property code or the tenant's surname).
  tenant_name?: string | null;
  property_code?: string | null;
};

const daysBetween = (a: string, b: string) =>
  Math.abs(
    Math.round((new Date(a).getTime() - new Date(b).getTime()) / 86_400_000),
  );

/** Payment tolerance for an instalment: ±2% of the amount due, min ±£1. */
export const paymentTolerance = (amountDue: number) => Math.max(1, amountDue * 0.02);

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// True if `needle` appears in `text` on token boundaries (not mid-word).
function mentions(text: string, needle: string | null | undefined): boolean {
  const n = (needle ?? "").trim().toLowerCase();
  if (n.length < 3) return false;
  return new RegExp(`(^|[^a-z0-9])${esc(n)}([^a-z0-9]|$)`, "i").test(text.toLowerCase());
}

// Bonus (0–30) when the reference names this candidate's property code or
// tenant surname — helps disambiguate same-amount instalments.
function referenceBonus(reference: string | null | undefined, cand: ScheduleCandidate): number {
  if (!reference) return 0;
  let bonus = 0;
  if (mentions(reference, cand.property_code)) bonus += 20;
  const surname = (cand.tenant_name ?? "").trim().split(/\s+/).pop();
  if (mentions(reference, surname)) bonus += 15;
  return bonus;
}

/**
 * Score how well a schedule row matches a transaction (0 = no match).
 * Amount must be close (±2% or ±£1); date within 21 days scores higher the
 * nearer it is. Amount+date max at 100; a matching reference (property code /
 * tenant surname) adds a bonus on top so it can break ties between otherwise
 * identical instalments. Already-paid rows are excluded by the caller. The UI
 * caps the displayed percentage at 100 (`displayScore`).
 */
export function scoreMatch(
  txnAmount: number,
  txnDate: string,
  cand: ScheduleCandidate,
  reference?: string | null,
): number {
  const outstanding = cand.amount_due - cand.amount_collected;
  const tolerance = paymentTolerance(cand.amount_due);
  const amountDiff = Math.abs(txnAmount - outstanding);
  if (amountDiff > tolerance) return 0;

  const dateDiff = daysBetween(txnDate, cand.due_date);
  if (dateDiff > 21) return 0;

  const amountScore = 60 * (1 - amountDiff / tolerance); // up to 60
  const dateScore = Math.max(0, 40 - dateDiff * 2); // up to 40
  return Math.round(amountScore + dateScore) + referenceBonus(reference, cand);
}

/** Percentage shown in the UI (raw score capped at 100). */
export const displayScore = (score: number) => Math.min(100, score);

/** Rank candidates best-first, dropping non-matches. */
export function rankMatches(
  txnAmount: number,
  txnDate: string,
  candidates: ScheduleCandidate[],
  reference?: string | null,
): { candidate: ScheduleCandidate; score: number }[] {
  return candidates
    .map((c) => ({ candidate: c, score: scoreMatch(txnAmount, txnDate, c, reference) }))
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score);
}

export type PaymentOutcome = { collected: number; status: "Paid" | "Partial" };

/**
 * Apply a payment to an instalment: accumulate onto what's already collected,
 * and decide the resulting status. Fully covered (within tolerance) → Paid,
 * otherwise → Partial. Used by both manual reconcile and Plaid auto-reconcile
 * so a part-payment is recorded honestly instead of marking the line fully Paid.
 */
export function applyPayment(amountDue: number, prevCollected: number, txnAmount: number): PaymentOutcome {
  const collected = +(prevCollected + txnAmount).toFixed(2);
  const status: PaymentOutcome["status"] =
    collected + paymentTolerance(amountDue) >= amountDue ? "Paid" : "Partial";
  return { collected, status };
}
