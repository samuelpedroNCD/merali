import { describe, it, expect } from "vitest";
import { computeVatFromGross, computeVatReturn, type VatReturnLine } from "../vat";

describe("computeVatFromGross", () => {
  it("splits a gross amount at 20%", () => {
    const r = computeVatFromGross(600, 20);
    expect(r.net).toBe(500);
    expect(r.vat).toBe(100);
    expect(r.gross).toBe(600);
  });

  it("splits at 5%", () => {
    const r = computeVatFromGross(105, 5);
    expect(r.net).toBe(100);
    expect(r.vat).toBe(5);
  });

  it("net equals gross at 0%", () => {
    const r = computeVatFromGross(250, 0);
    expect(r.net).toBe(250);
    expect(r.vat).toBe(0);
  });

  it("rounds to 2 dp", () => {
    const r = computeVatFromGross(99.99, 20);
    expect(r.net + r.vat).toBeCloseTo(99.99, 2);
  });
});

describe("computeVatReturn", () => {
  const line = (o: Partial<VatReturnLine>): VatReturnLine => ({ is_vat_control: false, nominal_class: null, debit: 0, credit: 0, ...o });

  it("computes output/input/net VAT and sales/purchases", () => {
    // Income £600+£120 VAT: Dr bank 720, Cr rent(Income) 600, Cr VAT 120.
    // Expense £100+£20 VAT: Dr repairs(Expense) 100, Dr VAT 20, Cr bank 120.
    const r = computeVatReturn([
      line({ nominal_class: "Income", credit: 600 }),
      line({ is_vat_control: true, credit: 120 }),
      line({ nominal_class: "Expense", debit: 100 }),
      line({ is_vat_control: true, debit: 20 }),
    ]);
    expect(r.box1).toBe(120); // output VAT
    expect(r.box4).toBe(20);  // input VAT
    expect(r.box5).toBe(100); // net payable
    expect(r.box6).toBe(600); // sales ex VAT
    expect(r.box7).toBe(100); // purchases ex VAT
  });

  it("a tax-only expense lands in Box 4 with Box 7 = 0", () => {
    // Parking VAT £40, no net: Dr suspense 40, Dr VAT 40? no — net 0 so only VAT + bank.
    const r = computeVatReturn([
      line({ is_vat_control: true, debit: 40 }),
      line({ nominal_class: "Asset", credit: 40 }), // bank/suspense side
    ]);
    expect(r.box4).toBe(40);
    expect(r.box7).toBe(0);
    expect(r.box5).toBe(-40); // reclaim
  });

  it("ignores balance-sheet nominals in the net boxes", () => {
    const r = computeVatReturn([line({ nominal_class: "Asset", debit: 500 }), line({ nominal_class: "Liability", credit: 500 })]);
    expect(r.box6).toBe(0);
    expect(r.box7).toBe(0);
  });
});
