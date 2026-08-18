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

// Escalating chase stage from how many chases have already gone out.
export type ChaseStage = 1 | 2 | 3;
export function chaseStage(priorChases: number): ChaseStage {
  if (priorChases <= 0) return 1; // first reminder
  if (priorChases < 4) return 2;  // weekly follow-up
  return 3;                        // final notice (~4+ weeks)
}

export type ChaseFields = {
  tenant: string | null;
  property: string | null;
  amount: string;   // pre-formatted, e.g. "£1,200.00"
  dueDate: string;  // pre-formatted, e.g. "30 Jun 2026"
  contact: string | null; // reply-to email / phone, if configured
};

/**
 * The tenant arrears reminder for a given stage (approved copy). Tone is
 * deliberately measured and always offers a contact + error-check route.
 * Pure and testable; the caller pre-formats amount/date.
 */
export function buildChaseEmail(stage: ChaseStage, f: ChaseFields): { subject: string; html: string } {
  const who = f.tenant ?? "there";
  const where = f.property ?? "your tenancy";
  const at = f.contact ? ` at <strong>${f.contact}</strong>` : ""; // leading space when present
  const p = (s: string) => `<p>${s}</p>`;
  const sign = p("Kind regards,<br/>Merali Lettings");

  if (stage === 1) {
    return {
      subject: `Rent payment reminder — ${where}`,
      html:
        p(`Dear ${who},`) +
        p(`We're writing about the rent for your tenancy at <strong>${where}</strong>. Our records show an outstanding balance of <strong>${f.amount}</strong>, with the earliest unpaid amount having been due on <strong>${f.dueDate}</strong>.`) +
        p(`This is just a friendly reminder — if you've made this payment in the last few days, please disregard this message, and thank you.`) +
        p(`Otherwise, we'd be grateful if you could arrange payment at your earliest convenience. If you're having any difficulty, or you think this balance isn't right, please get in touch${at} and we'll be glad to help.`) +
        sign,
    };
  }
  if (stage === 2) {
    return {
      subject: `Overdue rent — action needed for ${where}`,
      html:
        p(`Dear ${who},`) +
        p(`We recently reminded you about the outstanding rent on your tenancy at <strong>${where}</strong>. As of today, <strong>${f.amount}</strong> remains unpaid, with the earliest amount due on <strong>${f.dueDate}</strong>.`) +
        p(`Please arrange payment as soon as possible. If you're experiencing financial difficulty, it's important that you get in touch${at} — we may be able to agree a payment arrangement, and keeping us informed helps avoid the matter escalating.`) +
        p(`If you believe this balance is incorrect, please let us know straight away so we can look into it.`) +
        sign,
    };
  }
  return {
    subject: `Important: overdue rent on your tenancy at ${where}`,
    html:
      p(`Dear ${who},`) +
      p(`Despite our previous reminders, <strong>${f.amount}</strong> of rent remains outstanding on your tenancy at <strong>${where}</strong>, the earliest having been due on <strong>${f.dueDate}</strong>.`) +
      p(`We now ask that you bring your account up to date without further delay. If payment is not made and we do not hear from you, your account may be referred for further action in line with your tenancy agreement.`) +
      p(`If you are struggling to pay, please get in touch${at} — we would far rather work with you to find a solution. And if you believe this balance is wrong, tell us right away so we can review it.`) +
      sign,
  };
}
