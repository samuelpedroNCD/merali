import { describe, it, expect } from "vitest";
import { shouldChase, daysOverdue } from "../credit-control";

const now = new Date("2026-08-20T08:00:00Z");

describe("shouldChase", () => {
  it("does not chase under 7 days overdue", () => {
    expect(shouldChase(6, null, now)).toBe(false);
    expect(shouldChase(0, null, now)).toBe(false);
  });

  it("sends a first chase at exactly 7 days overdue when never chased", () => {
    expect(shouldChase(7, null, now)).toBe(true);
    expect(shouldChase(40, null, now)).toBe(true);
  });

  it("does not re-chase within a week of the last chase", () => {
    const threeDaysAgo = new Date(now.getTime() - 3 * 86400000).toISOString();
    expect(shouldChase(40, threeDaysAgo, now)).toBe(false);
  });

  it("re-chases once a week has passed", () => {
    const eightDaysAgo = new Date(now.getTime() - 8 * 86400000).toISOString();
    expect(shouldChase(40, eightDaysAgo, now)).toBe(true);
  });

  it("never chases when not overdue, even if a stale chase exists", () => {
    const longAgo = new Date(now.getTime() - 60 * 86400000).toISOString();
    expect(shouldChase(0, longAgo, now)).toBe(false);
  });
});

describe("daysOverdue", () => {
  it("counts whole days since the due date", () => {
    expect(daysOverdue("2026-08-13", now)).toBe(7);
  });
  it("is 0 for a future or today due date", () => {
    expect(daysOverdue("2026-08-25", now)).toBe(0);
    expect(daysOverdue("2026-08-20", now)).toBe(0);
  });
});
