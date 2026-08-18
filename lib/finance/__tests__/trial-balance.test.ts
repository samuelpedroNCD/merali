import { describe, it, expect } from "vitest";
import { aggregateTrialBalance, type TBInputLine } from "../trial-balance";

const line = (over: Partial<TBInputLine>): TBInputLine => ({
  nominal_id: "n1",
  code: "4000",
  name: "Rent received",
  nominal_class: "Income",
  debit: 0,
  credit: 0,
  ...over,
});

describe("aggregateTrialBalance", () => {
  it("nets a full ledger to a balanced trial balance", () => {
    // Dr bank 120 / Cr rent 100 / Cr VAT 20  (one income entry)
    const tb = aggregateTrialBalance([
      line({ nominal_id: "bank", code: "1200", name: "Bank", nominal_class: "Asset", debit: 120 }),
      line({ nominal_id: "rent", code: "4000", name: "Rent", nominal_class: "Income", credit: 100 }),
      line({ nominal_id: "vat", code: "2200", name: "VAT", nominal_class: "Liability", credit: 20 }),
    ]);
    expect(tb.balanced).toBe(true);
    expect(tb.totalDebit).toBe(120);
    expect(tb.totalCredit).toBe(120);
  });

  it("sums multiple lines per nominal and shows the net side", () => {
    const tb = aggregateTrialBalance([
      line({ nominal_id: "bank", code: "1200", name: "Bank", nominal_class: "Asset", debit: 120 }),
      line({ nominal_id: "bank", code: "1200", name: "Bank", nominal_class: "Asset", credit: 50 }),
      line({ nominal_id: "rent", code: "4000", name: "Rent", nominal_class: "Income", credit: 70 }),
    ]);
    const bank = tb.rows.find((r) => r.nominal_id === "bank")!;
    expect(bank.debit).toBe(70); // 120 − 50
    expect(bank.credit).toBe(0);
    expect(tb.balanced).toBe(true);
  });

  it("drops net-zero accounts", () => {
    const tb = aggregateTrialBalance([
      line({ nominal_id: "x", code: "9998", name: "Suspense", nominal_class: "Asset", debit: 30 }),
      line({ nominal_id: "x", code: "9998", name: "Suspense", nominal_class: "Asset", credit: 30 }),
      line({ nominal_id: "y", code: "4000", name: "Rent", nominal_class: "Income", credit: 30 }),
      line({ nominal_id: "z", code: "1200", name: "Bank", nominal_class: "Asset", debit: 30 }),
    ]);
    expect(tb.rows.some((r) => r.nominal_id === "x")).toBe(false);
    expect(tb.balanced).toBe(true);
  });

  it("orders rows by nominal code", () => {
    const tb = aggregateTrialBalance([
      line({ nominal_id: "b", code: "5000", name: "Repairs", nominal_class: "Expense", debit: 10 }),
      line({ nominal_id: "a", code: "1200", name: "Bank", nominal_class: "Asset", credit: 10 }),
    ]);
    expect(tb.rows.map((r) => r.code)).toEqual(["1200", "5000"]);
  });

  it("a filtered/activity view need not balance", () => {
    // Only the rent side of an entry (as a per-landlord activity slice)
    const tb = aggregateTrialBalance([
      line({ nominal_id: "rent", code: "4000", name: "Rent", nominal_class: "Income", credit: 100 }),
    ]);
    expect(tb.balanced).toBe(false);
    expect(tb.totalCredit).toBe(100);
  });
});
