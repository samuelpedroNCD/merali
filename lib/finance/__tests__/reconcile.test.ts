import { describe, it, expect } from "vitest";
import { scoreMatch, rankMatches, applyPayment, type ScheduleCandidate } from "../reconcile";

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

describe("scoreMatch reference bonus", () => {
  it("ranks an instalment higher when the reference names its property code", () => {
    const withCode = cand({ id: "a", property_code: "MC-A1" });
    const plain = cand({ id: "b" });
    const ref = "RENT MC-A1 J SMITH";
    expect(scoreMatch(600, "2025-02-01", withCode, ref)).toBeGreaterThan(
      scoreMatch(600, "2025-02-01", plain, ref),
    );
  });

  it("boosts on the tenant surname", () => {
    const c = cand({ tenant_name: "Jane Smith", property_code: "MC-A1" });
    expect(scoreMatch(600, "2025-02-01", c, "FP SMITH MC-A1")).toBeGreaterThan(
      scoreMatch(600, "2025-02-01", cand(), "FP SMITH MC-A1"),
    );
  });

  it("ignores codes shorter than 3 chars and mid-word matches", () => {
    expect(scoreMatch(600, "2025-02-01", cand({ property_code: "AB" }), "RENT ABCD")).toBe(
      scoreMatch(600, "2025-02-01", cand(), "RENT ABCD"),
    );
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

  it("uses the reference to break a tie between equal amount/date candidates", () => {
    const ranked = rankMatches(600, "2025-02-01", [
      cand({ id: "other" }),
      cand({ id: "mine", property_code: "MC-B" }),
    ], "BACS MC-B");
    expect(ranked[0].candidate.id).toBe("mine");
  });
});

describe("applyPayment", () => {
  it("marks Paid when the payment covers the amount due", () => {
    expect(applyPayment(600, 0, 600)).toEqual({ collected: 600, status: "Paid" });
  });

  it("marks Partial when under the amount due", () => {
    expect(applyPayment(600, 0, 400)).toEqual({ collected: 400, status: "Partial" });
  });

  it("accumulates onto what's already collected and settles the remainder", () => {
    expect(applyPayment(600, 400, 200)).toEqual({ collected: 600, status: "Paid" });
  });

  it("treats a near-full payment within tolerance as Paid", () => {
    // £600 due → ±£12 tolerance; £590 is within it.
    expect(applyPayment(600, 0, 590)).toEqual({ collected: 590, status: "Paid" });
  });

  it("records an overpayment as Paid (collected exceeds due)", () => {
    expect(applyPayment(600, 0, 650)).toEqual({ collected: 650, status: "Paid" });
  });
});
