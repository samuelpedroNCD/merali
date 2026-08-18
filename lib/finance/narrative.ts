// WS6 — Receipt narrative convention.
// The team types a details line on every receipt as "<Surname> <Initial> <Rent|
// Arrears>", where the word encodes tenancy status: "Rent" for a current tenant,
// "Arrears" for a former one (e.g. "Catwell N Arrears"). Pure + unit-tested.

import type { TenancyStatus } from "@/lib/tenancy-status";

/** "<Surname> <Initial> <Rent|Arrears>" — Rent for current/future, Arrears for past. */
export function buildNarrative(fullName: string | null | undefined, status: TenancyStatus): string {
  const word = status === "Past" ? "Arrears" : "Rent";
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return word;
  const surname = parts[parts.length - 1];
  const initial = parts.length > 1 ? parts[0][0].toUpperCase() : "";
  return `${surname}${initial ? " " + initial : ""} ${word}`;
}
