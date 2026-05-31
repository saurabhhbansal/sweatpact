import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { sendPushToUser } from "@/lib/push";

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
    .select("id, username, notify_cycle_share")
    .ilike("username", username)
    .maybeSingle();

  if (!target) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }
  if (target.id === auth.user.id) {
    return NextResponse.json({ error: "cannot_share_self" }, { status: 400 });
  }

  // Only notify on a newly added grant, not a re-add of an existing one.
  const { data: existing } = await admin
    .from("period_sharing")
    .select("owner_id")
    .eq("owner_id", auth.user.id)
    .eq("shared_with_id", target.id)
    .maybeSingle();
  const isNew = existing == null;

  const { error } = await admin
    .from("period_sharing")
    .upsert(
      { owner_id: auth.user.id, shared_with_id: target.id },
      { onConflict: "owner_id,shared_with_id" }
    );
  if (error) {
    return NextResponse.json({ error: "db_error", detail: error.message }, { status: 500 });
  }

  // Notify the grantee. The recipient's `notify_cycle_share` preference governs
  // whether they receive it (defaults on); toggling it off opts them out entirely.
  if (isNew && target.notify_cycle_share !== false) {
    const { data: owner } = await admin
      .from("profiles")
      .select("username, name")
      .eq("id", auth.user.id)
      .maybeSingle();
    const ownerUsername = owner?.username ?? null;
    const ownerName = owner?.name ?? null;
    const ownerDisplay = ownerName?.trim() || (ownerUsername ? `@${ownerUsername}` : "Someone");

    await admin.from("notifications").insert({
      user_id: target.id,
      type: "cycle_share_granted",
      payload: {
        from_user: auth.user.id,
        from_username: ownerUsername,
        from_name: ownerName,
      },
    });

    await sendPushToUser(admin, target.id, {
      title: "Cycle data shared with you",
      body: `${ownerDisplay} shared their cycle data with you.`,
      url: ownerUsername ? `/u/${ownerUsername}` : "/notifications",
      tag: `cycle-share-${auth.user.id}`,
    });
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
