import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data } = await supabase
    .from("user_gyms")
    .select("id, name, address, lat, lng, radius_m, created_at")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: true });

  return NextResponse.json({ gyms: data ?? [] });
}

const Body = z.object({
  name: z.string().min(1).max(120),
  address: z.string().max(300).optional(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radius_m: z.number().int().min(20).max(5000).optional(),
});

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { name, address, lat, lng, radius_m } = parsed.data;
  const { data, error } = await supabase
    .from("user_gyms")
    .insert({
      user_id: auth.user.id,
      name,
      address: address ?? null,
      lat,
      lng,
      radius_m: radius_m ?? 50,
    })
    .select("id, name, address, lat, lng, radius_m, created_at")
    .single();

  if (error) {
    return NextResponse.json(
      { error: "db_error", detail: error.message },
      { status: 500 }
    );
  }
  revalidateTag(`gyms:${auth.user.id}`);
  return NextResponse.json({ ok: true, gym: data });
}
