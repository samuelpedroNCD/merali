import type { SupabaseClient } from "@supabase/supabase-js";

export type Frequency =
  | "Weekly"
  | "Fortnightly"
  | "Monthly"
  | "Quarterly"
  | "Annually";

function advance(d: Date, freq: string) {
  switch (freq) {
    case "Weekly":
      d.setDate(d.getDate() + 7);
      break;
    case "Fortnightly":
      d.setDate(d.getDate() + 14);
      break;
    case "Quarterly":
      d.setMonth(d.getMonth() + 3);
      break;
    case "Annually":
      d.setFullYear(d.getFullYear() + 1);
      break;
    case "Monthly":
    default:
      d.setMonth(d.getMonth() + 1);
      break;
  }
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Due dates from start→end at the given frequency. If no end date, generates
 * 24 periods ahead. Capped at 600 rows for safety.
 */
export function generateDueDates(
  startISO: string | null,
  endISO: string | null,
  frequency: string | null,
): string[] {
  if (!startISO) return [];
  const start = new Date(startISO);
  if (isNaN(start.getTime())) return [];

  const freq = frequency || "Monthly";
  let end: Date;
  if (endISO) {
    end = new Date(endISO);
    if (isNaN(end.getTime())) end = new Date(start);
  } else {
    end = new Date(start);
    for (let i = 0; i < 24; i++) advance(end, freq);
  }

  const out: string[] = [];
  const cursor = new Date(start);
  while (cursor <= end && out.length < 600) {
    out.push(iso(cursor));
    advance(cursor, freq);
  }
  return out;
}

type LeaseLike = {
  id: string;
  property_id: string | null;
  tenant_id: string | null;
  start_date: string | null;
  end_date: string | null;
  rent_amount: number | null;
  payment_frequency: string | null;
};

/**
 * Reconcile a lease's rent_schedule with its terms:
 *  - inserts due dates that don't exist yet
 *  - removes future unpaid rows that fall outside the new term
 *  - keeps any paid/collected/reconciled rows untouched
 *  - refreshes amount_due on existing unpaid rows when rent changes
 */
export type RentReview = { effective_date: string; new_amount: number };

export async function syncRentSchedule(
  supabase: SupabaseClient,
  lease: LeaseLike,
  reviews?: RentReview[],
): Promise<void> {
  if (!lease.start_date || lease.rent_amount == null) return;

  // Reviews drive the rent from their effective date. Fetch them if not provided
  // (e.g. when called from the Plaid sync path) so amounts stay consistent.
  let revs = reviews;
  if (!revs) {
    const { data } = await supabase
      .from("rent_review")
      .select("effective_date, new_amount")
      .eq("lease_id", lease.id);
    revs = (data ?? []) as RentReview[];
  }
  const sorted = [...revs]
    .map((r) => ({ effective_date: r.effective_date, new_amount: Number(r.new_amount) }))
    .sort((a, b) => a.effective_date.localeCompare(b.effective_date));
  const base = Number(lease.rent_amount);
  const amountFor = (date: string) => {
    let amt = base;
    for (const r of sorted) {
      if (r.effective_date <= date) amt = r.new_amount;
      else break;
    }
    return amt;
  };

  const dates = generateDueDates(
    lease.start_date,
    lease.end_date,
    lease.payment_frequency,
  );
  const target = new Set(dates);

  const { data: existing } = await supabase
    .from("rent_schedule")
    .select("id, due_date, amount_collected, invoice_status, reconciled")
    .eq("lease_id", lease.id);

  const existingByDate = new Map<
    string,
    { id: string; amount_collected: number; invoice_status: string; reconciled: boolean }
  >();
  for (const r of existing ?? []) {
    existingByDate.set(r.due_date as string, {
      id: r.id as string,
      amount_collected: Number(r.amount_collected ?? 0),
      invoice_status: (r.invoice_status as string) ?? "Pending",
      reconciled: Boolean(r.reconciled),
    });
  }

  const isPaid = (row: { amount_collected: number; invoice_status: string; reconciled: boolean }) =>
    row.amount_collected > 0 || row.reconciled || row.invoice_status === "Paid";

  // Insert missing due dates.
  const toInsert = dates
    .filter((d) => !existingByDate.has(d))
    .map((d) => ({
      lease_id: lease.id,
      property_id: lease.property_id,
      tenant_id: lease.tenant_id,
      due_date: d,
      amount_due: amountFor(d),
      invoice_status: "Pending",
    }));
  if (toInsert.length) await supabase.from("rent_schedule").insert(toInsert);

  // Delete out-of-term unpaid rows.
  const toDelete: string[] = [];
  for (const [date, row] of existingByDate) {
    if (!target.has(date) && !isPaid(row)) toDelete.push(row.id);
  }
  if (toDelete.length)
    await supabase.from("rent_schedule").delete().in("id", toDelete);

  // Refresh amount_due on in-term unpaid rows to the effective (review-aware) amount.
  const unpaidInTerm = (existing ?? []).filter(
    (r) =>
      target.has(r.due_date as string) &&
      !isPaid({
        amount_collected: Number(r.amount_collected ?? 0),
        invoice_status: (r.invoice_status as string) ?? "Pending",
        reconciled: Boolean(r.reconciled),
      }),
  );
  for (const r of unpaidInTerm) {
    const amt = amountFor(r.due_date as string);
    await supabase.from("rent_schedule").update({ amount_due: amt }).eq("id", r.id as string);
  }
}
