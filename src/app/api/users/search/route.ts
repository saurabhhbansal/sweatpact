import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!(await rateLimit(supabase, `user-search:${auth.user.id}`, 30, 60))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const raw = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  // Strip characters that have special meaning in PostgREST or LIKE patterns.
  const q = raw.replace(/[%_,()]/g, "");
  if (q.length < 2) {
    return NextResponse.json({ users: [] });
  }

  const { data } = await supabase
    .from("profiles")
    .select("id, username, name, profile_visibility, avatar_url")
    .or(`username.ilike.${q}%,name.ilike.%${q}%`)
    .neq("id", auth.user.id)
    .not("username", "is", null)
    .not("username", "ilike", "user_%")
    .limit(10);

  return NextResponse.json({ users: data ?? [] });
}
