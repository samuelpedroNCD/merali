const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Split a gross (VAT-inclusive) amount into net + VAT at the given rate.
 * Rate is a percentage (0, 5, 20). At 0% net === gross.
 */
export function computeVatFromGross(gross: number, ratePct: number) {
  const net = ratePct > 0 ? gross / (1 + ratePct / 100) : gross;
  const vat = gross - net;
  return { net: round2(net), vat: round2(vat), gross: round2(gross) };
}

// WS13 — VAT return from journal lines. VAT control (nominal 2200) carries output
// VAT as credits (income) and input VAT as debits (expenses); Income/Expense-class
// nominals carry the net sales/purchases. UK boxes; 2/3/8/9 are 0 (domestic only).
export type VatReturnLine = {
  is_vat_control: boolean;
  nominal_class: string | null; // Income | Expense | Asset | Liability | Equity
  debit: number;
  credit: number;
};

export type VatReturn = {
  box1: number; // VAT due on sales (output VAT)
  box4: number; // VAT reclaimed on purchases (input VAT)
  box5: number; // net VAT: box1 − box4 (positive = payable, negative = reclaim)
  box6: number; // total sales, ex VAT
  box7: number; // total purchases, ex VAT
};

export function computeVatReturn(lines: VatReturnLine[]): VatReturn {
  let box1 = 0, box4 = 0, box6 = 0, box7 = 0;
  for (const l of lines) {
    const d = Number(l.debit ?? 0);
    const c = Number(l.credit ?? 0);
    if (l.is_vat_control) {
      box1 += c; // output VAT
      box4 += d; // input VAT
    } else if (l.nominal_class === "Income") {
      box6 += c - d; // net sales
    } else if (l.nominal_class === "Expense") {
      box7 += d - c; // net purchases
    }
  }
  box1 = round2(box1); box4 = round2(box4); box6 = round2(box6); box7 = round2(box7);
  return { box1, box4, box5: round2(box1 - box4), box6, box7 };
}
