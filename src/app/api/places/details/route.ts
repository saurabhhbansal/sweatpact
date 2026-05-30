import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const placeId = req.nextUrl.searchParams.get("place_id")?.trim();
  if (!placeId) return NextResponse.json({ error: "place_id required" }, { status: 400 });

  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return NextResponse.json({ error: "Maps not configured" }, { status: 500 });

  const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
  url.searchParams.set("place_id", placeId);
  url.searchParams.set("fields", "geometry,name,formatted_address");
  url.searchParams.set("key", key);

  const res = await fetch(url.toString());
  const data = await res.json();

  const loc = data.result?.geometry?.location;
  if (!loc) return NextResponse.json({ error: "Place not found" }, { status: 404 });

  return NextResponse.json({
    lat: loc.lat as number,
    lng: loc.lng as number,
    name: (data.result?.name ?? "") as string,
    address: (data.result?.formatted_address ?? "") as string,
  });
}
