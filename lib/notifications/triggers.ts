import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email/send";

type PrefKey = "notify_certifications" | "notify_renewals" | "notify_overdue" | "notify_ending";
type Staff = {
  id: string;
  email: string;
  notify_email: boolean;
  notify_certifications: boolean;
  notify_renewals: boolean;
  notify_overdue: boolean;
  notify_ending: boolean;
};

const DEDUP_WINDOW_HOURS = 20;

async function activeStaff(supabase: SupabaseClient): Promise<Staff[]> {
  const { data } = await supabase
    .from("staff_user")
    .select("id, email, notify_email, notify_certifications, notify_renewals, notify_overdue, notify_ending")
    .eq("is_active", true);
  return (data ?? []) as Staff[];
}

/** Skip if a like notification was already raised recently. */
async function alreadyNotified(
  supabase: SupabaseClient,
  type: string,
  column: "certification_id" | "lease_id",
  id: string,
): Promise<boolean> {
  const since = new Date(Date.now() - DEDUP_WINDOW_HOURS * 3600_000).toISOString();
  const { count } = await supabase
    .from("notification")
    .select("*", { count: "exact", head: true })
    .eq("type", type)
    .eq(column, id)
    .gte("created_at", since);
  return (count ?? 0) > 0;
}

async function raise(
  supabase: SupabaseClient,
  allStaff: Staff[],
  opts: {
    type: string;
    message: string;
    trigger: string;
    prefKey: PrefKey;
    certification_id?: string;
    lease_id?: string;
    emailSubject: string;
    emailHtml: string;
  },
) {
  // Honour each user's per-type opt-out; e-mail only those who also keep email on.
  const staff = allStaff.filter((s) => s[opts.prefKey] !== false);
  if (!staff.length) return;
  const rows = staff.map((s) => ({
    to_staff_id: s.id,
    type: opts.type,
    delivery_channel: "In-App",
    trigger_source: opts.trigger,
    certification_id: opts.certification_id ?? null,
    lease_id: opts.lease_id ?? null,
    message: opts.message,
    was_sent: false,
    date_sent: new Date().toISOString(),
  }));
  if (rows.length) await supabase.from("notification").insert(rows);

  const sent = await sendEmail({
    to: staff.filter((s) => s.notify_email !== false).map((s) => s.email).filter(Boolean),
    subject: opts.emailSubject,
    html: opts.emailHtml,
  });
  if (sent && rows.length) {
    await supabase
      .from("notification")
      .update({ was_sent: true, delivery_channel: "Email" })
      .eq("type", opts.type)
      .eq(opts.certification_id ? "certification_id" : "lease_id", opts.certification_id ?? opts.lease_id);
  }
}

/**
 * Evaluate all notification triggers. Returns a summary of what was raised.
 * Idempotent within the dedup window so it can run daily (or be re-run).
 */
