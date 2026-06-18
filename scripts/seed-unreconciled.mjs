// Seed mock "unreconciled" bank transactions so the Unreconciled queue can be
// tested (approve / match / dismiss + property-code auto-assign).
//
// Usage:   node --env-file=.env.local scripts/seed-unreconciled.mjs
// Clean:   node --env-file=.env.local scripts/seed-unreconciled.mjs --clean
//
// Idempotent: every row it creates is tagged in `notes` with MARKER, and the
// script deletes those rows before re-inserting (so re-running won't pile up,
// and --clean removes them entirely). Touches only the `transaction` table.

import pg from "pg";

const MARKER = "[mock-unreconciled]";
const clean = process.argv.includes("--clean");

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error("SUPABASE_DB_URL is not set (run with: node --env-file=.env.local scripts/seed-unreconciled.mjs)");
  process.exit(1);
}

const client = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

const now = new Date();
const iso = (d) => d.toISOString().slice(0, 10);
const daysAgo = (n) => { const d = new Date(now); d.setDate(d.getDate() - n); return iso(d); };
// Net/VAT from a gross amount at a given rate.
const fromGross = (gross, rate) => {
  const net = +(gross / (1 + rate / 100)).toFixed(2);
  return { net, vat: +(gross - net).toFixed(2) };
};

await client.connect();
try {
  // Always clear previous mock rows first (makes the script repeatable).
  const del = await client.query(`delete from transaction where notes like $1`, [`%${MARKER}%`]);
  console.log(`Removed ${del.rowCount} existing mock transaction(s).`);

  if (clean) {
    console.log("Clean-only run — done.");
    await client.end();
    process.exit(0);
  }

  // Grab a few real properties with internal codes so references can mention
  // them (lets you test the property-code match on approve).
  const { rows: props } = await client.query(
    `select id, internal_code, address from property
       where coalesce(internal_code, '') <> ''
       order by created_at limit 4`,
  );
  const code = (i) => props[i]?.internal_code ?? null;
  if (props.length === 0) {
    console.log("Note: no properties have an internal_code, so references won't include codes.");
  }

  // type, gross, vat_rate, institution, reference, daysAgo, status
  const mocks = [
    ["Income", 1450, 0, "Monzo",    `RENT ${code(0) ?? "REF"} J SMITH STO`, 2, "Pending"],
    ["Income", 1200, 0, "Barclays", `BACS CREDIT ${code(1) ?? ""} A PATEL`, 4, "Pending"],
    ["Income",  875, 0, "Starling", `FASTER PAYMENT TENANT RENT`, 6, "Pending"],
    ["Expense", 240, 20, "HSBC",    `BRITISH GAS BUSINESS DD`, 3, "Pending"],
    ["Expense", 180, 20, "Monzo",   `PLUMBER INV 4471 ${code(2) ?? ""}`, 5, "Pending"],
    ["Expense",  96, 20, "Barclays",`THAMES WATER DD`, 8, "Pending"],
    ["Expense", 540, 20, "Starling",`CONTRACTOR PYMT ${code(0) ?? ""}`, 9, "Pending"],
    ["Income",  300, 0, "HSBC",     `TRANSFER REF DEPOSIT TOPUP`, 11, "Pending"],
  ];

  for (let i = 0; i < mocks.length; i++) {
    const [type, gross, rate, inst, reference, ago, status] = mocks[i];
    const { net, vat } = fromGross(gross, rate);
    await client.query(
      `insert into transaction
         (type, category, amount_net, vat_rate, vat_amount, amount_gross, txn_date,
          manual_entry, needs_review, plaid_synced, plaid_institution, plaid_transaction_id,
          status, reference, notes)
       values ($1,$2,$3,$4,$5,$6,$7,false,true,true,$8,$9,$10,$11,$12)`,
      [
        type,
        type === "Income" ? "Rent" : "Maintenance",
        net, rate, vat, gross, daysAgo(ago),
        inst, `mock-unrec-${i + 1}`,
        status, reference, MARKER,
      ],
    );
  }

  console.log(`Inserted ${mocks.length} mock unreconciled transaction(s). Open /unreconciled to test.`);
  if (props.length) {
    console.log("Property codes used in references:", props.map((p) => p.internal_code).join(", "));
  }
} catch (e) {
  console.error("Failed:", e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
