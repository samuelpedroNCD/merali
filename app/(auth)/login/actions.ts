"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Sign in on the server so the session cookie is set via the response
 * Set-Cookie header (which the browser always persists), rather than relying
 * on a client-side document.cookie write that can fail to reach the server on
 * the first navigation. On success this redirects; on failure it returns the error.
 */
export async function signIn(
  formData: FormData,
): Promise<{ error: string } | void> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const nextRaw = String(formData.get("next") ?? "");
  // only allow internal redirects
  const next = nextRaw.startsWith("/") ? nextRaw : "/dashboard";

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: error.message || "Unable to sign in. Check your details." };
  }

  redirect(next);
}
