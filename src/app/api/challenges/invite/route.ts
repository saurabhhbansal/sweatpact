import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { sendPushToUser } from "@/lib/push";
import { formatCents } from "@/lib/money";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
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
  const { to_user, penalty_cents, message } = parsed.data;
  if (to_user === auth.user.id) {
    return NextResponse.json({ error: "cannot_challenge_self" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Target must exist
  const { data: target } = await admin
    .from("profiles")
    .select("id, username, name")
    .eq("id", to_user)
    .maybeSingle();
  if (!target) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }

  // Already in a challenge together?
  const { data: sharedMemberships } = await admin
    .from("group_members")
    .select("group_id")
    .in("user_id", [auth.user.id, to_user]);
  const shared = new Map<string, number>();
  for (const row of sharedMemberships ?? []) {
    shared.set(row.group_id, (shared.get(row.group_id) ?? 0) + 1);
  }
  if ([...shared.values()].some((c) => c >= 2)) {
    return NextResponse.json({ error: "already_in_challenge" }, { status: 409 });
  }

  // Already a pending invitation between these two?
  const { data: pending } = await admin
    .from("challenge_invitations")
    .select("id")
    .eq("status", "pending")
    .or(
      `and(from_user.eq.${auth.user.id},to_user.eq.${to_user}),and(from_user.eq.${to_user},to_user.eq.${auth.user.id})`
    )
    .maybeSingle();
  if (pending) {
    return NextResponse.json({ error: "already_pending" }, { status: 409 });
  }

  // Create a placeholder group (members only joined on accept).
  const { data: fromProfile } = await admin
    .from("profiles")
    .select("username, name")
    .eq("id", auth.user.id)
    .maybeSingle();

  const groupName = `${fromProfile?.name?.trim() || fromProfile?.username || "Challenger"} vs ${target.name?.trim() || target.username}`;

  const { data: group, error: groupError } = await admin
    .from("groups")
    .insert({
      name: groupName,
      owner_id: auth.user.id,
      default_penalty_cents: penalty_cents,
    })
    .select("id")
    .single();
  if (groupError || !group) {
    return NextResponse.json(
      { error: "db_error", detail: groupError?.message },
      { status: 500 }
    );
  }

  // Add inviter as owner of the group immediately.
  const { error: ownerError } = await admin.from("group_members").insert({
    group_id: group.id,
    user_id: auth.user.id,
    role: "owner",
  });
  if (ownerError) {
    await admin.from("groups").delete().eq("id", group.id);
    return NextResponse.json({ error: "db_error", detail: ownerError.message }, { status: 500 });
  }

  const { data: invitation, error: invError } = await admin
    .from("challenge_invitations")
    .insert({
      group_id: group.id,
      from_user: auth.user.id,
      to_user,
      penalty_cents,
      message: message ?? null,
    })
    .select("id")
    .single();
  if (invError || !invitation) {
    await admin.from("groups").delete().eq("id", group.id);
    return NextResponse.json(
      { error: "db_error", detail: invError?.message },
      { status: 500 }
    );
  }

  // Notify recipient.
  await admin.from("notifications").insert({
    user_id: to_user,
    type: "challenge_invite_received",
    payload: {
      invitation_id: invitation.id,
      group_id: group.id,
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
    title: `${inviterDisplay} challenged you`,
    body: `${formatCents(penalty_cents)} per week${message ? ` · "${message}"` : ""}`,
    url: "/notifications",
    tag: `challenge-invite-${invitation.id}`,
  });

  return NextResponse.json({ ok: true, invitation_id: invitation.id });
}
