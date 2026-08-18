import { describe, it, expect } from "vitest";
import { shouldChase, daysOverdue, chaseStage, buildChaseEmail } from "../credit-control";

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

describe("chaseStage", () => {
  it("escalates first → follow-up → final by prior-chase count", () => {
    expect(chaseStage(0)).toBe(1);
    expect(chaseStage(1)).toBe(2);
    expect(chaseStage(3)).toBe(2);
    expect(chaseStage(4)).toBe(3);
    expect(chaseStage(10)).toBe(3);
  });
});

describe("buildChaseEmail", () => {
  const f = { tenant: "Jane Smith", property: "12 Oak Rd", amount: "£1,200.00", dueDate: "30 Jun 2026", contact: "arrears@merali.co.uk" };

  it("uses a distinct subject per stage and includes the amount", () => {
    const s1 = buildChaseEmail(1, f);
    const s2 = buildChaseEmail(2, f);
    const s3 = buildChaseEmail(3, f);
    expect(s1.subject).not.toBe(s2.subject);
    expect(s2.subject).not.toBe(s3.subject);
    expect(s1.html).toContain("£1,200.00");
    expect(s1.html).toContain("12 Oak Rd");
    expect(s3.subject.toLowerCase()).toContain("important");
  });

  it("gracefully handles a missing contact and tenant name", () => {
    const e = buildChaseEmail(2, { tenant: null, property: null, amount: "£50.00", dueDate: "1 Jul 2026", contact: null });
    expect(e.html).toContain("Dear there");
    expect(e.html).toContain("get in touch —"); // no address → no dangling "at"
    expect(e.html).not.toContain("undefined");
  });

  it("includes the contact address when configured", () => {
    const e = buildChaseEmail(1, { tenant: "A", property: "B", amount: "£1", dueDate: "x", contact: "arrears@merali.co.uk" });
    expect(e.html).toContain("at <strong>arrears@merali.co.uk</strong>");
  });
});
