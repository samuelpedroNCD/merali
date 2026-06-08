import { describe, it, expect } from "vitest";
import { generateDueDates } from "../rentSchedule";

describe("generateDueDates", () => {
  it("generates 12 monthly instalments across a one-year lease", () => {
    const dates = generateDueDates("2025-01-01", "2025-12-31", "Monthly");
    expect(dates).toHaveLength(12);
    expect(dates[0]).toBe("2025-01-01");
    expect(dates[11]).toBe("2025-12-01");
  });

  it("generates weekly instalments", () => {
    const dates = generateDueDates("2025-01-01", "2025-01-29", "Weekly");
    expect(dates).toEqual(["2025-01-01", "2025-01-08", "2025-01-15", "2025-01-22", "2025-01-29"]);
  });

  it("handles fortnightly and quarterly", () => {
    expect(generateDueDates("2025-01-01", "2025-02-28", "Fortnightly")).toHaveLength(5);
    expect(generateDueDates("2025-01-01", "2025-12-31", "Quarterly")).toHaveLength(4);
  });

  it("returns empty when no start date", () => {
    expect(generateDueDates(null, "2025-12-31", "Monthly")).toEqual([]);
  });

  it("defaults to 24 periods when no end date", () => {
    const dates = generateDueDates("2025-01-01", null, "Monthly");
    expect(dates.length).toBeGreaterThanOrEqual(24);
  });

  it("never exceeds the 600-row safety cap", () => {
    const dates = generateDueDates("2000-01-01", "2100-01-01", "Weekly");
    expect(dates.length).toBeLessThanOrEqual(600);
  });
});
