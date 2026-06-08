import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client — bypasses RLS, no user session.
 * Server-only: never import into client components. Used by webhooks,
 * cron jobs, and admin operations (e.g. inviting staff).
 */
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
