import type { SupabaseClient } from "@supabase/supabase-js";
import { listUserMemberships, normalizeRelation } from "@/lib/groups";
import { localDay, normalizeTimeZone } from "@/lib/time";
import { isoWeekMonday } from "@/lib/derived-status";
import type { CheckinStatus, DailyStatus } from "@/lib/types";

const ACTIVE_STATUSES = new Set<CheckinStatus>([
  "verified",
  "unverified",
  "sick_day",
  "gym_closed",
  "rest_day",
  "period_day",
]);

export type CheckinRow = {
  id: string;
  submission_id: string;
  group_id: string | null;
  status: CheckinStatus;
  occurred_at: string;
};

export function splitCentsEvenly(total: number, n: number): number[] {
  if (n <= 0 || total <= 0) return [];
  const base = Math.floor(total / n);
  const remainder = total - base * n;
  return Array.from({ length: n }, (_, index) => base + (index < remainder ? 1 : 0));
}

export function deriveStatus(checkins: CheckinRow[]): {
  status: DailyStatus;
  checkinId: string | null;
  submissionId: string | null;
} | null {
  const active = checkins.filter((checkin) => ACTIVE_STATUSES.has(checkin.status));
  if (active.length === 0) return null;

  const verified = active.find((checkin) => checkin.status === "verified");
  if (verified) {
    return {
      status: "verified",
      checkinId: verified.id,
      submissionId: verified.submission_id,
    };
  }

  // Hard excuses (sick/rest/gym_closed) take precedence over unverified —
  // if you deliberately logged an excuse it shouldn't be silently overridden.
  // period_day is intentionally excluded here: an actual check-in (even
  // unverified) should win over it because the user showed up anyway.
  const hardExcuse = active.find(
    (checkin) =>
      checkin.status === "sick_day" ||
      checkin.status === "gym_closed" ||
      checkin.status === "rest_day"
  );
  if (hardExcuse) {
    return {
      status: hardExcuse.status as DailyStatus,
      checkinId: hardExcuse.id,
      submissionId: hardExcuse.submission_id,
    };
  }

  const unverified = active.find((checkin) => checkin.status === "unverified");
  if (unverified) {
    return {
      status: "unverified",
      checkinId: unverified.id,
      submissionId: unverified.submission_id,
    };
  }

  // period_day has the lowest priority — only wins if there is no check-in.
  const periodDay = active.find((checkin) => checkin.status === "period_day");
  if (periodDay) {
    return {
      status: "period_day",
      checkinId: periodDay.id,
      submissionId: periodDay.submission_id,
    };
  }

  return null;
}

// A day is closed once its midnight has passed in the user's timezone — no cutoff needed.
export function isClosedDay(day: string, now: Date, timezone: string): boolean {
  return day < localDay(now, timezone);
}

// Only clears daily missed_checkin penalties — weekly penalties are left intact.
async function clearPenaltySideEffects(
  admin: SupabaseClient,
  userId: string,
  day: string
) {
  const { data: penalties, error } = await admin
    .from("penalty_events")
    .select("id")
    .eq("user_id", userId)
    .eq("local_day", day)
    .eq("reason", "missed_checkin");

  if (error) throw error;

  const penaltyIds = (penalties ?? []).map((penalty) => penalty.id);
  if (penaltyIds.length === 0) return;

  const { data: obligations, error: obligationError } = await admin
    .from("obligations")
    .select("id")
    .in("penalty_event_id", penaltyIds);

  if (obligationError) throw obligationError;

  const obligationIds = (obligations ?? []).map((obligation) => obligation.id);
  if (obligationIds.length > 0) {
    const { error: obligationDisputeError } = await admin
      .from("disputes")
      .delete()
      .eq("target_type", "obligation")
      .in("target_id", obligationIds);

    if (obligationDisputeError) throw obligationDisputeError;
  }

  const { error: penaltyDisputeError } = await admin
    .from("disputes")
    .delete()
    .eq("target_type", "penalty_event")
    .in("target_id", penaltyIds);

  if (penaltyDisputeError) throw penaltyDisputeError;

  const { error: penaltyDeleteError } = await admin
    .from("penalty_events")
    .delete()
    .in("id", penaltyIds);

  if (penaltyDeleteError) throw penaltyDeleteError;
}

