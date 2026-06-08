import { createClient } from "@/lib/supabase/server";

export type FinanceData = {
  totalIncome: number;
  totalOutgoings: number;
  netCashflow: number;
  vatCollected: number;
  vatPaid: number;
  vatNet: number;
  rentExpected: number;
  rentCollected: number;
  rentCollectedPct: number;
  overdue: number;
  vatByQuarter: { quarter: string; collected: number; paid: number; net: number }[];
  cashflow: { month: string; income: number; expense: number }[];
  recent: {
    id: string;
    date: string | null;
    property: string | null;
    type: string | null;
    category: string | null;
    gross: number;
    status: string | null;
  }[];
};

export async function getFinanceData(now = new Date()): Promise<FinanceData> {
  const supabase = await createClient();

  const { data: txns } = await supabase
    .from("transaction")
    .select("id, txn_date, type, category, amount_gross, vat_amount, status, property:property_id(address)")
    .order("txn_date", { ascending: false })
    .limit(500);

  let totalIncome = 0,
    totalOutgoings = 0,
    vatCollected = 0,
    vatPaid = 0;
  const vatQ = new Map<string, { collected: number; paid: number }>();
  for (const t of txns ?? []) {
    const g = Number(t.amount_gross ?? 0);
    const v = Number(t.vat_amount ?? 0);
    const isIncome = t.type === "Income";
    if (isIncome) {
      totalIncome += g;
      vatCollected += v;
    } else {
      totalOutgoings += g;
      vatPaid += v;
    }
    if (t.txn_date) {
      const d = new Date(t.txn_date as string);
      const q = `${d.getUTCFullYear()} Q${Math.floor(d.getUTCMonth() / 3) + 1}`;
      const cur = vatQ.get(q) ?? { collected: 0, paid: 0 };
      if (isIncome) cur.collected += v;
      else cur.paid += v;
      vatQ.set(q, cur);
    }
  }
  const vatByQuarter = [...vatQ.entries()]
    .map(([quarter, x]) => ({ quarter, collected: x.collected, paid: x.paid, net: x.collected - x.paid }))
    .sort((a, b) => (a.quarter < b.quarter ? 1 : -1))
    .slice(0, 8);

  // Cashflow by month for the last 6 months.
  const months: { key: string; month: string; income: number; expense: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    months.push({
      key: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`,
      month: d.toLocaleString("en-GB", { month: "short" }),
      income: 0,
      expense: 0,
    });
  }
  const monthIdx = new Map(months.map((m, i) => [m.key, i]));
  for (const t of txns ?? []) {
    if (!t.txn_date) continue;
    const key = (t.txn_date as string).slice(0, 7);
    const idx = monthIdx.get(key);
    if (idx == null) continue;
    const g = Number(t.amount_gross ?? 0);
    if (t.type === "Income") months[idx].income += g;
    else months[idx].expense += g;
  }

  // Rent from schedule.
  const { data: sched } = await supabase
    .from("rent_schedule")
    .select("amount_due, amount_collected, invoice_status, due_date");
  let rentExpected = 0,
    rentCollected = 0,
    overdue = 0;
  const todayStr = now.toISOString().slice(0, 10);
  for (const r of sched ?? []) {
    const due = Number(r.amount_due ?? 0);
    const got = Number(r.amount_collected ?? 0);
    rentExpected += due;
    rentCollected += got;
    if (r.invoice_status !== "Paid" && (r.due_date as string) < todayStr) {
      overdue += due - got;
    }
  }

  const recent = (txns ?? []).slice(0, 8).map((t) => {
    const p = t.property as { address?: string } | { address?: string }[] | null;
    return {
      id: t.id as string,
      date: (t.txn_date as string) ?? null,
      property: (Array.isArray(p) ? p[0]?.address : p?.address) ?? null,
      type: (t.type as string) ?? null,
      category: (t.category as string) ?? null,
      gross: Number(t.amount_gross ?? 0),
      status: (t.status as string) ?? null,
    };
  });

  return {
    totalIncome,
    totalOutgoings,
    netCashflow: totalIncome - totalOutgoings,
    vatCollected,
    vatPaid,
    vatNet: vatCollected - vatPaid,
    vatByQuarter,
    rentExpected,
    rentCollected,
    rentCollectedPct:
      rentExpected > 0 ? Math.round((rentCollected / rentExpected) * 100) : 0,
    overdue,
    cashflow: months.map((m) => ({ month: m.month, income: m.income, expense: m.expense })),
    recent,
  };
}
