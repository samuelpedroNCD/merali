import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { syncAll } from "@/lib/plaid/sync";

// Scheduled bank-feed sync + auto-reconcile (Vercel Cron). Guarded by
// CRON_SECRET; the proxy exempts /api/cron from session enforcement.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!process.env.PLAID_CLIENT_ID) {
    return NextResponse.json({ ok: true, skipped: "plaid not configured" });
  }
  try {
    const supabase = createServiceClient();
    const result = await syncAll(supabase);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export const POST = GET;