async function ensurePenaltyForGroup(
  admin: SupabaseClient,
  params: {
    userId: string;
    groupId: string;
    localDay: string;
    amountCents: number;
    reason?: string;
  }
) {
  const { userId, groupId, localDay: day, amountCents, reason = "missed_checkin" } = params;

  // Upsert on the DB unique key (user_id, local_day, reason) so concurrent
  // enforcement runs cannot create duplicate penalties for the same day.
  const { data: penalty, error: penaltyError } = await admin
    .from("penalty_events")
    .upsert(
      { user_id: userId, group_id: groupId, local_day: day, amount_cents: amountCents, reason },
      { onConflict: "user_id,local_day,reason" }
    )
    .select("id")
    .single();

  if (penaltyError || !penalty) {
    throw penaltyError ?? new Error("Failed to create penalty event");
  }

  if (amountCents <= 0) return penalty.id;

  const { data: peers, error: peersError } = await admin
    .from("group_members")
    .select("user_id")
    .eq("group_id", groupId)
    .neq("user_id", userId);

  if (peersError) throw peersError;

  const recipientIds = (peers ?? []).map((peer) => peer.user_id);
  if (recipientIds.length === 0) return penalty.id;

  const splits = splitCentsEvenly(amountCents, recipientIds.length);
  const rows = recipientIds.map((recipientId, index) => ({
    penalty_event_id: penalty.id,
    group_id: groupId,
    from_user: userId,
    to_user: recipientId,
    amount_cents: splits[index],
    status: "pending" as const,
  }));

  // Idempotent: a re-run (or a raced/doubled enforcement pass) finds the same
  // penalty.id and skips the already-created obligations via the
  // (penalty_event_id, to_user) unique key, so the debtor is never charged twice.
  const { error: obligationInsertError } = await admin
    .from("obligations")
    .upsert(rows, { onConflict: "penalty_event_id,to_user", ignoreDuplicates: true });
  if (obligationInsertError) throw obligationInsertError;

  return penalty.id;
}

