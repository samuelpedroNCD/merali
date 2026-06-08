import { NextResponse } from "next/server";
import { CountryCode, Products } from "plaid";
import { plaidClient } from "@/lib/plaid/client";
import { requireUser } from "@/lib/auth";

export async function POST() {
  const user = await requireUser();
  try {
    const appUrl = process.env.APP_URL; // e.g. https://merali.vercel.app
    const res = await plaidClient.linkTokenCreate({
      user: { client_user_id: user.userId },
      client_name: "Merali Lettings",
      products: [Products.Transactions],
      country_codes: [CountryCode.Gb],
      language: "en",
      // Register the webhook for automatic transaction sync in production.
      ...(appUrl ? { webhook: `${appUrl}/api/plaid/webhook` } : {}),
    });
    return NextResponse.json({ link_token: res.data.link_token });
  } catch (e) {
    const err = e as { response?: { data?: unknown }; message?: string };
    return NextResponse.json(
      { error: err.response?.data ?? err.message ?? "link token failed" },
      { status: 502 },
    );
  }
}
