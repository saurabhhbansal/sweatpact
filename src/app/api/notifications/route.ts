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

  // The lightweight poll (nav badge) omits ?full; the notifications overlay
  // passes ?full=1 to also receive the pending sent invitations.
  const full = new URL(req.url).searchParams.get("full") === "1";

  const [{ data }, { data: profile }] = await Promise.all([
    supabase
      .from("notifications")
      .select("id, type, payload, read_at, created_at")
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("profiles").select("gender").eq("id", auth.user.id).maybeSingle(),
  ]);

  const unreadCount = (data ?? []).filter((n) => !n.read_at).length;

  let sentInvitations:
    | {
        id: string;
        to_user: string;
        to_username: string | null;
        to_name: string | null;
        penalty_cents: number;
        message: string | null;
        created_at: string;
      }[]
    | undefined;
  if (full) {
    const { data: invs } = await supabase
      .from("challenge_invitations")
      .select("id, to_user, penalty_cents, message, created_at")
      .eq("from_user", auth.user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    const toIds = (invs ?? []).map((i) => i.to_user);
    const { data: targets } = toIds.length
      ? await supabase.from("profiles").select("id, name, username").in("id", toIds)
      : { data: [] };
    sentInvitations = (invs ?? []).map((inv) => {
      const t = (targets ?? []).find((p) => p.id === inv.to_user);
      return {
        id: inv.id,
        to_user: inv.to_user,
        to_username: t?.username ?? null,
        to_name: t?.name ?? null,
        penalty_cents: inv.penalty_cents,
        message: inv.message,
        created_at: inv.created_at,
      };
    });
  }

  return NextResponse.json({
    notifications: data ?? [],
    unreadCount,
    gender: profile?.gender ?? null,
    sentInvitations,
  });
}

export async function PATCH(req: NextRequest) {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const ids: string[] | undefined = body?.ids;
  const all: boolean = body?.all === true;

  if (all) {
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", auth.user.id)
      .is("read_at", null);
    return NextResponse.json({ ok: true });
  }

  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 100) {
    return NextResponse.json({ error: "no_ids" }, { status: 400 });
  }
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", auth.user.id)
    .in("id", ids);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const ids: string[] | undefined = body?.ids;
  const all: boolean = body?.all === true;

  if (all) {
    await supabase
      .from("notifications")
      .delete()
      .eq("user_id", auth.user.id);
    return NextResponse.json({ ok: true });
  }

  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 100) {
    return NextResponse.json({ error: "no_ids" }, { status: 400 });
  }
  await supabase
    .from("notifications")
    .delete()
    .eq("user_id", auth.user.id)
    .in("id", ids);
  return NextResponse.json({ ok: true });
}
