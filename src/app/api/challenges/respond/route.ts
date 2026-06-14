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

    // New invitations have no group yet (it's created on accept), so there's
    // nothing to clean up. Legacy invitations created before deferral still
    // carry a group — remove it if it's just the inviter.
    if (invitation.group_id) {
      const { count } = await admin
        .from("group_members")
        .select("user_id", { count: "exact", head: true })
        .eq("group_id", invitation.group_id);
      if ((count ?? 0) <= 1) {
        await admin.from("groups").delete().eq("id", invitation.group_id);
      }
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

  // Accept: the group is created now (deferred from invite time) unless this is
  // a legacy invitation that already has one. Both users join here.
  let groupId = invitation.group_id;
  if (!groupId) {
    const { data: parties } = await admin
      .from("profiles")
      .select("id, name, username")
      .in("id", [invitation.from_user, invitation.to_user]);
    const fromP = parties?.find((p) => p.id === invitation.from_user);
    const toP = parties?.find((p) => p.id === invitation.to_user);
    const groupName = `${fromP?.name?.trim() || fromP?.username || "Challenger"} vs ${toP?.name?.trim() || toP?.username || "Opponent"}`;

    const { data: group, error: groupErr } = await admin
      .from("groups")
      .insert({
        name: groupName,
        owner_id: invitation.from_user,
        default_penalty_cents: invitation.penalty_cents,
      })
      .select("id")
      .single();
    if (groupErr || !group) {
      return NextResponse.json(
        { error: "db_error", detail: groupErr?.message },
        { status: 500 }
      );
    }
    groupId = group.id;

    // Inviter joins as owner.
    const { error: ownerErr } = await admin.from("group_members").insert({
      group_id: groupId,
      user_id: invitation.from_user,
      role: "owner",
    });
    if (ownerErr) {
      await admin.from("groups").delete().eq("id", groupId);
      return NextResponse.json(
        { error: "db_error", detail: ownerErr.message },
        { status: 500 }
      );
    }
  }

  // Recipient joins as member.
  const { error: memberError } = await admin.from("group_members").insert({
    group_id: groupId,
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

  // Backfill: attach each member's check-ins from their own "today" to the new
  // group so its "Today's check-ins" view is correct immediately. Both users
  // join at accept time, so both may already have checked in today.
  for (const userId of [invitation.from_user, auth.user.id]) {
    const { data: prof } = await admin
      .from("profiles")
      .select("timezone")
      .eq("id", userId)
      .single();
    const today = localDay(new Date(), normalizeTimeZone(prof?.timezone));

    const { data: todaysCheckins } = await admin
      .from("checkin_events")
      .select(
        "submission_id, status, occurred_at, latitude, longitude, distance_m, source, local_day, ip, user_agent"
      )
      .eq("user_id", userId)
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
          user_id: userId,
          group_id: groupId,
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
  }

  const { error: acceptErr } = await admin
    .from("challenge_invitations")
    .update({ status: "accepted", group_id: groupId, responded_at: new Date().toISOString() })
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
      group_id: groupId,
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
    url: `/groups/${groupId}`,
    tag: `challenge-accepted-${invitation_id}`,
  });

  return NextResponse.json({
    ok: true,
    action: "accepted",
    group_id: groupId,
  });
}
