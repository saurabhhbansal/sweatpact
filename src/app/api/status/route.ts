import { NextResponse } from "next/server";
import { reconcileUserDay } from "@/lib/checkin-reconciliation";
import { EXCUSED_STATUSES } from "@/lib/derived-status";
import { notifyGroupCheckin } from "@/lib/checkin-notify";
import { listUserMemberships, normalizeRelation } from "@/lib/groups";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { localDay, normalizeTimeZone } from "@/lib/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";


export async function GET() {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Own profile read goes through the service-role client: sensitive columns
  // (email, gym_*, period_*) are no longer SELECT-able by the authenticated
  // role after the profile-column lockdown (migration 0029). Scoped to the
  // authenticated user's own id.
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("*")
    .eq("id", auth.user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "no_profile" }, { status: 404 });
  }

  const today = localDay(new Date(), normalizeTimeZone(profile.timezone));
  const memberships = await listUserMemberships(supabase, profile.id);
  const groupIds = memberships.map((membership) => membership.group_id);

  const [{ data: todayCheckins }, { data: recent }, { data: owes }, { data: owed }] =
    await Promise.all([
      supabase
        .from("checkin_events")
        .select("id, submission_id, group_id, status, occurred_at, distance_m, source")
        .eq("user_id", profile.id)
        .eq("local_day", today)
        .order("occurred_at", { ascending: false }),
      supabase
        .from("daily_status")
        .select("local_day, status")
        .eq("user_id", profile.id)
        .order("local_day", { ascending: false })
        .limit(90),
      supabase
        .from("obligations")
        .select("id, amount_cents, to_user, status")
        .eq("from_user", profile.id)
        .eq("status", "pending")
        .limit(200),
      supabase
        .from("obligations")
        .select("id, amount_cents, from_user, status")
        .eq("to_user", profile.id)
        .eq("status", "pending")
        .limit(200),
    ]);

  const todayStatus =
    recent?.find((row) => row.local_day === today)?.status ??
    todayCheckins?.find((checkin) => checkin.status === "verified")?.status ??
    todayCheckins?.find((checkin) => EXCUSED_STATUSES.has(checkin.status))?.status ??
    todayCheckins?.find((checkin) => checkin.status === "unverified")?.status ??
    "pending";

  let streak = 0;
  for (const row of recent ?? []) {
    if (row.status === "missed") break;
    if (EXCUSED_STATUSES.has(row.status)) continue;
    streak += 1;
  }

  let groups: any[] = [];
  if (groupIds.length > 0) {
    const { data: members } = await supabase
      .from("group_members")
      .select("user_id, role, penalty_cents, group_id, profiles:user_id(id, name, username)")
      .in("group_id", groupIds)
      .order("joined_at", { ascending: true })
      .limit(1_000);

    groups = memberships
      .map((membership) => {
        if (!membership.group) return null;
        return {
          ...membership.group,
          role: membership.role,
          penalty_cents: membership.penalty_cents,
          members: (members ?? [])
            .filter((member) => member.group_id === membership.group_id)
            .map((member: any) => ({
              user_id: member.user_id,
              role: member.role,
              penalty_cents: member.penalty_cents,
              profile: normalizeRelation(member.profiles),
            })),
        };
      })
      .filter(Boolean);
  }

  return NextResponse.json({
    profile,
    today: {
      local_day: today,
      status: todayStatus,
      checkins: todayCheckins ?? [],
    },
    streak,
    obligations: {
      owes: owes ?? [],
      owed: owed ?? [],
    },
    groups,
  });
}

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const status = body?.status;
  if (!["sick_day", "rest_day", "period_day"].includes(status)) {
    return NextResponse.json({ error: "invalid_status" }, { status: 400 });
  }
  const flowLevel: string | undefined = body?.flow_level;
  if (
    status === "period_day" &&
    flowLevel != null &&
    !["light", "medium", "heavy", "unspecified"].includes(flowLevel)
  ) {
    return NextResponse.json({ error: "invalid_flow_level" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, timezone, gender")
    .eq("id", auth.user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "no_profile" }, { status: 404 });
  }

  if (status === "period_day" && profile.gender !== "female") {
    return NextResponse.json({ error: "invalid_status_for_gender" }, { status: 400 });
  }

  const timezone = normalizeTimeZone(profile.timezone);
  const today = localDay(new Date(), timezone);

  const { data: existingRows } = await admin
    .from("checkin_events")
    .select("status")
    .eq("user_id", profile.id)
    .eq("local_day", today);

  if ((existingRows ?? []).some((row) => row.status !== "rejected")) {
    return NextResponse.json({ error: "already_checked_in" }, { status: 409 });
  }

  const memberships = await listUserMemberships(admin, profile.id);
  const submissionId = crypto.randomUUID();
  const rowsToInsert =
    memberships.length > 0
      ? memberships.map((membership) => ({
          user_id: profile.id,
          group_id: membership.group_id,
          local_day: today,
          status,
          source: "manual" as const,
          submission_id: submissionId,
        }))
      : [
          {
            user_id: profile.id,
            group_id: null,
            local_day: today,
            status,
            source: "manual" as const,
            submission_id: submissionId,
          },
        ];

  const { error } = await admin.from("checkin_events").insert(rowsToInsert);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // For manual period_day entries, also record the flow level so the calendar
  // and stats reflect it. Default to "medium" if the client didn't specify.
  if (status === "period_day") {
    await admin
      .from("period_records")
      .upsert(
        {
          user_id: profile.id,
          local_day: today,
          flow_level: (flowLevel as "light" | "medium" | "heavy" | "unspecified") ?? "medium",
          source: "manual" as const,
        },
        { onConflict: "user_id,local_day" }
      );
  }

  await reconcileUserDay(admin, {
    userId: profile.id,
    localDay: today,
    now: new Date(),
  });

  // Broadcast rest days to the other challenge members (gated by the user's
  // own notify_rest_day preference inside the helper).
  if (status === "rest_day") {
    await notifyGroupCheckin(admin, {
      actorId: profile.id,
      status: "rest_day",
      localDay: today,
    });
  }

  return NextResponse.json({ ok: true, submission_id: submissionId });
}
