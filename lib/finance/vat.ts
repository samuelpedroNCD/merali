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
