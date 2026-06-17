import { describe, it, expect } from "vitest";
import { computeDueDates } from "../dueDates";

describe("computeDueDates", () => {
  it("monthly in advance anchors on the day of month", () => {
    const due = computeDueDates({ start: "2025-01-15", end: "2025-04-15", frequency: "Monthly", timing: "Advance", dueDom: 15 });
    expect(due).toEqual(["2025-01-15", "2025-02-15", "2025-03-15", "2025-04-15"]);
  });

  it("monthly in arrears falls on the last day of each period", () => {
    const due = computeDueDates({ start: "2025-01-01", end: "2025-03-31", frequency: "Monthly", timing: "Arrears", dueDom: 1 });
    expect(due).toEqual(["2025-01-31", "2025-02-28", "2025-03-31"]);
  });

  it("clamps the day of month to short months", () => {
    const due = computeDueDates({ start: "2025-01-31", end: "2025-03-31", frequency: "Monthly", timing: "Advance", dueDom: 31 });
    expect(due).toEqual(["2025-01-31", "2025-02-28", "2025-03-31"]);
  });

  it("weekly anchors on the chosen weekday", () => {
    // 1 (Monday). 2025-01-06 is a Monday.
    const due = computeDueDates({ start: "2025-01-01", end: "2025-01-27", frequency: "Weekly", timing: "Advance", dueWeekday: 1 });
    expect(due).toEqual(["2025-01-06", "2025-01-13", "2025-01-20", "2025-01-27"]);
  });

  it("quarterly uses English quarter days", () => {
    const due = computeDueDates({ start: "2025-01-01", end: "2025-12-31", frequency: "Quarterly", timing: "Advance", quarterType: "English" });
    expect(due).toEqual(["2025-03-25", "2025-06-24", "2025-09-29", "2025-12-25"]);
  });

  it("quarterly uses calendar quarters", () => {
    const due = computeDueDates({ start: "2025-01-01", end: "2025-12-31", frequency: "Quarterly", timing: "Advance", quarterType: "Calendar" });
    expect(due).toEqual(["2025-01-01", "2025-04-01", "2025-07-01", "2025-10-01"]);
  });

  it("annually steps by year", () => {
    const due = computeDueDates({ start: "2025-06-01", end: "2027-06-30", frequency: "Annually", timing: "Advance", dueDom: 1 });
    expect(due).toEqual(["2025-06-01", "2026-06-01", "2027-06-01"]);
  });

  it("custom uses the explicit dates within the term", () => {
    const due = computeDueDates({ start: "2025-01-01", end: "2025-12-31", frequency: "Custom", customDates: ["2025-03-10", "2024-12-01", "2025-09-09"] });
    expect(due).toEqual(["2025-03-10", "2025-09-09"]); // 2024 date excluded
  });

  it("open-ended monthly generates the horizon then stops", () => {
    const due = computeDueDates({ start: "2025-01-10", end: null, frequency: "Monthly", timing: "Advance", dueDom: 10, horizon: 6 });
    expect(due.length).toBeGreaterThanOrEqual(6);
    expect(due[0]).toBe("2025-01-10");
  });
});
