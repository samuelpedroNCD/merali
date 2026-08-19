import { redirect } from "next/navigation";
import { requireUser, can } from "@/lib/auth";
import { getVatReturn, getVatReturnTransactions } from "@/lib/data/vat-return";
import { listEntities } from "@/lib/data/bank-accounts";
import { VatReturnClient } from "./vat-return-client";

export default async function VatReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; entity?: string }>;
}) {
  const user = await requireUser();
  if (!can(user, "finance", "view")) redirect("/dashboard");

  const sp = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const d = new Date();
  d.setMonth(d.getMonth() - 3);
  d.setDate(1);
  const from = sp.from || d.toISOString().slice(0, 10);
  const to = sp.to || today;
  const entityId = sp.entity || null;

  const [ret, txns, entities] = await Promise.all([
    getVatReturn({ from, to, entityId }),
    getVatReturnTransactions({ from, to, entityId }),
    listEntities(),
  ]);

  return <VatReturnClient ret={ret} txns={txns} from={from} to={to} entityId={entityId} entities={entities} />;
}
