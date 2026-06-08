import { describe, it, expect } from "vitest";
import { scoreMatch, rankMatches, type ScheduleCandidate } from "../reconcile";

const cand = (over: Partial<ScheduleCandidate> = {}): ScheduleCandidate => ({
  id: "x",
  due_date: "2025-02-01",
  amount_due: 600,
  amount_collected: 0,
  invoice_status: "Pending",
  ...over,
});

describe("scoreMatch", () => {
  it("scores an exact amount + close date highly", () => {
    expect(scoreMatch(600, "2025-02-02", cand())).toBeGreaterThanOrEqual(90);
  });

  it("returns 0 when the amount is outside tolerance", () => {
    expect(scoreMatch(700, "2025-02-01", cand())).toBe(0);
  });

  it("returns 0 when the date is more than 21 days away", () => {
    expect(scoreMatch(600, "2025-04-01", cand())).toBe(0);
  });

  it("matches against the outstanding balance, not the full due", () => {
    // £300 already collected → £300 outstanding; a £300 payment should match.
    expect(scoreMatch(300, "2025-02-01", cand({ amount_collected: 300 }))).toBeGreaterThan(0);
    expect(scoreMatch(600, "2025-02-01", cand({ amount_collected: 300 }))).toBe(0);
  });
});

describe("rankMatches", () => {
  it("ranks the closest candidate first and drops non-matches", () => {
    const ranked = rankMatches(600, "2025-02-01", [
      cand({ id: "far", due_date: "2025-02-18" }),
      cand({ id: "near", due_date: "2025-02-01" }),
      cand({ id: "wrong", amount_due: 999, due_date: "2025-02-01" }),
    ]);
    expect(ranked[0].candidate.id).toBe("near");
    expect(ranked.some((m) => m.candidate.id === "wrong")).toBe(false);
  });
});
