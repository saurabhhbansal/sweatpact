import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { sendPushToUser } from "@/lib/push";
import { formatCents } from "@/lib/money";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  group_id: z.string().uuid(),
  to_user: z.string().uuid(),
  penalty_cents: z.number().int().nonnegative().max(10_000_00),
  message: z.string().max(200).optional(),
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
  const { group_id, to_user, penalty_cents, message } = parsed.data;
  if (to_user === auth.user.id) {
    return NextResponse.json({ error: "cannot_invite_self" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Caller must be owner or admin in this group.
  const { data: caller } = await admin
    .from("group_members")
    .select("role")
    .eq("group_id", group_id)
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (!caller || (caller.role !== "owner" && caller.role !== "admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Target must exist and not already be a member.
  const { data: target } = await admin
    .from("profiles")
    .select("id, username, name")
    .eq("id", to_user)
    .maybeSingle();
  if (!target) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }

  const { data: existing } = await admin
    .from("group_members")
    .select("user_id")
    .eq("group_id", group_id)
    .eq("user_id", to_user)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ error: "already_member" }, { status: 409 });
  }

  // Already a pending invite to this group?
  const { data: pending } = await admin
    .from("challenge_invitations")
    .select("id")
    .eq("group_id", group_id)
    .eq("to_user", to_user)
    .eq("status", "pending")
    .maybeSingle();
  if (pending) {
    return NextResponse.json({ error: "already_pending" }, { status: 409 });
  }

  const { data: fromProfile } = await admin
    .from("profiles")
    .select("username, name")
    .eq("id", auth.user.id)
    .maybeSingle();

  const { data: invitation, error: invError } = await admin
    .from("challenge_invitations")
    .insert({
      group_id,
      from_user: auth.user.id,
      to_user,
      penalty_cents,
      message: message ?? null,
    })
    .select("id")
    .single();
  if (invError || !invitation) {
    return NextResponse.json(
      { error: "db_error", detail: invError?.message },
      { status: 500 }
    );
  }

  await admin.from("notifications").insert({
    user_id: to_user,
    type: "challenge_invite_received",
    payload: {
      invitation_id: invitation.id,
      group_id,
      from_user: auth.user.id,
      from_username: fromProfile?.username ?? null,
      from_name: fromProfile?.name ?? null,
      penalty_cents,
      message: message ?? null,
    },
  });

  const inviterDisplay =
    fromProfile?.name?.trim() ||
    (fromProfile?.username ? `@${fromProfile.username}` : "Someone");
  await sendPushToUser(admin, to_user, {
    title: `${inviterDisplay} invited you to a challenge`,
    body: `${formatCents(penalty_cents)} per week${message ? ` · "${message}"` : ""}`,
    url: "/notifications",
    tag: `challenge-invite-${invitation.id}`,
  });

  return NextResponse.json({ ok: true, invitation_id: invitation.id });
}
