import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(
    new URL("/login", process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
    { status: 303 }
  );
}
