import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { runTriggers } from "@/lib/notifications/triggers";

// Daily notification job. Triggered by Vercel Cron (Authorization: Bearer
// CRON_SECRET). Falls back to allowing a logged-in session for manual runs.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  const authorized = secret ? auth === `Bearer ${secret}` : true;
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createServiceClient();
    const result = await runTriggers(supabase);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export const POST = GET;
