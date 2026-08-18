import { describe, it, expect } from "vitest";
import { buildNarrative } from "../narrative";

describe("buildNarrative", () => {
  it("uses Rent for a current tenant", () => {
    expect(buildNarrative("Natasha Catwell", "Current")).toBe("Catwell N Rent");
  });

  it("uses Arrears for a former tenant (the observed convention)", () => {
    expect(buildNarrative("Natasha Catwell", "Past")).toBe("Catwell N Arrears");
  });

  it("treats a future tenancy as Rent", () => {
    expect(buildNarrative("Gabriella Joel", "Future")).toBe("Joel G Rent");
  });

  it("takes the last word as surname and first letter as initial", () => {
    expect(buildNarrative("Anthony James Oxley", "Current")).toBe("Oxley A Rent");
  });

  it("handles a single name (no initial)", () => {
    expect(buildNarrative("Cher", "Current")).toBe("Cher Rent");
  });

  it("falls back to just the word when there is no name", () => {
    expect(buildNarrative("", "Past")).toBe("Arrears");
    expect(buildNarrative(null, "Current")).toBe("Rent");
  });
});
