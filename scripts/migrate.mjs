// Apply all SQL migrations in supabase/migrations in filename order.
// Usage: node --env-file=.env.local scripts/migrate.mjs
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "supabase", "migrations");
const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error("SUPABASE_DB_URL is not set");
  process.exit(1);
}

const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
const client = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
});

await client.connect();
await client.query(
  "create table if not exists _migrations (name text primary key, applied_at timestamptz default now())",
);

for (const f of files) {
  const done = await client.query("select 1 from _migrations where name=$1", [f]);
  if (done.rowCount) {
    console.log("skip", f);
    continue;
  }
  const sql = readFileSync(join(dir, f), "utf8");
  console.log("apply", f, `(${sql.length} chars)`);
  try {
    await client.query("begin");
    await client.query(sql);
    await client.query("insert into _migrations(name) values($1)", [f]);
    await client.query("commit");
    console.log("  ✓ done");
  } catch (e) {
    await client.query("rollback");
    console.error("  ✗ failed:", e.message);
    await client.end();
    process.exit(1);
  }
}

await client.end();
console.log("All migrations applied.");
