import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  username: z.string().min(3).max(20),
});

// GET — list usernames the caller currently shares their cycle data with.
export async function GET() {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("period_sharing")
    .select("shared_with_id, profiles:shared_with_id(username)")
    .eq("owner_id", auth.user.id)
    .order("created_at", { ascending: true });

  const shares = (rows ?? []).map((r) => {
    const rel = r.profiles as { username: string | null } | { username: string | null }[] | null;
    const username = Array.isArray(rel) ? rel[0]?.username ?? null : rel?.username ?? null;
    return { userId: r.shared_with_id, username };
  });

  return NextResponse.json({ shares });
}

// POST { username } — grant a user access to the caller's cycle data.
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }
  const username = parsed.data.username.toLowerCase();

  const admin = createAdminClient();
  const { data: target } = await admin
    .from("profiles")
    .select("id, username")
    .ilike("username", username)
    .maybeSingle();

  if (!target) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }
  if (target.id === auth.user.id) {
    return NextResponse.json({ error: "cannot_share_self" }, { status: 400 });
  }

  const { error } = await admin
    .from("period_sharing")
    .upsert(
      { owner_id: auth.user.id, shared_with_id: target.id },
      { onConflict: "owner_id,shared_with_id" }
    );
  if (error) {
    return NextResponse.json({ error: "db_error", detail: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, username: target.username });
}

// DELETE { username } — revoke a user's access.
export async function DELETE(req: NextRequest) {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }
  const username = parsed.data.username.toLowerCase();

  const admin = createAdminClient();
  const { data: target } = await admin
    .from("profiles")
    .select("id")
    .ilike("username", username)
    .maybeSingle();

  if (!target) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }

  await admin
    .from("period_sharing")
    .delete()
    .eq("owner_id", auth.user.id)
    .eq("shared_with_id", target.id);

  return NextResponse.json({ ok: true });
}
