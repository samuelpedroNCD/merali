// Application-level field encryption for sensitive data (bank details, Plaid
// tokens, guarantor/next-of-kin PII). SERVER-ONLY — never import from a client
// component (it reads the key from the server env via node:crypto).
//
// AES-256-GCM. Key in env DATA_ENCRYPTION_KEY (32 bytes, base64 —
// `openssl rand -base64 32`). Ciphertext is stored as a string:
//   enc:v1:<iv b64>:<tag b64>:<ciphertext b64>
//
// Design notes:
//  - Idempotent: encryptField() leaves an already-encrypted value untouched.
//  - Graceful reads: decryptField() returns the input unchanged unless it has
//    the enc:v1: prefix, so legacy/un-migrated plaintext rows read fine.
//  - Dev fallback: if the key is absent/invalid, encrypt is a no-op (stores
//    plaintext) with a one-time warning, so local dev works. PROD MUST set the key.

import crypto from "node:crypto";

const PREFIX = "enc:v1:";

function getKey(): Buffer | null {
  const b64 = process.env.DATA_ENCRYPTION_KEY;
  if (!b64) return null;
  try {
    const key = Buffer.from(b64, "base64");
    return key.length === 32 ? key : null;
  } catch {
    return null;
  }
}

let warned = false;
function warnNoKey() {
  if (!warned) {
    warned = true;
    console.warn(
      "[secrets] DATA_ENCRYPTION_KEY is not set or not 32 bytes — sensitive fields are NOT encrypted. Set it in production.",
    );
  }
}

/** Encrypt a string. Null/empty pass through; already-encrypted values are returned as-is. */
export function encryptField(value: string | null | undefined): string | null {
  if (value == null || value === "") return null;
  if (value.startsWith(PREFIX)) return value; // idempotent
  const key = getKey();
  if (!key) {
    warnNoKey();
    return value;
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${ct.toString("base64")}`;
}

/** Decrypt a value produced by encryptField. Non-prefixed (legacy plaintext) values pass through. */
export function decryptField(value: string | null | undefined): string | null {
  if (value == null || typeof value !== "string" || !value.startsWith(PREFIX)) {
    return (value as string | null) ?? null;
  }
  const key = getKey();
  if (!key) {
    warnNoKey();
    return value;
  }
  try {
    const parts = value.split(":"); // ["enc","v1",iv,tag,ct] — base64 has no ":"
    const iv = Buffer.from(parts[2], "base64");
    const tag = Buffer.from(parts[3], "base64");
    const ct = Buffer.from(parts[4], "base64");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
  } catch (e) {
    console.warn("[secrets] decrypt failed (wrong key?):", (e as Error).message);
    return value;
  }
}

/** Return a shallow copy of `obj` with the named keys encrypted. */
export function encryptFields<T extends Record<string, unknown>>(obj: T, keys: readonly (keyof T)[]): T {
  const out = { ...obj };
  for (const k of keys) {
    if (k in out) out[k] = encryptField(out[k] as string | null) as T[keyof T];
  }
  return out;
}

/** Return a shallow copy of `obj` with the named keys decrypted. */
export function decryptFields<T extends Record<string, unknown>>(obj: T, keys: readonly (keyof T)[]): T {
  const out = { ...obj };
  for (const k of keys) {
    if (k in out) out[k] = decryptField(out[k] as string | null) as T[keyof T];
  }
  return out;
}

/** Field groups encrypted per entity (shared by actions, data layer and the backfill). */
export const LANDLORD_SECRET_FIELDS = [
  "bank_account_number",
  "bank_sort_code",
  "bank_reference",
  "bank_account_name",
  "bank_name",
] as const;

export const TENANT_SECRET_FIELDS = [
  "guarantor_name",
  "guarantor_email",
  "guarantor_phone",
  "nok_name",
  "nok_phone",
  "nok_email",
  "nok_address",
] as const;

// PII on each unified tenant_contact row (Emergency / Guarantor).
export const TENANT_CONTACT_SECRET_FIELDS = [
  "name",
  "email",
  "phone",
  "address",
] as const;
