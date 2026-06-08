import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Logout is POST-only on purpose: a GET here is prefetchable, and the browser
 * prefetching the sidebar logout link silently signed users out — wiping the
 * session on every navigation. A POST form submit cannot be prefetched.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
