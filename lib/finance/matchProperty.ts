// Best-effort match of a bank transaction to a property by its internal code.
// Pure + testable. Used on Plaid import to pre-assign a property when its code
// appears in the bank reference / merchant text. Conservative: only codes of 3+
// characters, matched on token boundaries, longest code first (so "MC-A1" wins
// over "MC"). Returns the property id or null.

export type CodedProperty = { id: string; internal_code: string | null };

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function matchPropertyByCode(text: string | null | undefined, properties: CodedProperty[]): string | null {
  if (!text) return null;
  const haystack = text.toLowerCase();
  const candidates = properties
    .filter((p) => (p.internal_code ?? "").trim().length >= 3)
    .sort((a, b) => (b.internal_code!.length - a.internal_code!.length));
  for (const p of candidates) {
    const code = p.internal_code!.trim().toLowerCase();
    // Token boundary: not flanked by another alphanumeric (so codes don't match mid-word).
    const re = new RegExp(`(^|[^a-z0-9])${esc(code)}([^a-z0-9]|$)`, "i");
    if (re.test(haystack)) return p.id;
  }
  return null;
}
