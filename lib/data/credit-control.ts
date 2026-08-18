import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { tenancyStatus } from "@/lib/tenancy-status";
import { shouldChase, daysOverdue as daysOverdueOf } from "@/lib/finance/credit-control";
import { sendEmail } from "@/lib/email/send";
import { gbp, fmtDate } from "@/lib/utils";

const rel = <T,>(v: unknown): T | null => (Array.isArray(v) ? (v[0] ?? null) : ((v as T) ?? null)) as T | null;

export type TenancyBalance = {
  lease_id: string;
  tenant: string | null;
  tenant_email: string | null;
  property: string | null;
  landlord: string | null;
  landlord_id: string | null;
  status: "Current" | "Past" | "Future";
  outstanding: number;         // rent arrears (>0 = owed; <0 = in credit)
  oldest_overdue: string | null;
  days_overdue: number;
  chasing_enabled: boolean;
  last_chased_at: string | null;
};

type LeaseRow = {
  id: string;
  start_date: string | null;
  end_date: string | null;
  commencement_date: string | null;
  chasing_enabled: boolean | null;
  tenant: { full_name: string | null; email: string | null } | null;
  property: { address: string | null; landlord: { id: string; full_name: string | null } | null } | null;
};

/** Per-tenancy rent balance (arrears), status, chasing flag and last-chase time. */
export async function getTenancyBalances(supabaseArg?: SupabaseClient): Promise<TenancyBalance[]> {
  const supabase = supabaseArg ?? (await createClient());
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  const [{ data: leases }, { data: sched }, { data: chases }] = await Promise.all([
    supabase.from("lease").select(
      "id, start_date, end_date, commencement_date, chasing_enabled, tenant:tenant_id(full_name, email), property:property_id(address, landlord:landlord_id(id, full_name))",
    ),
    supabase.from("rent_schedule").select("lease_id, amount_due, amount_collected, due_date, invoice_status"),
    supabase.from("credit_control_chase").select("lease_id, chased_at"),
  ]);

  // Arrears per lease + oldest still-overdue instalment.
  const agg = new Map<string, { outstanding: number; oldest: string | null }>();
  for (const r of sched ?? []) {
    const k = r.lease_id as string;
    if (!k) continue;
    const out = Number(r.amount_due ?? 0) - Number(r.amount_collected ?? 0);
    const a = agg.get(k) ?? { outstanding: 0, oldest: null };
    a.outstanding = Math.round((a.outstanding + out) * 100) / 100;
    if (out > 0 && (r.due_date as string) < today && r.invoice_status !== "Paid") {
      if (!a.oldest || (r.due_date as string) < a.oldest) a.oldest = r.due_date as string;
    }
    agg.set(k, a);
  }

  const lastChase = new Map<string, string>();
  for (const c of chases ?? []) {
    const k = c.lease_id as string;
    const at = c.chased_at as string;
    if (!lastChase.has(k) || at > (lastChase.get(k) as string)) lastChase.set(k, at);
  }

  return (leases ?? []).map((raw) => {
    const l = {
      ...raw,
      tenant: rel<{ full_name: string | null; email: string | null }>((raw as Record<string, unknown>).tenant),
      property: rel<{ address: string | null; landlord: unknown }>((raw as Record<string, unknown>).property),
    } as LeaseRow;
    const landlord = rel<{ id: string; full_name: string | null }>((l.property as Record<string, unknown> | null)?.landlord);
    const a = agg.get(l.id) ?? { outstanding: 0, oldest: null };
    return {
      lease_id: l.id,
      tenant: l.tenant?.full_name ?? null,
      tenant_email: l.tenant?.email ?? null,
      property: l.property?.address ?? null,
      landlord: landlord?.full_name ?? null,
      landlord_id: landlord?.id ?? null,
      status: tenancyStatus(l),
      outstanding: a.outstanding,
      oldest_overdue: a.oldest,
      days_overdue: a.oldest ? daysOverdueOf(a.oldest, now) : 0,
      chasing_enabled: l.chasing_enabled ?? true,
      last_chased_at: lastChase.get(l.id) ?? null,
    };
  });
}

/**
 * Daily credit-control run: chase tenancies whose arrears are due for a chase
 * (7 days overdue, then weekly), skipping any with chasing disabled. Emails the
 * lead tenant (no-op until RESEND_API_KEY is set), logs every chase, and raises
 * a staff notification. Returns how many were chased.
 */
export async function runCreditControl(supabase: SupabaseClient, now: Date = new Date()) {
  const balances = await getTenancyBalances(supabase);
  const due = balances.filter(
    (b) => b.chasing_enabled && b.outstanding > 0 && b.oldest_overdue && shouldChase(b.days_overdue, b.last_chased_at, now),
  );
  if (!due.length) return { chased: 0 };

  const { data: staff } = await supabase
    .from("staff_user")
    .select("id, notify_overdue")
    .eq("is_active", true);
  const notifyStaff = (staff ?? []).filter((s) => s.notify_overdue !== false);

  for (const b of due) {
    let emailed = false;
    if (b.tenant_email) {
      emailed = await sendEmail({
        to: b.tenant_email,
        subject: `Rent arrears reminder — ${b.property ?? "your tenancy"}`,
        html: `<p>Dear ${b.tenant ?? "tenant"},</p><p>Our records show an outstanding rent balance of <strong>${gbp(b.outstanding)}</strong> on your tenancy at ${b.property ?? ""}, with the earliest unpaid amount due on ${b.oldest_overdue ? fmtDate(b.oldest_overdue) : ""}.</p><p>Please arrange payment or contact us if you believe this is in error.</p><p>Merali Lettings</p>`,
      });
    }

    await supabase.from("credit_control_chase").insert({
      lease_id: b.lease_id,
      days_overdue: b.days_overdue,
      amount: b.outstanding,
      channel: emailed ? "Email" : "In-App",
      sent: emailed,
    });

    if (notifyStaff.length) {
      await supabase.from("notification").insert(
        notifyStaff.map((s) => ({
          to_staff_id: s.id,
          type: "Rent Overdue",
          delivery_channel: "In-App",
          trigger_source: "credit-control",
          lease_id: b.lease_id,
          message: `${b.tenant ?? "Tenant"} at ${b.property ?? "a property"} is ${b.days_overdue} days in arrears (${gbp(b.outstanding)}).`,
          was_sent: false,
          date_sent: now.toISOString(),
        })),
      );
    }
  }

  return { chased: due.length };
}
