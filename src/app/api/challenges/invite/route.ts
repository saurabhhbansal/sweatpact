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

  // Run all four validation/lookup queries in parallel — none depends on the others.
  const [
    { data: target },
    { data: sharedMemberships },
    { data: pending },
    { data: fromProfile },
  ] = await Promise.all([
    admin.from("profiles").select("id, username, name").eq("id", to_user).maybeSingle(),
    admin.from("group_members").select("group_id").in("user_id", [auth.user.id, to_user]),
    admin
      .from("challenge_invitations")
      .select("id")
      .eq("status", "pending")
      .or(
        `and(from_user.eq.${auth.user.id},to_user.eq.${to_user}),and(from_user.eq.${to_user},to_user.eq.${auth.user.id})`
      )
      .maybeSingle(),
    admin.from("profiles").select("username, name").eq("id", auth.user.id).maybeSingle(),
  ]);

  if (!target) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }

  const shared = new Map<string, number>();
  for (const row of sharedMemberships ?? []) {
    shared.set(row.group_id, (shared.get(row.group_id) ?? 0) + 1);
  }
  if ([...shared.values()].some((c) => c >= 2)) {
    return NextResponse.json({ error: "already_in_challenge" }, { status: 409 });
  }

  if (pending) {
    return NextResponse.json({ error: "already_pending" }, { status: 409 });
  }

  // The group is NOT created here — only once the recipient accepts (see the
  // respond route). A pending invitation has no group, so it never shows up as
  // an empty challenge card. Everything needed to build the group on accept
  // (the two users + the stake) lives on the invitation row.
  const { data: invitation, error: invError } = await admin
    .from("challenge_invitations")
    .insert({
      group_id: null,
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

  // Notify recipient.
  await admin.from("notifications").insert({
    user_id: to_user,
    type: "challenge_invite_received",
    payload: {
      invitation_id: invitation.id,
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
