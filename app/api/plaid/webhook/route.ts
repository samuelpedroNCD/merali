import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { syncAll } from "@/lib/plaid/sync";

// Plaid webhook — public endpoint (no session). Uses the service-role client.
export async function POST(request: NextRequest) {
  let body: { webhook_type?: string; webhook_code?: string; item_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  if (
    body.webhook_type === "TRANSACTIONS" &&
    ["SYNC_UPDATES_AVAILABLE", "INITIAL_UPDATE", "DEFAULT_UPDATE", "HISTORICAL_UPDATE"].includes(
      body.webhook_code ?? "",
    )
  ) {
    try {
      const supabase = createServiceClient();
      await syncAll(supabase);
    } catch {
      /* swallow — Plaid retries webhooks */
    }
  }
  return NextResponse.json({ ok: true });
}
