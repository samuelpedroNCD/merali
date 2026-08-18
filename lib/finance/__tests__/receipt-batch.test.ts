import { describe, it, expect } from "vitest";
import { batchTotals } from "../receipt-batch";

describe("batchTotals", () => {
  it("sums the receipts as a running total", () => {
    const t = batchTotals([{ amount_gross: 2699.16 }, { amount_gross: 2800 }, { amount_gross: 1615 }], null);
    expect(t.total).toBe(7114.16);
    expect(t.count).toBe(3);
    expect(t.leftToApply).toBeNull();
  });

  it("computes left-to-apply against an expected total", () => {
    const t = batchTotals([{ amount_gross: 2699.16 }, { amount_gross: 2800 }], 7114.16);
    expect(t.total).toBe(5499.16);
    expect(t.leftToApply).toBe(1615);
  });

  it("goes negative when over-applied", () => {
    const t = batchTotals([{ amount_gross: 100 }], 60);
    expect(t.leftToApply).toBe(-40);
  });

  it("handles an empty batch and null amounts", () => {
    expect(batchTotals([], 500)).toEqual({ total: 0, count: 0, leftToApply: 500 });
    expect(batchTotals([{ amount_gross: null }], null).total).toBe(0);
  });
});
