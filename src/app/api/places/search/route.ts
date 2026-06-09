import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) return NextResponse.json({ predictions: [] });

  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "maps_not_configured", predictions: [] },
      { status: 500 }
    );
  }

  const url = new URL("https://maps.googleapis.com/maps/api/place/autocomplete/json");
  url.searchParams.set("input", q);
  // No `types` restriction — let users search businesses OR addresses.
  url.searchParams.set("key", key);

  const res = await fetch(url.toString());
  const data = await res.json();

  if (data.status && data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    console.error("Google Places autocomplete error", {
      status: data.status,
      error_message: data.error_message,
    });
    return NextResponse.json(
      {
        error: "places_api_error",
        google_status: data.status,
        google_message: data.error_message ?? null,
        predictions: [],
      },
      { status: 502 }
    );
  }

  return NextResponse.json({
    predictions: (data.predictions ?? []).map((p: {
      place_id: string;
      description: string;
      structured_formatting: { main_text: string; secondary_text?: string };
    }) => ({
      place_id: p.place_id,
      description: p.description,
      main_text: p.structured_formatting.main_text,
      secondary_text: p.structured_formatting.secondary_text ?? "",
    })),
  });
}
