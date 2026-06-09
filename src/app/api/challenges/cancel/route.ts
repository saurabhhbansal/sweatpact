import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  invitation_id: z.string().uuid(),
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

  const admin = createAdminClient();
  const { data: invitation } = await admin
    .from("challenge_invitations")
    .select("id, group_id, from_user, to_user, status")
    .eq("id", parsed.data.invitation_id)
    .single();

  if (!invitation) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (invitation.from_user !== auth.user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (invitation.status !== "pending") {
    return NextResponse.json({ error: "already_responded" }, { status: 409 });
  }

  const { error: cancelError } = await admin
    .from("challenge_invitations")
    .update({ status: "cancelled", responded_at: new Date().toISOString() })
    .eq("id", parsed.data.invitation_id);
  if (cancelError) {
    return NextResponse.json({ error: "db_error", detail: cancelError.message }, { status: 500 });
  }

  // If this was the initial 2-person invite and the group only has the inviter,
  // tear down the placeholder group too.
  const { count, error: countError } = await admin
    .from("group_members")
    .select("user_id", { count: "exact", head: true })
    .eq("group_id", invitation.group_id);
  if (!countError && (count ?? 0) <= 1) {
    await admin.from("groups").delete().eq("id", invitation.group_id);
  }

  // Remove the recipient's pending notification (if still unread / actionable).
  await admin
    .from("notifications")
    .delete()
    .eq("user_id", invitation.to_user)
    .eq("type", "challenge_invite_received")
    .filter("payload->>invitation_id", "eq", parsed.data.invitation_id);

  return NextResponse.json({ ok: true });
}
