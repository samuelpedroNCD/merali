// One-off backfill: encrypt existing plaintext values in the sensitive columns.
// Usage: node --env-file=.env.local scripts/encrypt-existing.mjs
//
// Idempotent — rows already prefixed `enc:v1:` are skipped. Safe to re-run.
// Requires DATA_ENCRYPTION_KEY (same value as the app uses).

import pg from "pg";
import crypto from "node:crypto";

const PREFIX = "enc:v1:";

const keyB64 = process.env.DATA_ENCRYPTION_KEY;
const key = keyB64 ? Buffer.from(keyB64, "base64") : null;
if (!key || key.length !== 32) {
  console.error("DATA_ENCRYPTION_KEY must be set to a base64 32-byte key. Aborting (no plaintext written).");
  process.exit(1);
}

function encrypt(value) {
  if (value == null || value === "" || String(value).startsWith(PREFIX)) return value;
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([c.update(String(value), "utf8"), c.final()]);
  const tag = c.getAuthTag();
  return `${PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${ct.toString("base64")}`;
}

const TARGETS = [
  { table: "landlord", fields: ["bank_account_number", "bank_sort_code", "bank_reference", "bank_account_name", "bank_name"] },
  { table: "tenant", fields: ["guarantor_name", "guarantor_email", "guarantor_phone", "nok_name", "nok_phone", "nok_email", "nok_address"] },
  { table: "bank_account", fields: ["access_token"] },
];

const client = new pg.Client({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

await client.connect();
try {
  await client.query("begin");
  for (const { table, fields } of TARGETS) {
    const cols = ["id", ...fields].map((c) => `"${c}"`).join(", ");
    const { rows } = await client.query(`select ${cols} from ${table}`);
    let changed = 0;
    for (const row of rows) {
      const updates = {};
      for (const f of fields) {
        const enc = encrypt(row[f]);
        if (enc !== row[f]) updates[f] = enc; // only newly-encrypted values
      }
      const keys = Object.keys(updates);
      if (!keys.length) continue;
      const set = keys.map((k, i) => `"${k}" = $${i + 1}`).join(", ");
      await client.query(`update ${table} set ${set} where id = $${keys.length + 1}`, [...keys.map((k) => updates[k]), row.id]);
      changed++;
    }
    console.log(`${table}: ${changed} row(s) encrypted (of ${rows.length}).`);
  }
  await client.query("commit");
  console.log("\n✓ Backfill complete.");
} catch (e) {
  await client.query("rollback");
  console.error("\n✗ Failed — rolled back.");
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
