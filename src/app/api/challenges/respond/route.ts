import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { localDay, normalizeTimeZone } from "@/lib/time";
import { sendPushToUser } from "@/lib/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  invitation_id: z.string().uuid(),
  action: z.enum(["accept", "decline"]),
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
  const { invitation_id, action } = parsed.data;

  const admin = createAdminClient();
  const { data: invitation } = await admin
    .from("challenge_invitations")
    .select("id, group_id, from_user, to_user, status, penalty_cents")
    .eq("id", invitation_id)
    .single();

  if (!invitation) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (invitation.to_user !== auth.user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (invitation.status !== "pending") {
    return NextResponse.json({ error: "already_responded" }, { status: 409 });
  }

  if (action === "decline") {
    const { error: declineErr } = await admin
      .from("challenge_invitations")
      .update({ status: "declined", responded_at: new Date().toISOString() })
      .eq("id", invitation_id);
    if (declineErr) {
      return NextResponse.json(
        { error: "db_error", detail: declineErr.message },
        { status: 500 }
      );
    }

    // Only clean up the group if this was the initial 2-person invite
    // (i.e. the group has just the inviter and no other members).
    const { count } = await admin
      .from("group_members")
      .select("user_id", { count: "exact", head: true })
      .eq("group_id", invitation.group_id);
    if ((count ?? 0) <= 1) {
      await admin.from("groups").delete().eq("id", invitation.group_id);
    }

    await admin.from("notifications").insert({
      user_id: invitation.from_user,
      type: "challenge_declined",
      payload: { invitation_id, by_user: auth.user.id },
    });

    const { data: decliner } = await admin
      .from("profiles")
      .select("name, username")
      .eq("id", auth.user.id)
      .maybeSingle();
    const declinerDisplay =
      decliner?.name?.trim() ||
      (decliner?.username ? `@${decliner.username}` : "Someone");
    await sendPushToUser(admin, invitation.from_user, {
      title: "Challenge declined",
      body: `${declinerDisplay} passed on your challenge.`,
      url: "/notifications",
      tag: `challenge-declined-${invitation_id}`,
    });
    return NextResponse.json({ ok: true, action: "declined" });
  }

  // Accept: add recipient as member of the group.
  const { error: memberError } = await admin.from("group_members").insert({
    group_id: invitation.group_id,
    user_id: auth.user.id,
    role: "member",
    penalty_cents: invitation.penalty_cents,
  });
  if (memberError) {
    return NextResponse.json(
      { error: "db_error", detail: memberError.message },
      { status: 500 }
    );
  }

  // Backfill: if the recipient has already checked in today, attach those
  // submissions to the new group so its "Today's check-ins" view sees them.
  const { data: profile } = await admin
    .from("profiles")
    .select("timezone")
    .eq("id", auth.user.id)
    .single();
  const tz = normalizeTimeZone(profile?.timezone);
  const today = localDay(new Date(), tz);

  const { data: todaysCheckins } = await admin
    .from("checkin_events")
    .select(
      "submission_id, status, occurred_at, latitude, longitude, distance_m, source, local_day, ip, user_agent"
    )
    .eq("user_id", auth.user.id)
    .eq("local_day", today)
    .neq("status", "rejected");

  if (todaysCheckins && todaysCheckins.length > 0) {
    // Dedupe by submission_id — one row per submission, regardless of how
    // many other groups it was already attached to.
    const seen = new Set<string>();
    const rowsToInsert: Array<Record<string, unknown>> = [];
    for (const row of todaysCheckins) {
      if (seen.has(row.submission_id)) continue;
      seen.add(row.submission_id);
      rowsToInsert.push({
        user_id: auth.user.id,
        group_id: invitation.group_id,
        submission_id: row.submission_id,
        status: row.status,
        occurred_at: row.occurred_at,
        local_day: row.local_day,
        latitude: row.latitude,
        longitude: row.longitude,
        distance_m: row.distance_m,
        source: row.source,
        ip: row.ip,
        user_agent: row.user_agent,
      });
    }
    if (rowsToInsert.length > 0) {
      await admin.from("checkin_events").insert(rowsToInsert);
    }
  }

  const { error: acceptErr } = await admin
    .from("challenge_invitations")
    .update({ status: "accepted", responded_at: new Date().toISOString() })
    .eq("id", invitation_id);
  if (acceptErr) {
    return NextResponse.json(
      { error: "db_error", detail: acceptErr.message },
      { status: 500 }
    );
  }

  await admin.from("notifications").insert({
    user_id: invitation.from_user,
    type: "challenge_accepted",
    payload: {
      invitation_id,
      group_id: invitation.group_id,
      by_user: auth.user.id,
    },
  });

  const { data: accepter } = await admin
    .from("profiles")
    .select("name, username")
    .eq("id", auth.user.id)
    .maybeSingle();
  const accepterDisplay =
    accepter?.name?.trim() ||
    (accepter?.username ? `@${accepter.username}` : "Someone");
  await sendPushToUser(admin, invitation.from_user, {
    title: "Challenge accepted",
    body: `${accepterDisplay} accepted. Stakes are live.`,
    url: `/groups/${invitation.group_id}`,
    tag: `challenge-accepted-${invitation_id}`,
  });

  return NextResponse.json({
    ok: true,
    action: "accepted",
    group_id: invitation.group_id,
  });
}
