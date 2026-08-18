import { describe, it, expect } from "vitest";
import { buildTransactionJournal, type TxnForJournal, type ControlNominals } from "../journal";

const ctrl: ControlNominals = {
  suspenseId: "SUS",
  vatControlId: "VAT",
  uncatIncomeId: "UINC",
  uncatExpenseId: "UEXP",
  bankControlId: "BANK",
};

const txn = (over: Partial<TxnForJournal>): TxnForJournal => ({
  type: "Income",
  amount_gross: 100,
  amount_net: 100,
  nominal_code_id: "NOM",
  property_id: null,
  lease_id: null,
  landlord_id: null,
  bank_account_id: "acc",
  ...over,
});

const sum = (lines: { debit: number; credit: number }[]) => ({
  debit: lines.reduce((a, l) => a + l.debit, 0),
  credit: lines.reduce((a, l) => a + l.credit, 0),
});

describe("buildTransactionJournal — balance", () => {
  it("income with 20% VAT balances (Dr bank gross, Cr nominal net, Cr VAT)", () => {
    const lines = buildTransactionJournal(txn({ amount_gross: 120, amount_net: 100 }), ctrl);
    expect(sum(lines)).toEqual({ debit: 120, credit: 120 });
    expect(lines.find((l) => l.nominal_code_id === "BANK")?.debit).toBe(120);
    expect(lines.find((l) => l.nominal_code_id === "NOM")?.credit).toBe(100);
    expect(lines.find((l) => l.nominal_code_id === "VAT")?.credit).toBe(20);
  });

  it("expense with 20% VAT balances (Dr nominal net, Dr VAT, Cr bank gross)", () => {
    const lines = buildTransactionJournal(txn({ type: "Expense", amount_gross: 120, amount_net: 100 }), ctrl);
    expect(sum(lines)).toEqual({ debit: 120, credit: 120 });
    expect(lines.find((l) => l.nominal_code_id === "NOM")?.debit).toBe(100);
    expect(lines.find((l) => l.nominal_code_id === "VAT")?.debit).toBe(20);
    expect(lines.find((l) => l.nominal_code_id === "BANK")?.credit).toBe(120);
  });

  it("5% VAT balances", () => {
    const lines = buildTransactionJournal(txn({ type: "Expense", amount_gross: 105, amount_net: 100 }), ctrl);
    expect(sum(lines)).toEqual({ debit: 105, credit: 105 });
    expect(lines.find((l) => l.nominal_code_id === "VAT")?.debit).toBe(5);
  });

  it("zero-VAT collapses the VAT line and still balances", () => {
    const lines = buildTransactionJournal(txn({ amount_gross: 100, amount_net: 100 }), ctrl);
    expect(lines.some((l) => l.nominal_code_id === "VAT")).toBe(false);
    expect(sum(lines)).toEqual({ debit: 100, credit: 100 });
    expect(lines).toHaveLength(2);
  });

  it("tax-only (net 0) posts only bank + VAT and balances", () => {
    const lines = buildTransactionJournal(txn({ type: "Expense", amount_gross: 40, amount_net: 0 }), ctrl);
    expect(lines.some((l) => l.nominal_code_id === "NOM")).toBe(false);
    expect(sum(lines)).toEqual({ debit: 40, credit: 40 });
    expect(lines.find((l) => l.nominal_code_id === "VAT")?.debit).toBe(40);
  });
});

describe("buildTransactionJournal — fallbacks", () => {
  it("no bank account → bank side posts to Suspense", () => {
    const lines = buildTransactionJournal(txn({ bank_account_id: null }), { ...ctrl, bankControlId: null });
    expect(lines.find((l) => l.debit === 100)?.nominal_code_id).toBe("SUS");
  });

  it("no nominal, income → Uncategorised income", () => {
    const lines = buildTransactionJournal(txn({ nominal_code_id: null }), ctrl);
    expect(lines.find((l) => l.credit === 100)?.nominal_code_id).toBe("UINC");
  });

  it("no nominal, expense → Uncategorised expense", () => {
    const lines = buildTransactionJournal(txn({ type: "Expense", nominal_code_id: null }), ctrl);
    expect(lines.find((l) => l.debit === 100)?.nominal_code_id).toBe("UEXP");
  });

  it("gross 0 → no journal", () => {
    expect(buildTransactionJournal(txn({ amount_gross: 0 }), ctrl)).toEqual([]);
  });

  it("net greater than gross (bad data) is clamped and still balances", () => {
    const lines = buildTransactionJournal(txn({ amount_gross: 100, amount_net: 130 }), ctrl);
    expect(sum(lines)).toEqual({ debit: 100, credit: 100 });
  });
});

describe("trial balance over many entries sums to zero", () => {
  it("a mixed set of entries nets to debit = credit overall", () => {
    const all = [
      buildTransactionJournal(txn({ amount_gross: 120, amount_net: 100 }), ctrl),
      buildTransactionJournal(txn({ type: "Expense", amount_gross: 63.33, amount_net: 63.33 }), ctrl),
      buildTransactionJournal(txn({ type: "Expense", amount_gross: 105, amount_net: 100 }), ctrl),
      buildTransactionJournal(txn({ nominal_code_id: null, bank_account_id: null, amount_gross: 30, amount_net: 30 }), { ...ctrl, bankControlId: null }),
    ].flat();
    const { debit, credit } = sum(all);
    expect(Math.round((debit - credit) * 100)).toBe(0);
  });
});
