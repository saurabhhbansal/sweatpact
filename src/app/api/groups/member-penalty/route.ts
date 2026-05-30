import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getMembership, isManagerRole } from "@/lib/groups";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  group_id: z.string().uuid(),
  user_id: z.string().uuid(),
  penalty_cents: z.number().int().nonnegative(),
});

export async function PATCH(req: NextRequest) {
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

  const { group_id: groupId, user_id: userId, penalty_cents: penaltyCents } = parsed.data;
  const callerMembership = await getMembership(supabase, auth.user.id, groupId);

  if (!callerMembership) {
    return NextResponse.json({ error: "not_in_group" }, { status: 403 });
  }

  if (userId !== auth.user.id && !isManagerRole(callerMembership.role)) {
    return NextResponse.json({ error: "not_authorized" }, { status: 403 });
  }

  const targetMembership = await getMembership(supabase, userId, groupId);
  if (!targetMembership) {
    return NextResponse.json({ error: "member_not_found" }, { status: 404 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("group_members")
    .update({ penalty_cents: penaltyCents })
    .eq("group_id", groupId)
    .eq("user_id", userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
