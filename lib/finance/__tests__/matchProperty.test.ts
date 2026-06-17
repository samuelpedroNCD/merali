import { describe, it, expect } from "vitest";
import { matchPropertyByCode } from "../matchProperty";

const props = [
  { id: "p-mc", internal_code: "MC" },        // too short — ignored
  { id: "p-mca1", internal_code: "MC-A1" },
  { id: "p-ol14", internal_code: "OL14" },
];

describe("matchPropertyByCode", () => {
  it("matches a code that appears as a token in the reference", () => {
    expect(matchPropertyByCode("RENT MC-A1 JAN", props)).toBe("p-mca1");
    expect(matchPropertyByCode("transfer ol14 deposit", props)).toBe("p-ol14");
  });

  it("prefers the longest code when several could match", () => {
    expect(matchPropertyByCode("payment MC-A1", props)).toBe("p-mca1"); // not the 2-char MC
  });

  it("ignores codes shorter than 3 chars", () => {
    expect(matchPropertyByCode("MC only", props)).toBeNull();
  });

  it("does not match a code embedded mid-word", () => {
    expect(matchPropertyByCode("SOL14ARIS", props)).toBeNull(); // OL14 inside a word
  });

  it("returns null for empty text or no match", () => {
    expect(matchPropertyByCode("", props)).toBeNull();
    expect(matchPropertyByCode("Tesco Stores", props)).toBeNull();
  });
});
