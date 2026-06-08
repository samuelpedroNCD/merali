import { createBrowserClient } from "@supabase/ssr";

/** Browser Supabase client (publishable/anon key). */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookieOptions: { secure: process.env.NODE_ENV === "production" } },
  );
}
