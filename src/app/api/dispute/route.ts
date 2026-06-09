import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getMembership } from "@/lib/groups";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  target_type: z.enum(["checkin", "obligation", "penalty_event"]),
  target_id: z.string().uuid(),
  group_id: z.string().uuid().optional(),
  reason: z.string().min(2).max(2000),
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

  const { target_type, target_id, reason } = parsed.data;
  let groupId: string | null = parsed.data.group_id ?? null;

  if (!groupId && target_type === "checkin") {
    const { data } = await supabase
      .from("checkin_events")
      .select("group_id")
      .eq("id", target_id)
      .maybeSingle();
    groupId = data?.group_id ?? null;
  } else if (!groupId && target_type === "obligation") {
    const { data } = await supabase
      .from("obligations")
      .select("group_id")
      .eq("id", target_id)
      .maybeSingle();
    groupId = data?.group_id ?? null;
  } else if (!groupId && target_type === "penalty_event") {
    const { data } = await supabase
      .from("penalty_events")
      .select("group_id")
      .eq("id", target_id)
      .maybeSingle();
    groupId = data?.group_id ?? null;
  }

  if (!groupId) {
    return NextResponse.json({ error: "target_not_found" }, { status: 404 });
  }

  const membership = await getMembership(supabase, auth.user.id, groupId);
  if (!membership) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("disputes")
    .insert({
      raised_by: auth.user.id,
      target_type,
      target_id,
      reason,
      group_id: groupId,
      status: "open",
    })
    .select("id, status, created_at")
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "db_error", detail: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, dispute: data });
}
