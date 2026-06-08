import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";

// Server-side proxy for Google Places (New). Keeps the API key off the client,
// restricts to the UK, and uses session tokens to bundle billing.
const KEY = process.env.GOOGLE_PLACES_API_KEY;

type Component = { longText: string; shortText: string; types: string[] };

function pick(components: Component[], type: string, short = false) {
  const c = components.find((x) => x.types.includes(type));
  return c ? (short ? c.shortText : c.longText) : "";
}

export async function GET(request: NextRequest) {
  // Staff-only endpoint.
  await requireUser();
  if (!KEY) {
    return NextResponse.json({ error: "Places not configured" }, { status: 500 });
  }

  const { searchParams } = request.nextUrl;
  const action = searchParams.get("action");
  const token = searchParams.get("token") ?? undefined;

  try {
    if (action === "autocomplete") {
      const input = searchParams.get("input") ?? "";
      if (input.trim().length < 3) return NextResponse.json({ suggestions: [] });

      const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Goog-Api-Key": KEY },
        body: JSON.stringify({
          input,
          includedRegionCodes: ["gb"],
          ...(token ? { sessionToken: token } : {}),
        }),
      });
      const data = await res.json();
      const suggestions = (data.suggestions ?? [])
        .map((s: { placePrediction?: { placeId: string; text?: { text: string } } }) => s.placePrediction)
        .filter(Boolean)
        .map((p: { placeId: string; text?: { text: string } }) => ({
          placeId: p.placeId,
          description: p.text?.text ?? "",
        }));
      return NextResponse.json({ suggestions });
    }

    if (action === "details") {
      const placeId = searchParams.get("placeId");
      if (!placeId) return NextResponse.json({ error: "placeId required" }, { status: 400 });

      const url = new URL(`https://places.googleapis.com/v1/places/${placeId}`);
      if (token) url.searchParams.set("sessionToken", token);
      const res = await fetch(url, {
        headers: {
          "X-Goog-Api-Key": KEY,
          "X-Goog-FieldMask": "formattedAddress,addressComponents",
        },
      });
      const data = await res.json();
      const comp: Component[] = data.addressComponents ?? [];

      const streetNumber = pick(comp, "street_number");
      const route = pick(comp, "route");
      const line = [streetNumber, route].filter(Boolean).join(" ");

      return NextResponse.json({
        address: data.formattedAddress ?? line,
        flat: pick(comp, "subpremise"),
        town: pick(comp, "postal_town") || pick(comp, "locality"),
        area:
          pick(comp, "administrative_area_level_2") ||
          pick(comp, "administrative_area_level_1"),
        postCode: pick(comp, "postal_code"),
        country: pick(comp, "country") || "United Kingdom",
        placeId,
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
