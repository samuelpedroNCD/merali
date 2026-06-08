import { describe, it, expect } from "vitest";
import { effectiveRent } from "../rentSchedule";

describe("effectiveRent (rent reviews / increases)", () => {
  it("returns the base rent when there are no reviews", () => {
    expect(effectiveRent(600, [], "2025-06-01")).toBe(600);
  });

  it("keeps the base rent before the first review's effective date", () => {
    const reviews = [{ effective_date: "2025-07-01", new_amount: 650 }];
    expect(effectiveRent(600, reviews, "2025-06-30")).toBe(600);
  });

  it("applies the review from its effective date onward", () => {
    const reviews = [{ effective_date: "2025-07-01", new_amount: 650 }];
    expect(effectiveRent(600, reviews, "2025-07-01")).toBe(650);
    expect(effectiveRent(600, reviews, "2025-12-01")).toBe(650);
  });

  it("uses the latest applicable review when several exist (out of order input)", () => {
    const reviews = [
      { effective_date: "2026-01-01", new_amount: 700 },
      { effective_date: "2025-07-01", new_amount: 650 },
    ];
    expect(effectiveRent(600, reviews, "2025-06-01")).toBe(600);
    expect(effectiveRent(600, reviews, "2025-09-01")).toBe(650);
    expect(effectiveRent(600, reviews, "2026-02-01")).toBe(700);
  });

  it("coerces string amounts to numbers", () => {
    const reviews = [{ effective_date: "2025-07-01", new_amount: "725.50" as unknown as number }];
    expect(effectiveRent(600, reviews, "2025-08-01")).toBe(725.5);
  });
});
