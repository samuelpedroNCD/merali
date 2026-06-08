// Create (or update) the first Admin staff user directly via SQL.
// Works with superuser DB access (no service-role key required).
// Usage:
//   ADMIN_EMAIL=you@x.com ADMIN_PASSWORD='…' ADMIN_NAME='First Last' \
//   node --env-file=.env.local scripts/create-admin.mjs
import pg from "pg";

const dbUrl = process.env.SUPABASE_DB_URL;
const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
const name = (process.env.ADMIN_NAME || "").trim();

for (const [k, v] of Object.entries({ dbUrl, email, password })) {
  if (!v) {
    console.error(`Missing ${k}`);
    process.exit(1);
  }
}
const [firstName, ...rest] = name.split(/\s+/);
const lastName = rest.join(" ");

const c = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
await c.connect();

// crypt/gen_salt live in the extensions schema on Supabase.
const cryptExpr = "extensions.crypt($PW, extensions.gen_salt('bf'))";

// Which optional columns exist on auth.users in this GoTrue version?
const cols = (
  await c.query(
    `select column_name from information_schema.columns
     where table_schema='auth' and table_name='users'`,
  )
).rows.map((r) => r.column_name);
const has = (x) => cols.includes(x);

let userId;
const existing = await c.query("select id from auth.users where email=$1", [email]);

if (existing.rowCount) {
  userId = existing.rows[0].id;
  await c.query(
    `update auth.users set encrypted_password=${cryptExpr.replace("$PW", "$2")},
       email_confirmed_at=coalesce(email_confirmed_at, now()), updated_at=now()
     where id=$1`,
    [userId, password],
  );
  console.log("auth user existed — password reset:", userId);
} else {
  // Build an insert from a curated set intersected with existing columns.
  const fields = {
    id: "gen_random_uuid()",
    instance_id: "'00000000-0000-0000-0000-000000000000'",
    aud: "'authenticated'",
    role: "'authenticated'",
    email: "$1",
    encrypted_password: cryptExpr.replace("$PW", "$2"),
    email_confirmed_at: "now()",
    created_at: "now()",
    updated_at: "now()",
    raw_app_meta_data: `'{"provider":"email","providers":["email"]}'::jsonb`,
    raw_user_meta_data: `'${JSON.stringify({ full_name: name }).replace(/'/g, "''")}'::jsonb`,
    is_sso_user: "false",
    is_anonymous: "false",
  };
  const useCols = Object.keys(fields).filter((k) => k === "id" || has(k));
  const sql = `insert into auth.users (${useCols.join(",")})
               values (${useCols.map((k) => fields[k]).join(",")}) returning id`;
  const ins = await c.query(sql, [email, password]);
  userId = ins.rows[0].id;
  console.log("auth user created:", userId);
}

// GoTrue scans these token columns into Go strings — NULL breaks sign-in
// ("Database error querying schema"). Normalise any NULLs to ''.
{
  const tokenCols = [
    "confirmation_token", "recovery_token", "email_change",
    "email_change_token_new", "email_change_token_current",
    "phone_change", "phone_change_token", "reauthentication_token",
  ];
  const present = (
    await c.query(
      `select column_name from information_schema.columns
       where table_schema='auth' and table_name='users'
       and data_type in ('text','character varying')`,
    )
  ).rows.map((r) => r.column_name);
  const fix = tokenCols.filter((x) => present.includes(x));
  if (fix.length) {
    await c.query(
      `update auth.users set ${fix.map((col) => `${col}=coalesce(${col},'')`).join(", ")} where id=$1`,
      [userId],
    );
  }
}

// Ensure an email identity exists (required for password login).
const idn = await c.query(
  "select 1 from auth.identities where user_id=$1 and provider='email'",
  [userId],
);
if (!idn.rowCount) {
  const idCols = (
    await c.query(
      `select column_name from information_schema.columns
       where table_schema='auth' and table_name='identities'`,
    )
  ).rows.map((r) => r.column_name);
  const base =
    `insert into auth.identities (provider_id, user_id, identity_data, provider,` +
    (idCols.includes("last_sign_in_at") ? " last_sign_in_at," : "") +
    ` created_at, updated_at) values ($1,$2,$3,'email',` +
    (idCols.includes("last_sign_in_at") ? " now()," : "") +
    ` now(), now())`;
  await c.query(base, [
    email,
    userId,
    JSON.stringify({ sub: userId, email, email_verified: true, phone_verified: false }),
  ]);
  console.log("email identity created");
}

// Upsert the staff_user profile as Admin.
const role = await c.query("select id from role where name='Admin' limit 1");
await c.query(
  `insert into staff_user (user_id, email, first_name, last_name, role_id, is_active)
   values ($1,$2,$3,$4,$5,true)
   on conflict (email) do update set
     user_id=excluded.user_id, first_name=excluded.first_name,
     last_name=excluded.last_name, role_id=excluded.role_id, is_active=true`,
  [userId, email, firstName || null, lastName || null, role.rows[0]?.id],
);
await c.end();
console.log("✓ staff_user upserted as Admin:", email);