export async function reconcileUserDay(
  admin: SupabaseClient,
  params: {
    userId: string;
    localDay: string;
    now?: Date;
  }
) {
  const now = params.now ?? new Date();
  const { userId, localDay: day } = params;

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, timezone, rest_days")
    .eq("id", userId)
    .single();

  if (profileError || !profile) {
    throw profileError ?? new Error("Profile not found");
  }

  const timezone = normalizeTimeZone(profile.timezone);
  const restDays: number[] = Array.isArray((profile as any).rest_days)
    ? (profile as any).rest_days
    : [];

  const { data: checkins, error: checkinsError } = await admin
    .from("checkin_events")
    .select("id, submission_id, group_id, status, occurred_at")
    .eq("user_id", userId)
    .eq("local_day", day)
    .order("occurred_at", { ascending: false });

  if (checkinsError) throw checkinsError;

  const resolved = deriveStatus((checkins ?? []) as CheckinRow[]);
  const closed = isClosedDay(day, now, timezone);

  if (resolved) {
    const { error: upsertError } = await admin.from("daily_status").upsert(
      {
        user_id: userId,
        local_day: day,
        status: resolved.status,
        checkin_id: resolved.checkinId,
        enforced_at: closed ? now.toISOString() : null,
      },
      { onConflict: "user_id,local_day" }
    );

    if (upsertError) throw upsertError;

    if (resolved.status !== "missed") {
      await clearPenaltySideEffects(admin, userId, day);
    }

    return {
      status: resolved.status,
      closed,
      submissionId: resolved.submissionId,
    };
  }

  if (!closed) {
    await clearPenaltySideEffects(admin, userId, day);

    const { error: deleteDailyError } = await admin
      .from("daily_status")
      .delete()
      .eq("user_id", userId)
      .eq("local_day", day);

    if (deleteDailyError) throw deleteDailyError;

    return {
      status: "pending" as const,
      closed,
      submissionId: null,
    };
  }

  // If this is a scheduled rest day, auto-excuse it instead of marking missed.
  const [dy, dm, dd] = day.split("-").map(Number);
  const dayOfWeek = new Date(Date.UTC(dy, dm - 1, dd)).getUTCDay(); // 0=Sun
  if (restDays.includes(dayOfWeek)) {
    const { error: excuseUpsertError } = await admin.from("daily_status").upsert(
      {
        user_id: userId,
        local_day: day,
        status: "rest_day",
        checkin_id: null,
        enforced_at: now.toISOString(),
      },
      { onConflict: "user_id,local_day" }
    );
    if (excuseUpsertError) throw excuseUpsertError;
    return { status: "rest_day" as const, closed, submissionId: null };
  }

  // Day is closed with no check-in → mark missed (for history/streak tracking only).
  // Obligations are created by reconcileUserWeek, not here.
  const { error: missedUpsertError } = await admin.from("daily_status").upsert(
    {
      user_id: userId,
      local_day: day,
      status: "missed",
      checkin_id: null,
      enforced_at: now.toISOString(),
    },
    { onConflict: "user_id,local_day" }
  );

  if (missedUpsertError) throw missedUpsertError;

  return {
    status: "missed" as const,
    closed,
    submissionId: null,
  };
}

// ISO week Monday — shared with the dashboard/profile streak math so the
// weekly enforcement and the displayed streak can never use different weeks.
const weekMonday = isoWeekMonday;

// Called once per week (after Sunday ends) to create obligations if the weekly
// goal was not met. Uses weekEndDay (Sunday) as the anchor date.
export async function reconcileUserWeek(
  admin: SupabaseClient,
  params: {
    userId: string;
    weekEndDay: string; // The Sunday YYYY-MM-DD that just ended
    now: Date;
  }
) {
  const { userId, weekEndDay } = params;

  const weekStartDay = weekMonday(weekEndDay);

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, weekly_goal")
    .eq("id", userId)
    .single();

  if (profileError || !profile) throw profileError ?? new Error("Profile not found");

  const weeklyGoal: number = (profile as any).weekly_goal ?? 4;

  const { data: statuses, error: statusError } = await admin
    .from("daily_status")
    .select("local_day, status")
    .eq("user_id", userId)
    .gte("local_day", weekStartDay)
    .lte("local_day", weekEndDay);

  if (statusError) throw statusError;

  const checkinDays = (statuses ?? []).filter(
    (s) => s.status === "verified" || s.status === "unverified"
  ).length;

  if (checkinDays >= weeklyGoal) return; // Goal met — no penalty

  const memberships = await listUserMemberships(admin, userId);

  for (const membership of memberships) {
    const group = normalizeRelation(membership.group);
    // Flat weekly stake: missing the goal at all costs the full stake, no
    // matter how many days short.
    const weeklyStakeCents = membership.penalty_cents ?? group?.default_penalty_cents ?? 5000;

    await ensurePenaltyForGroup(admin, {
      userId,
      groupId: membership.group_id,
      localDay: weekEndDay,
      amountCents: weeklyStakeCents,
      reason: "missed_weekly_goal",
    });
  }
}

export function isActiveCheckinStatus(status: string) {
  return ACTIVE_STATUSES.has(status as CheckinStatus);
}

export function getAcceptedSubmissionRows(checkins: CheckinRow[]) {
  return checkins.filter((checkin) => isActiveCheckinStatus(checkin.status));
}
