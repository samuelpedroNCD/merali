// Pure rent due-date engine — shared by the server (syncRentSchedule) and the
// client (the form's worked-example preview), so the preview always matches what
// gets written. No imports → safe to use anywhere. All maths is in UTC to avoid
// timezone drift on date-only values.

export type DueDateOptions = {
  start: string | null;            // rent commencement (YYYY-MM-DD)
  end: string | null;              // tenancy end, or null for open-ended
  frequency: string | null;        // Weekly | Fortnightly | Monthly | Quarterly | Annually | Custom
  timing?: string | null;          // Advance (period start) | Arrears (period end)
  quarterType?: string | null;     // English | Calendar (Quarterly only)
  dueWeekday?: number | null;      // 0=Sun..6=Sat (Weekly/Fortnightly)
  dueDom?: number | null;          // 1..31 (Monthly/Quarterly/Annually)
  customDates?: string[] | null;   // explicit dates (Custom)
  horizon?: number;                // periods ahead when open-ended (default 24)
};

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);
const iso = (dt: Date) => dt.toISOString().slice(0, 10);
const addDays = (dt: Date, n: number) => { const x = new Date(dt); x.setUTCDate(x.getUTCDate() + n); return x; };
const daysInMonth = (y: number, mIdx: number) => new Date(Date.UTC(y, mIdx + 1, 0)).getUTCDate();
const monthDate = (y: number, mIdx: number, dom: number) => new Date(Date.UTC(y, mIdx, Math.min(dom, daysInMonth(y, mIdx))));

// English quarter days (Lady Day, Midsummer, Michaelmas, Christmas) and calendar quarters.
const ENGLISH_Q = [{ m: 2, day: 25 }, { m: 5, day: 24 }, { m: 8, day: 29 }, { m: 11, day: 25 }];
const CALENDAR_Q = [{ m: 0, day: 1 }, { m: 3, day: 1 }, { m: 6, day: 1 }, { m: 9, day: 1 }];

/** Ordered list of period-start dates from the anchor, enough to cover the term (+1 spare for arrears). */
function periodStarts(o: DueDateOptions, start: Date, end: Date | null, horizon: number): Date[] {
  const out: Date[] = [];
  const within = (dt: Date) => (end ? dt <= addDays(end, 31) : out.length < horizon + 2);
  const freq = o.frequency || "Monthly";

  if (freq === "Weekly" || freq === "Fortnightly") {
    const step = freq === "Weekly" ? 7 : 14;
    const wd = o.dueWeekday ?? start.getUTCDay();
    let cur = addDays(start, (wd - start.getUTCDay() + 7) % 7);
    while (within(cur) && out.length < 600) { out.push(cur); cur = addDays(cur, step); }
    return out;
  }

  if (freq === "Quarterly") {
    const set = (o.quarterType === "Calendar") ? CALENDAR_Q : ENGLISH_Q;
    for (let y = start.getUTCFullYear(); within(new Date(Date.UTC(y, 0, 1))) && out.length < 600; y++) {
      for (const q of set) {
        const dt = monthDate(y, q.m, q.day);
        if (dt >= start && within(dt)) out.push(dt);
      }
      if (end && new Date(Date.UTC(y, 11, 31)) > addDays(end, 31)) break;
      if (!end && out.length >= horizon + 2) break;
    }
    return out.sort((a, b) => a.getTime() - b.getTime());
  }

  // Monthly / Annually — anchor on a day-of-month, step 1 or 12 months.
  const stepMonths = freq === "Annually" ? 12 : 1;
  const dom = o.dueDom ?? start.getUTCDate();
  let y = start.getUTCFullYear();
  let mIdx = start.getUTCMonth();
  let first = monthDate(y, mIdx, dom);
  if (first < start) { const n = new Date(Date.UTC(y, mIdx + stepMonths, 1)); y = n.getUTCFullYear(); mIdx = n.getUTCMonth(); }
  for (let k = 0; out.length < 600; k++) {
    const base = new Date(Date.UTC(y, mIdx + k * stepMonths, 1));
    const dt = monthDate(base.getUTCFullYear(), base.getUTCMonth(), dom);
    if (!within(dt)) break;
    out.push(dt);
  }
  return out;
}

/** Due dates for a tenancy's rent, honouring frequency, advance/arrears, quarter type and anchors. */
export function computeDueDates(o: DueDateOptions): string[] {
  if (!o.start) return [];
  const horizon = o.horizon ?? 24;

  if ((o.frequency || "") === "Custom") {
    return [...new Set((o.customDates ?? []).filter(Boolean))]
      .filter((x) => x >= o.start! && (!o.end || x <= o.end))
      .sort();
  }

  const start = d(o.start);
  const end = o.end ? d(o.end) : null;
  const starts = periodStarts(o, start, end, horizon);

  const arrears = (o.timing || "Advance") === "Arrears";
  const due: string[] = [];
  for (let i = 0; i < starts.length; i++) {
    if (arrears) {
      const next = starts[i + 1];
      if (!next) break;
      due.push(iso(addDays(next, -1)));
    } else {
      due.push(iso(starts[i]));
    }
  }
  return [...new Set(due)]
    .filter((x) => x >= o.start! && (!o.end || x <= o.end))
    .sort()
    .slice(0, 600);
}
