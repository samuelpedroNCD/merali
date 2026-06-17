import { describe, it, expect, beforeAll } from "vitest";

// A fixed 32-byte key (base64) so encryption is actually exercised.
beforeAll(() => {
  process.env.DATA_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
});

// Imported after env is set; the module reads the key per-call, so order is safe.
const { encryptField, decryptField, encryptFields } = await import("../secrets");

describe("field encryption", () => {
  it("round-trips a value", () => {
    const ct = encryptField("12345678");
    expect(ct).toMatch(/^enc:v1:/);
    expect(ct).not.toContain("12345678");
    expect(decryptField(ct)).toBe("12345678");
  });

  it("is idempotent — does not double-encrypt", () => {
    const once = encryptField("60-12-34");
    const twice = encryptField(once);
    expect(twice).toBe(once);
    expect(decryptField(twice)).toBe("60-12-34");
  });

  it("passes through null and empty", () => {
    expect(encryptField(null)).toBeNull();
    expect(encryptField("")).toBeNull();
    expect(decryptField(null)).toBeNull();
  });

  it("returns un-prefixed (legacy plaintext) values unchanged on decrypt", () => {
    expect(decryptField("plain text")).toBe("plain text");
  });

  it("encryptFields only touches the named keys", () => {
    const row = { bank_account_number: "999", bank_name: "NatWest", id: "x" };
    const enc = encryptFields(row, ["bank_account_number"]);
    expect(enc.bank_account_number).toMatch(/^enc:v1:/);
    expect(enc.bank_name).toBe("NatWest"); // untouched
    expect(enc.id).toBe("x");
    expect(decryptField(enc.bank_account_number)).toBe("999");
  });
});
