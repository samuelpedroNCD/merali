import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Routes that never require a session. The cron job and Plaid webhook do their
// own auth (CRON_SECRET / Plaid), so they must bypass session enforcement.
const PUBLIC_PREFIXES = [
  "/login",
  "/forgot-password",
  "/reset-password",
  "/auth",
  "/api/cron",
  "/api/plaid/webhook",
];

// While building we can browse the app without a real session. Set
// AUTH_ENFORCED=true in env once staff users exist to lock it down.
const ENFORCED = process.env.AUTH_ENFORCED === "true";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          const secure = process.env.NODE_ENV === "production";
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, { ...options, secure }),
          );
        },
      },
      cookieOptions: { secure: process.env.NODE_ENV === "production" },
    },
  );

  // Gate on the session read from the cookie (no network call, no token
  // refresh) so a burst of concurrent requests (e.g. Next.js link prefetching
  // the whole sidebar) can't trigger a refresh race that wipes the cookie and
  // bounces every navigation to /login. Pages still call getUser() for trusted
  // validation, so a forged cookie won't grant access to data.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));

  // Signed-in users shouldn't sit on the login page.
  if (user && pathname.startsWith("/login")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Protect app routes only when enforcement is on.
  if (ENFORCED && !user && !isPublic) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|assets|.*\\.(?:png|jpg|jpeg|svg|avif|ico)$).*)"],
};
