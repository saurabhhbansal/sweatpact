import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;
const RESERVED = new Set([
  "admin",
  "root",
  "support",
  "help",
  "api",
  "auth",
  "login",
  "signup",
  "dashboard",
  "settings",
  "groups",
  "challenges",
  "notifications",
  "history",
  "u",
  "user",
  "users",
  "me",
  "sweatpact",
]);

export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const raw = req.nextUrl.searchParams.get("u")?.trim() ?? "";
  if (!USERNAME_RE.test(raw)) {
    return NextResponse.json({
      available: false,
      reason: "invalid_format",
    });
  }
  if (RESERVED.has(raw.toLowerCase())) {
    return NextResponse.json({ available: false, reason: "reserved" });
  }

  const { data } = await supabase
    .from("profiles")
    .select("id")
    .ilike("username", raw)
    .neq("id", auth.user.id)
    .maybeSingle();

  if (data) {
    return NextResponse.json({ available: false, reason: "taken" });
  }
  return NextResponse.json({ available: true });
}
