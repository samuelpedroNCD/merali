import { redirect } from "next/navigation";
import { requireUser, can } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getTrialBalance } from "@/lib/data/nominal-ledger";
import { listEntities } from "@/lib/data/bank-accounts";
import { TrialBalanceClient } from "./trial-balance-client";

export default async function TrialBalancePage({
  searchParams,
}: {
  searchParams: Promise<{ asOf?: string; landlord?: string; entity?: string }>;
}) {
  const user = await requireUser();
  if (!can(user, "finance", "view")) redirect("/dashboard");

  const sp = await searchParams;
  const asOf = sp.asOf || new Date().toISOString().slice(0, 10);
  const landlordId = sp.landlord || null;
  const entityId = sp.entity || null;

  const supabase = await createClient();
  const [tb, landlordRows, entities] = await Promise.all([
    getTrialBalance({ asOf, landlordId, entityId }),
    supabase.from("landlord").select("id, full_name").order("full_name", { ascending: true }),
    listEntities(),
  ]);
  const landlords = (landlordRows.data ?? []).map((l) => ({ value: l.id as string, label: (l.full_name as string) || "—" }));

  return (
    <TrialBalanceClient
      tb={tb}
      asOf={asOf}
      landlordId={landlordId}
      entityId={entityId}
      landlords={landlords}
      entities={entities}
    />
  );
}
