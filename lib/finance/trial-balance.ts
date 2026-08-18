// WS12 — Trial balance, computed from WS11 journal lines.
// Pure aggregation so it is unit-testable; the server reader
// (lib/data/nominal-ledger.ts) feeds it rows from journal_line.

export type TBInputLine = {
  nominal_id: string;
  code: string;
  name: string;
  nominal_class: string | null; // Asset | Liability | Income | Expense | Equity
  debit: number;
  credit: number;
};

export type TrialBalanceRow = {
  nominal_id: string;
  code: string;
  name: string;
  nominal_class: string | null;
  debit: number;   // display: net debit balance (0 if the account is in credit)
  credit: number;  // display: net credit balance (0 if in debit)
  balance: number; // signed: debit − credit
};

export type TrialBalance = {
  rows: TrialBalanceRow[];
  totalDebit: number;
  totalCredit: number;
  balanced: boolean; // totalDebit === totalCredit (to the penny)
};

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Aggregate journal lines into a trial balance: one row per nominal, each with
 * its net balance shown in the debit OR credit column. Rows with a net of zero
 * are dropped. Ordered by nominal code. Over a complete ledger the two column
 * totals are equal (balanced); a filtered/activity view may not balance.
 */
export function aggregateTrialBalance(lines: TBInputLine[]): TrialBalance {
  const byNominal = new Map<string, TrialBalanceRow>();
  for (const l of lines) {
    const row = byNominal.get(l.nominal_id) ?? {
      nominal_id: l.nominal_id,
      code: l.code,
      name: l.name,
      nominal_class: l.nominal_class,
      debit: 0,
      credit: 0,
      balance: 0,
    };
    row.balance = r2(row.balance + Number(l.debit ?? 0) - Number(l.credit ?? 0));
    byNominal.set(l.nominal_id, row);
  }

  const rows: TrialBalanceRow[] = [];
  let totalDebit = 0;
  let totalCredit = 0;
  for (const row of byNominal.values()) {
    if (row.balance === 0) continue; // net-zero accounts don't appear on a TB
    row.debit = row.balance > 0 ? row.balance : 0;
    row.credit = row.balance < 0 ? -row.balance : 0;
    totalDebit = r2(totalDebit + row.debit);
    totalCredit = r2(totalCredit + row.credit);
    rows.push(row);
  }
  rows.sort((a, b) => a.code.localeCompare(b.code));

  return {
    rows,
    totalDebit,
    totalCredit,
    balanced: r2(totalDebit - totalCredit) === 0,
  };
}
