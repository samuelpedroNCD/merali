import { NextResponse, type NextRequest } from "next/server";
import { plaidClient } from "@/lib/plaid/client";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { syncItem } from "@/lib/plaid/sync";
import { encryptField } from "@/lib/crypto/secrets";

export async function POST(request: NextRequest) {
  const user = await requireUser();
  const { public_token } = await request.json();
  if (!public_token) {
    return NextResponse.json({ error: "public_token required" }, { status: 400 });
  }

  try {
    const exchange = await plaidClient.itemPublicTokenExchange({ public_token });
    const access_token = exchange.data.access_token;
    const item_id = exchange.data.item_id;

    // Institution + accounts
    const accounts = await plaidClient.accountsGet({ access_token });
    const institution =
      accounts.data.item.institution_id ?? "Bank";
    const first = accounts.data.accounts[0];

    const supabase = await createClient();
    const { data: bank } = await supabase
      .from("bank_account")
      .insert({
        plaid_item_id: item_id,
        access_token: encryptField(access_token),
        institution,
        account_name: first?.name ?? null,
        account_mask: first?.mask ?? null,
        account_type: first?.type ?? null,
        account_subtype: first?.subtype ?? null,
        plaid_account_id: first?.account_id ?? null,
        user_id: user.userId,
      })
      .select("id, access_token, institution, transactions_cursor")
      .single();

    let synced = { added: 0, modified: 0, removed: 0 };
    if (bank) {
      try {
        // Use the in-memory plaintext token for the immediate sync (the stored one is encrypted).
        synced = await syncItem(supabase, { ...bank, access_token });
      } catch {
        /* initial sync can lag in sandbox; webhook/manual sync will catch up */
      }
    }

    return NextResponse.json({ ok: true, institution, synced });
  } catch (e) {
    const err = e as { response?: { data?: unknown }; message?: string };
    return NextResponse.json(
      { error: err.response?.data ?? err.message ?? "exchange failed" },
      { status: 502 },
    );
  }
}
