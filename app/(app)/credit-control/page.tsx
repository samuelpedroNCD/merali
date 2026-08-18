import { redirect } from "next/navigation";
import { requireUser, can } from "@/lib/auth";
import { getTenancyBalances } from "@/lib/data/credit-control";
import { emailEnabled } from "@/lib/email/send";
import { CreditControlClient } from "./credit-control-client";

export default async function CreditControlPage() {
  const user = await requireUser();
  if (!can(user, "finance", "view")) redirect("/dashboard");

  const balances = await getTenancyBalances();
  return (
    <CreditControlClient
      balances={balances}
      canEdit={can(user, "finance", "edit")}
      emailOn={emailEnabled()}
    />
  );
}
