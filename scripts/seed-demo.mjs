// Wipe existing app data and load a focused demo portfolio.
// Usage: node --env-file=.env.local scripts/seed-demo.mjs
//
// Preserves: staff_user, role/permission, option_set, nominal_code,
// certification_type, bank_account, auth.users, _migrations.
// Everything runs in ONE transaction — it all lands or nothing does.

import pg from "pg";

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error("SUPABASE_DB_URL is not set");
  process.exit(1);
}

const client = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

// ---- date helpers (relative to today) -------------------------------------
const now = new Date();
const iso = (d) => d.toISOString().slice(0, 10);
const daysFromNow = (n) => { const d = new Date(now); d.setDate(d.getDate() + n); return iso(d); };
const monthsFromNow = (n) => { const d = new Date(now); d.setMonth(d.getMonth() + n); return iso(d); };
const firstOfMonth = (n) => iso(new Date(now.getFullYear(), now.getMonth() + n, 1));
const todayISO = iso(now);

// VAT from a gross amount.
function fromGross(gross, rate) {
  const net = +(gross / (1 + rate / 100)).toFixed(2);
  return { net, vat: +(gross - net).toFixed(2) };
}

await client.connect();

// generic insert → returns new id
async function ins(table, obj) {
  const keys = Object.keys(obj);
  const cols = keys.map((k) => `"${k}"`).join(", ");
  const ph = keys.map((_, i) => `$${i + 1}`).join(", ");
  const { rows } = await client.query(
    `insert into ${table} (${cols}) values (${ph}) returning id`,
    keys.map((k) => obj[k]),
  );
  return rows[0].id;
}

