// WS2 — Receipt batch totals (pure, so it is unit-testable and shared by the
// server reader and the batch UI).

export type BatchLine = { amount_gross: number | null };

export type BatchTotals = {
  total: number;              // running total of the batch's receipts
  count: number;
  leftToApply: number | null; // expected − total (null when no expected total set)
};

const r2 = (n: number) => Math.round(n * 100) / 100;

export function batchTotals(lines: BatchLine[], expectedTotal: number | null | undefined): BatchTotals {
  const total = r2(lines.reduce((a, l) => a + Number(l.amount_gross ?? 0), 0));
  const expected = expectedTotal == null ? null : Number(expectedTotal);
  return {
    total,
    count: lines.length,
    leftToApply: expected == null ? null : r2(expected - total),
  };
}
