import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { syncAll } from "@/lib/plaid/sync";

export async function POST() {
  await requireUser();
  try {
    const supabase = await createClient();
    const result = await syncAll(supabase);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