try {
  await client.query("begin");

  // ---- pick a staff user (creator / assignee for FK fields) ---------------
  const staffRes = await client.query(
    "select id, full_name from staff_user where is_active = true order by created_at asc limit 1",
  );
  const staffId = staffRes.rows[0]?.id ?? null;
  if (!staffId) throw new Error("No active staff_user found — run scripts/create-admin.mjs first.");
  console.log(`Using staff: ${staffRes.rows[0].full_name}`);

  // ---- lookups: nominal codes + certification types -----------------------
  const nomRes = await client.query("select id, code from nominal_code");
  const nomByCode = new Map(nomRes.rows.map((r) => [r.code, r.id]));
  const nom = (code) => nomByCode.get(code) ?? null;

  const certRes = await client.query("select id, name from certification_type");
  const certId = (needle) => certRes.rows.find((r) => r.name.toLowerCase().includes(needle))?.id ?? null;

  // ---- WIPE app data (children → parents) ---------------------------------
  const wipe = [
    "activity_log", "notification", "reminder_assignee", "reminder", "report_template",
    "maintenance_comment", "transaction", "key_log", "key_spare", "key",
    "inspection", "property_photo", "certification", "document", "utility",
    "rent_review", "rent_schedule", "lease_tenant", "lease", "maintenance",
    "property", "tenant", "supplier", "landlord",
  ];
  for (const t of wipe) await client.query(`delete from ${t}`);
  console.log("Wiped existing app data.");

  // ---- LANDLORDS ----------------------------------------------------------
  const llMeridian = await ins("landlord", {
    landlord_type: "Limited Company",
    entity_name: "Meridian Property Holdings Ltd",
    full_name: "Meridian Property Holdings Ltd",
    main_contact_name: "Sarah Bennett",
    main_contact_email: "sarah@meridianholdings.co.uk",
    main_contact_phone: "0161 224 5567",
    vat_number: "GB 412 5567 02",
    bank_account_name: "Meridian Property Holdings Ltd",
    bank_name: "NatWest",
    bank_sort_code: "60-12-34",
    bank_account_number: "12345678",
    bank_reference: "MERIDIAN-RENT",
    preferred_contact: "Email",
    notes: "Owns the Maple Court building.",
  });
  const llWhitfield = await ins("landlord", {
    landlord_type: "Individual",
    first_name: "James",
    last_name: "Whitfield",
    full_name: "James Whitfield",
    email: "james.whitfield@gmail.com",
    phone: "07700 900145",
    preferred_contact: "Phone",
    bank_account_name: "Mr J Whitfield",
    bank_name: "Halifax",
    bank_sort_code: "11-02-44",
    bank_account_number: "87654321",
    notes: "Private landlord — owns 14 Oak Lane.",
  });

  // ---- SUPPLIERS ----------------------------------------------------------
  const supApex = await ins("supplier", { business_name: "Apex Plumbing & Heating", primary_contact_name: "Dave Apex", primary_contact_email: "ops@apexph.co.uk", type: "Plumber", status: "Preferred", preferred: true });
  const supSpark = await ins("supplier", { business_name: "Brightspark Electrical", primary_contact_name: "Nina Patel", primary_contact_email: "hello@brightspark.co.uk", type: "Electrician", status: "Active" });
  const supClean = await ins("supplier", { business_name: "Gleam Clean Services", primary_contact_name: "Tom Reyes", primary_contact_email: "bookings@gleamclean.co.uk", type: "Cleaner", status: "Active" });

  // ---- PROPERTIES: Building → Sub-buildings → Units ------------------------
  const baseAddr = { town: "Manchester", post_code: "M14 5TQ", country: "United Kingdom", area: "Fallowfield" };

  const pBuilding = await ins("property", {
    address: "Maple Court, 25 Elm Road", ...baseAddr,
    internal_code: "MC", configuration: "Building", property_type: "Residential",
    status: "Occupied", landlord_id: llMeridian, assigned_manager_id: staffId,
    date_acquired: monthsFromNow(-30), notes: "Purpose-built block, two cores (Block A & B).",
  });
  const mkSub = (name, code) => ins("property", {
    address: "Maple Court, 25 Elm Road", flat: name, ...baseAddr,
    internal_code: code, configuration: "Sub-building", property_type: "Residential",
    parent_property_id: pBuilding, landlord_id: llMeridian, assigned_manager_id: staffId,
  });
  const pBlockA = await mkSub("Block A", "MC-A");
  const pBlockB = await mkSub("Block B", "MC-B");

  const mkUnit = (parent, name, code, rent, beds, status) => ins("property", {
    address: "Maple Court, 25 Elm Road", flat: name, ...baseAddr,
    internal_code: code, configuration: "Unit", class: "Flat", property_type: "Residential",
    bedrooms: beds, status, target_rent: rent, parent_property_id: parent,
    landlord_id: llMeridian, assigned_manager_id: staffId,
  });
  const flat1 = await mkUnit(pBlockA, "Flat 1", "MC-A1", 950, 2, "Occupied");
  const flat2 = await mkUnit(pBlockA, "Flat 2", "MC-A2", 900, 1, "Occupied");
  const flat3 = await mkUnit(pBlockA, "Flat 3", "MC-A3", 925, 1, "Vacant");
  const flat4 = await mkUnit(pBlockB, "Flat 4", "MC-B1", 1100, 2, "Occupied");
  const flat5 = await mkUnit(pBlockB, "Flat 5", "MC-B2", 1250, 2, "Occupied");
  const flat6 = await mkUnit(pBlockB, "Flat 6", "MC-B3", 1150, 2, "Vacant");

  const pOak = await ins("property", {
    address: "14 Oak Lane", town: "Stockport", post_code: "SK2 6QR", country: "United Kingdom", area: "Davenport",
    internal_code: "OL14", configuration: "Standalone Property", class: "House", property_type: "Residential",
    bedrooms: 3, status: "Occupied", target_rent: 1450, landlord_id: llWhitfield, assigned_manager_id: staffId,
    date_acquired: monthsFromNow(-48),
  });

  // ---- TENANTS ------------------------------------------------------------
  const mkTenant = (first, last, email, phone) => ins("tenant", {
    first_name: first, last_name: last, full_name: `${first} ${last}`, email, phone,
    tenant_type: "Individual", status: "Active", preferred_contact: "Email",
  });
  const tOlivia = await mkTenant("Olivia", "Hughes", "olivia.hughes@example.com", "07700 900201");
  const tDaniel = await mkTenant("Daniel", "Carter", "daniel.carter@example.com", "07700 900202");
  const tPriya = await mkTenant("Priya", "Sharma", "priya.sharma@example.com", "07700 900203");
  const tMarcus = await mkTenant("Marcus", "Bell", "marcus.bell@example.com", "07700 900204");
  const tEmma = await mkTenant("Emma", "Thompson", "emma.thompson@example.com", "07700 900205");
  const tLiam = await mkTenant("Liam", "Foster", "liam.foster@example.com", "07700 900206");

  // ---- LEASES + tenants + schedule + ledger -------------------------------
  const astCode = "AST – General Assured Shorthold Tenancy";

  async function makeLease({ property, tenants, lead, rent, startMonths, endMonths, deposit, scheme, arrears }) {
    const leaseId = await ins("lease", {
      property_id: property, unit_id: property, tenant_id: lead, tenancy_code: astCode,
      start_date: monthsFromNow(startMonths), end_date: monthsFromNow(endMonths),
      move_in_date: monthsFromNow(startMonths), rent_amount: rent, payment_frequency: "Monthly",
      status: "Active", rent_nominal_id: nom("4000"),
      deposit_amount: deposit, deposit_scheme: scheme, deposit_reference: `DEP-${Math.round(rent)}`,
      deposit_protected_date: monthsFromNow(startMonths + 1),
    });
    for (const t of tenants) {
      await client.query(
        "insert into lease_tenant (lease_id, tenant_id, is_lead) values ($1,$2,$3)",
        [leaseId, t, t === lead],
      );
    }
    // Rent schedule: months -3..+2. Past = Paid; this month Overdue if arrears; future Pending.
    for (let m = -3; m <= 2; m++) {
      const due = firstOfMonth(m);
      const past = due < todayISO;
      let status = past ? "Paid" : "Pending";
      let collected = past ? rent : 0;
      if (arrears && m === 0) { status = "Overdue"; collected = 0; }
      else if (!past && m === 0) { status = "Paid"; collected = rent; } // this month collected
      await ins("rent_schedule", {
        lease_id: leaseId, property_id: property, tenant_id: lead,
        due_date: due, amount_due: rent, amount_collected: collected, invoice_status: status,
      });
    }
    return leaseId;
  }

  const lease1 = await makeLease({ property: flat1, tenants: [tOlivia], lead: tOlivia, rent: 950, startMonths: -10, endMonths: 14, deposit: 1096, scheme: "DPS" });
  const lease2 = await makeLease({ property: flat2, tenants: [tDaniel], lead: tDaniel, rent: 900, startMonths: -6, endMonths: 18, deposit: 1038, scheme: "TDS", arrears: true });
  const lease3 = await makeLease({ property: flat4, tenants: [tPriya], lead: tPriya, rent: 1100, startMonths: -4, endMonths: 20, deposit: 1269, scheme: "DPS" });
  const lease4 = await makeLease({ property: flat5, tenants: [tEmma, tLiam], lead: tEmma, rent: 1250, startMonths: -8, endMonths: 16, deposit: 1442, scheme: "mydeposits" });
  const lease5 = await makeLease({ property: pOak, tenants: [tMarcus], lead: tMarcus, rent: 1450, startMonths: -12, endMonths: 12, deposit: 1673, scheme: "DPS" });

  // A rent review on Flat 4: increase from next month.
  await ins("rent_review", { lease_id: lease3, effective_date: firstOfMonth(1), new_amount: 1150 });

  // ---- LEDGER transactions (non-rent income/expenses tagged to tenancies) --
  async function txn({ type, category, gross, rate = 0, date, property, lease, supplier, code, status = "Paid", reference, notes }) {
    const { net, vat } = fromGross(gross, rate);
    await ins("transaction", {
      type, category, amount_gross: gross, vat_rate: rate, vat_amount: vat, amount_net: net,
      txn_date: date, property_id: property ?? null, lease_id: lease ?? null, supplier_id: supplier ?? null,
      nominal_code_id: code ?? null, status, reference: reference ?? null, notes: notes ?? null, manual_entry: true,
    });
  }
  // Tenancy-tagged (appear in each tenancy's Ledger)
  await txn({ type: "Expense", category: "Maintenance", gross: 140, date: monthsFromNow(-1), property: flat1, lease: lease1, supplier: supApex, code: nom("5000"), notes: "Leaking kitchen tap — washer replaced" });
  await txn({ type: "Expense", category: "Maintenance", gross: 45, date: monthsFromNow(-1), property: flat2, lease: lease2, supplier: supSpark, code: nom("5000"), notes: "Replaced faulty smoke alarm" });
  await txn({ type: "Expense", category: "Maintenance", gross: 96, date: monthsFromNow(-2), property: flat4, lease: lease3, supplier: supApex, code: nom("5100"), notes: "Annual gas safety check" });
  await txn({ type: "Income", category: "Other", gross: 60, date: monthsFromNow(-1), property: flat5, lease: lease4, code: nom("4010"), notes: "End-of-tenancy cleaning recharge" });
  await txn({ type: "Expense", category: "Maintenance", gross: 110, date: monthsFromNow(-2), property: pOak, lease: lease5, supplier: supApex, code: nom("5000"), notes: "Annual boiler service" });
  // Building-level (no tenancy) — feed the building rollup + global finances
  await txn({ type: "Expense", category: "Cleaning", gross: 180, rate: 20, date: monthsFromNow(-1), property: pBuilding, supplier: supClean, code: nom("5050"), notes: "Communal cleaning — monthly" });
  await txn({ type: "Expense", category: "Cleaning", gross: 180, rate: 20, date: monthsFromNow(-2), property: pBuilding, supplier: supClean, code: nom("5050"), notes: "Communal cleaning — monthly" });
  await txn({ type: "Expense", category: "Insurance", gross: 540, date: monthsFromNow(-3), property: pBuilding, code: nom("5020"), reference: "POL-558210", notes: "Buildings insurance — annual premium" });
  await txn({ type: "Expense", category: "Management Fee", gross: 225, rate: 20, date: monthsFromNow(-1), property: pBuilding, code: nom("5010"), notes: "Management fee — Maple Court" });

  // ---- MAINTENANCE --------------------------------------------------------
  const mk = (o) => ins("maintenance", { submitted_by: staffId, assigned_staff_id: staffId, ...o });
  await mk({ description: "Repaint and clean before re-let", status: "In Progress", urgency: "Medium", type: "Decorating", property_id: flat3, supplier_id: supClean, planned_date: daysFromNow(5), notes: "Void turnaround for Flat 3." });
  await mk({ description: "Intermittent boiler fault — no hot water some mornings", status: "Open", urgency: "High", type: "Heating", property_id: flat1, supplier_id: supApex });
  await mk({ description: "Communal stairwell lighting out (Block A)", status: "Needs Booking", urgency: "Medium", type: "Electrical", property_id: pBlockA, supplier_id: supSpark });
  await mk({ description: "Gutter clearing — front elevation", status: "Completed", urgency: "Low", type: "General", property_id: pOak, completion_date: daysFromNow(-10), cost: 85 });

  // ---- KEYS ---------------------------------------------------------------
  const mkKey = (o) => ins("key", o);
  await mkKey({ key_code: "MC-A1-01", property_id: flat1, held_by_type: "Tenant", status: "Out", date_given: monthsFromNow(-10), reference_id: "Set 1" });
  await mkKey({ key_code: "MC-A2-01", property_id: flat2, held_by_type: "Tenant", status: "Out", date_given: monthsFromNow(-6) });
  await mkKey({ key_code: "MC-MASTER", property_id: pBuilding, held_by_type: "Office", status: "In Office", reference_id: "Master + communal" });
  await mkKey({ key_code: "OL14-01", property_id: pOak, held_by_type: "Tenant", status: "Out", date_given: monthsFromNow(-12) });

  // ---- CERTIFICATIONS (some expiring soon for the dashboard alert) --------
  const epc = certId("energy") ?? certId("epc");
  const gas = certId("gas");
  const eicr = certId("electrical") ?? certId("eicr");
  if (epc) await ins("certification", { property_id: pBuilding, type_id: epc, expiry_date: daysFromNow(220) });
  if (gas) await ins("certification", { property_id: flat1, unit_id: flat1, type_id: gas, expiry_date: daysFromNow(18) });
  if (gas) await ins("certification", { property_id: pOak, type_id: gas, expiry_date: daysFromNow(-4), is_expired: true });
  if (eicr) await ins("certification", { property_id: flat4, unit_id: flat4, type_id: eicr, expiry_date: daysFromNow(400) });

  // ---- UTILITIES (building) ----------------------------------------------
  await ins("utility", { property_id: pBuilding, utility_type: "Gas", supplier: "British Gas", meter_location: "Plant room, ground floor", stop_tap_location: "Under stairs, Block A" });
  await ins("utility", { property_id: pBuilding, utility_type: "Electricity", supplier: "EDF Energy", meter_location: "Communal meter cupboard" });
  await ins("utility", { property_id: pBuilding, utility_type: "Water", supplier: "United Utilities", stop_tap_location: "External, front boundary" });

  // ---- INSPECTIONS --------------------------------------------------------
  await ins("inspection", { property_id: flat1, lease_id: lease1, type: "Move-in", inspection_date: monthsFromNow(-10), inspector_id: staffId, notes: "Property in good order at move-in. Meter readings recorded." });
  await ins("inspection", { property_id: pBuilding, type: "Routine", inspection_date: monthsFromNow(-2), inspector_id: staffId, notes: "Communal areas clean; stairwell light flagged for repair." });

  await client.query("commit");
  console.log("\n✓ Demo data loaded:");
  console.log("  2 landlords · 3 suppliers");
  console.log("  Maple Court (Building) → Block A + Block B → 6 units, + 14 Oak Lane (standalone)");
  console.log("  6 tenants · 5 active tenancies (1 in arrears) with rent schedules + a rent review");
  console.log("  9 ledger transactions · 4 maintenance jobs · 4 keys · 4 certs · 3 utilities · 2 inspections");
} catch (e) {
  await client.query("rollback");
  console.error("\n✗ Failed — rolled back, no changes made.");
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
