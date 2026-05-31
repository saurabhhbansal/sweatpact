import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

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
  return NextResponse.json({
    notifications: data ?? [],
    unreadCount,
    gender: profile?.gender ?? null,
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

  if (!Array.isArray(ids) || ids.length === 0) {
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

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "no_ids" }, { status: 400 });
  }
  await supabase
    .from("notifications")
    .delete()
    .eq("user_id", auth.user.id)
    .in("id", ids);
  return NextResponse.json({ ok: true });
}
