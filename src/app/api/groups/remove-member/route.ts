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

  const { group_id: groupId, user_id: userId } = parsed.data;
  if (userId === auth.user.id) {
    return NextResponse.json({ error: "cannot_remove_self" }, { status: 400 });
  }

  const admin = createAdminClient();
  const callerMembership = await getMembership(admin, auth.user.id, groupId);
  if (!callerMembership || !isManagerRole(callerMembership.role)) {
    return NextResponse.json({ error: "not_authorized" }, { status: 403 });
  }

  const targetMembership = await getMembership(admin, userId, groupId);
  if (!targetMembership) {
    return NextResponse.json({ error: "member_not_found" }, { status: 404 });
  }

  if (targetMembership.role === "owner") {
    return NextResponse.json({ error: "cannot_remove_owner" }, { status: 409 });
  }

  if (targetMembership.role === "admin" && callerMembership.role !== "owner") {
    return NextResponse.json({ error: "owner_required_for_admin" }, { status: 403 });
  }

  const { error } = await admin
    .from("group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
