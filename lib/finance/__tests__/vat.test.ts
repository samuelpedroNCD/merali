import { describe, it, expect } from "vitest";
import { computeVatFromGross } from "../vat";

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
