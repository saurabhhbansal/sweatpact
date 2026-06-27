import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getMembership } from "@/lib/groups";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { captureServerEvent } from "@/lib/analytics/server";
import { EVENT } from "@/lib/analytics/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  group_id: z.string().uuid(),
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

  const { group_id: groupId } = parsed.data;
  const admin = createAdminClient();
  const membership = await getMembership(admin, auth.user.id, groupId);

  if (!membership) {
    return NextResponse.json({ error: "not_in_group" }, { status: 409 });
  }

  if (membership.role === "owner") {
    const { count } = await admin
      .from("group_members")
      .select("user_id", { count: "exact", head: true })
      .eq("group_id", groupId);

    if ((count ?? 0) > 1) {
      return NextResponse.json(
        { error: "owner_cannot_leave_with_members" },
        { status: 409 }
      );
    }

    await admin.from("group_members").delete().eq("group_id", groupId);
    await admin.from("groups").delete().eq("id", groupId);
    return NextResponse.json({ ok: true, deleted_group: true });
  }

  const { error } = await admin
    .from("group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", auth.user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await captureServerEvent(auth.user.id, EVENT.PACT_MEMBER_LEFT, {
    group_id: groupId,
    role: membership.role,
  });

  return NextResponse.json({ ok: true, deleted_group: false });
}
