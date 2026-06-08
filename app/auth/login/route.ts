import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Server-side login. The form POSTs here natively; we sign in and set the
 * Supabase session cookies on a 303 redirect response (Secure in production).
 * Setting the cookie via the server's Set-Cookie header — rather than a
 * client-side document.cookie write — is what makes the session reliably
 * persist and resend across every browser (the prod login-bounce fix).
 */
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const nextRaw = String(form.get("next") ?? "");
  const next = nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/dashboard";

  const secure = process.env.NODE_ENV === "production";
  const fail = (msg: string) =>
    NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(msg)}`, request.url),
      { status: 303 },
    );

  if (!email || !password) return fail("Enter your email and password.");

  const response = NextResponse.redirect(new URL(next, request.url), { status: 303 });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) =>
          toSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, { ...options, secure }),
          ),
      },
      cookieOptions: { secure },
    },
  );

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return fail(error.message || "Unable to sign in. Check your details.");

  return response;
}
