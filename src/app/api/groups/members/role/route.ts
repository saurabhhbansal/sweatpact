import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getMembership } from "@/lib/groups";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  group_id: z.string().uuid(),
  user_id: z.string().uuid(),
  role: z.enum(["admin", "member"]),
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

  const { group_id: groupId, user_id: userId, role } = parsed.data;
  const callerMembership = await getMembership(supabase, auth.user.id, groupId);
  if (!callerMembership || callerMembership.role !== "owner") {
    return NextResponse.json({ error: "owner_required" }, { status: 403 });
  }

  const targetMembership = await getMembership(supabase, userId, groupId);
  if (!targetMembership) {
    return NextResponse.json({ error: "member_not_found" }, { status: 404 });
  }

  if (targetMembership.role === "owner") {
    return NextResponse.json({ error: "cannot_change_owner_role" }, { status: 409 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("group_members")
    .update({ role })
    .eq("group_id", groupId)
    .eq("user_id", userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