export async function runTriggers(supabase: SupabaseClient, now = new Date()) {
  const staff = await activeStaff(supabase);
  let certCount = 0;
  let renewalCount = 0;

  // 1) Certifications expiring within their type's lead window.
  const { data: certs } = await supabase
    .from("certification")
    .select("id, expiry_date, type:type_id(name, reminder_lead_days), property:property_id(address)")
    .not("expiry_date", "is", null);

  for (const c of certs ?? []) {
    const type = (Array.isArray(c.type) ? c.type[0] : c.type) as
      | { name?: string; reminder_lead_days?: number }
      | null;
    const property = (Array.isArray(c.property) ? c.property[0] : c.property) as
      | { address?: string }
      | null;
    const lead = type?.reminder_lead_days ?? 7;
    const expiry = new Date(c.expiry_date as string);
    const days = Math.ceil((expiry.getTime() - now.getTime()) / 86400000);
    if (days <= lead && days >= -1) {
      if (await alreadyNotified(supabase, "Certification Expiring", "certification_id", c.id as string)) continue;
      const label = `${type?.name ?? "Certification"} at ${property?.address ?? "a property"}`;
      await raise(supabase, staff, {
        type: "Certification Expiring",
        trigger: "cron",
        prefKey: "notify_certifications",
        certification_id: c.id as string,
        message: `${label} expires ${days < 0 ? "today" : `in ${days} day(s)`}.`,
        emailSubject: `Certification expiring: ${type?.name ?? "Certification"}`,
        emailHtml: `<p>${label} expires ${days < 0 ? "today" : `in ${days} day(s)`}.</p>`,
      });
      certCount++;
    }
  }

  // 2) Lease renewals this month.
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);
  const { data: leases } = await supabase
    .from("lease")
    .select("id, end_date, renewal_date, property:property_id(address), tenant:tenant_id(full_name)")
    .or(`and(renewal_date.gte.${start},renewal_date.lt.${end}),and(end_date.gte.${start},end_date.lt.${end})`);

  for (const l of leases ?? []) {
    if (await alreadyNotified(supabase, "Lease Renewal Due", "lease_id", l.id as string)) continue;
    const property = (Array.isArray(l.property) ? l.property[0] : l.property) as { address?: string } | null;
    const tenant = (Array.isArray(l.tenant) ? l.tenant[0] : l.tenant) as { full_name?: string } | null;
    const label = `${tenant?.full_name ?? "A tenancy"} at ${property?.address ?? "a property"}`;
    await raise(supabase, staff, {
      type: "Lease Renewal Due",
      trigger: "cron",
      prefKey: "notify_renewals",
      lease_id: l.id as string,
      message: `${label} is due for renewal this month.`,
      emailSubject: "Lease renewal due this month",
      emailHtml: `<p>${label} is due for renewal this month.</p>`,
    });
    renewalCount++;
  }

  // 3) Overdue rent — per lease with unpaid past-due instalments.
  let overdueCount = 0;
  const todayStr = now.toISOString().slice(0, 10);
  const { data: overdue } = await supabase
    .from("rent_schedule")
    .select("lease_id, due_date, amount_due, amount_collected, tenant:tenant_id(full_name), property:property_id(address), lease:lease_id(exclude_from_reminders)")
    .neq("invoice_status", "Paid")
    .lt("due_date", todayStr);

  type OD = { arrears: number; tenant: string | null; property: string | null; oldest: string; excluded: boolean };
  const byLease = new Map<string, OD>();
  for (const r of overdue ?? []) {
    const id = r.lease_id as string;
    if (!id) continue;
    const t = r.tenant as { full_name?: string } | { full_name?: string }[] | null;
    const p = r.property as { address?: string } | { address?: string }[] | null;
    const lr = r.lease as { exclude_from_reminders?: boolean } | { exclude_from_reminders?: boolean }[] | null;
    const excluded = (Array.isArray(lr) ? lr[0]?.exclude_from_reminders : lr?.exclude_from_reminders) ?? false;
    const cur = byLease.get(id) ?? {
      arrears: 0,
      tenant: (Array.isArray(t) ? t[0]?.full_name : t?.full_name) ?? null,
      property: (Array.isArray(p) ? p[0]?.address : p?.address) ?? null,
      oldest: r.due_date as string,
      excluded,
    };
    cur.arrears += Number(r.amount_due ?? 0) - Number(r.amount_collected ?? 0);
    if ((r.due_date as string) < cur.oldest) cur.oldest = r.due_date as string;
    byLease.set(id, cur);
  }
  for (const [leaseId, info] of byLease) {
    if (info.arrears <= 0 || info.excluded) continue; // honour per-tenancy exclusion
    if (await alreadyNotified(supabase, "Rent Overdue", "lease_id", leaseId)) continue;
    const days = Math.floor((now.getTime() - new Date(info.oldest).getTime()) / 86400000);
    // Staged escalation by how long rent has been overdue.
    const stage = days >= 30 ? "30+ days overdue — escalate" : days >= 14 ? "14+ days overdue" : "now overdue";
    const label = `${info.tenant ?? "A tenant"} at ${info.property ?? "a property"}`;
    const amount = `£${info.arrears.toFixed(2)}`;
    await raise(supabase, staff, {
      type: "Rent Overdue",
      trigger: "cron",
      prefKey: "notify_overdue",
      lease_id: leaseId,
      message: `${label} — rent arrears ${amount} (${stage}).`,
      emailSubject: `Rent overdue (${stage}): ${label}`,
      emailHtml: `<p>${label} is in rent arrears of ${amount}. <strong>${stage}.</strong></p>`,
    });
    overdueCount++;
  }

  // 4) Leases ending within 60 days (heads-up to start renewal).
  let endingCount = 0;
  const horizon60 = new Date(now);
  horizon60.setUTCDate(horizon60.getUTCDate() + 60);
  const { data: ending } = await supabase
    .from("lease")
    .select("id, end_date, tenant:tenant_id(full_name), property:property_id(address)")
    .not("end_date", "is", null)
    .gte("end_date", todayStr)
    .lte("end_date", horizon60.toISOString().slice(0, 10));
  for (const l of ending ?? []) {
    if (await alreadyNotified(supabase, "Lease Ending Soon", "lease_id", l.id as string)) continue;
    const t = l.tenant as { full_name?: string } | { full_name?: string }[] | null;
    const p = l.property as { address?: string } | { address?: string }[] | null;
    const label = `${(Array.isArray(t) ? t[0]?.full_name : t?.full_name) ?? "A tenancy"} at ${(Array.isArray(p) ? p[0]?.address : p?.address) ?? "a property"}`;
    await raise(supabase, staff, {
      type: "Lease Ending Soon",
      trigger: "cron",
      prefKey: "notify_ending",
      lease_id: l.id as string,
      message: `${label} ends ${l.end_date}. Consider starting a renewal.`,
      emailSubject: "Lease ending soon",
      emailHtml: `<p>${label} ends ${l.end_date}. Consider starting a renewal.</p>`,
    });
    endingCount++;
  }

  // 5) Recurring reminders — roll a past-due occurrence forward to its next date.
  let rolledCount = 0;
  const { data: recurring } = await supabase
    .from("reminder")
    .select("id, alert_date, recurrence, recurrence_until")
    .neq("recurrence", "None")
    .not("alert_date", "is", null)
    .lt("alert_date", todayStr);
  for (const r of recurring ?? []) {
    const next = advanceDate(r.alert_date as string, r.recurrence as string, now);
    if (!next) continue;
    const until = r.recurrence_until as string | null;
    if (until && next > until) {
      // Series finished — stop recurring, leave the last occurrence completed.
      await supabase.from("reminder").update({ recurrence: "None", status: "Completed" }).eq("id", r.id);
    } else {
      await supabase
        .from("reminder")
        .update({ alert_date: next, status: "Pending", sent: false })
        .eq("id", r.id);
      rolledCount++;
    }
  }

  return {
    certifications: certCount,
    renewals: renewalCount,
    overdue: overdueCount,
    ending: endingCount,
    remindersRolled: rolledCount,
    staffNotified: staff.length,
  };
}

/** Advance a date string by a recurrence interval until it is >= today. */
function advanceDate(from: string, recurrence: string, now: Date): string | null {
  const d = new Date(from + "T00:00:00Z");
  const today = new Date(now.toISOString().slice(0, 10) + "T00:00:00Z");
  const step = (date: Date) => {
    switch (recurrence) {
      case "Daily": date.setUTCDate(date.getUTCDate() + 1); break;
      case "Weekly": date.setUTCDate(date.getUTCDate() + 7); break;
      case "Monthly": date.setUTCMonth(date.getUTCMonth() + 1); break;
      case "Yearly": date.setUTCFullYear(date.getUTCFullYear() + 1); break;
      default: return false;
    }
    return true;
  };
  let guard = 0;
  while (d < today && guard < 4000) {
    if (!step(d)) return null;
    guard++;
  }
  return d <= today && guard === 0 ? null : d.toISOString().slice(0, 10);
}
