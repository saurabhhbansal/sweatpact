import type { SupabaseClient } from "@supabase/supabase-js";
import {
  EXCUSED_STATUSES,
  computeWeekStreak,
  isoWeekMonday,
  proratedWeeklyGoal,
  shouldCountTowardStreak,
} from "@/lib/derived-status";

export type ProfileStats = {
  weekStreak: number;
  thisWeekCheckins: number;
  totalCheckins: number;
  totalGymDays: number;
  totalRestDays: number;
  totalExcusedDays: number;
  totalMissedDays: number;
  weeklyGoal: number;
  // Effective goal for the CURRENT week — equals weeklyGoal except during the
  // user's first (partial) week, when it is prorated. Use this for "X / goal".
  currentWeekGoal: number;
  joinedAt: string;
  history: { local_day: string; status: string }[];
};

// Rank statuses so we keep the "best" one when multiple records exist for the same day.
const STATUS_RANK: Record<string, number> = {
  verified: 6,
  unverified: 5,
  rest_day: 4,
  sick_day: 4,
  period_day: 4,
  gym_closed: 4,
  missed: 2,
  rejected: 1,
  pending: 0,
};

export async function computeProfileStats(
  supabase: SupabaseClient,
  userId: string,
  today: string,
  weeklyGoal: number,
  joinedAt: string,
  restDays: number[] = []
): Promise<ProfileStats> {
  const [
    { data: dailyHistory },
    { data: checkinHistory },
  ] = await Promise.all([
    supabase
      .from("daily_status")
      .select("local_day, status")
      .eq("user_id", userId)
      .order("local_day", { ascending: false })
      .limit(5000),
    // Pre-onboarding check-ins may exist in checkin_events without a daily_status
    // row, so union both sources before computing totals.
    supabase
      .from("checkin_events")
      .select("local_day, status")
      .eq("user_id", userId)
      .neq("status", "rejected")
      .limit(5000),
  ]);

  const statusByDay = new Map<string, string>();
  function upsert(day: string, status: string) {
    const existing = statusByDay.get(day);
    if (!existing) {
      statusByDay.set(day, status);
      return;
    }
    if ((STATUS_RANK[status] ?? 0) > (STATUS_RANK[existing] ?? 0)) {
      statusByDay.set(day, status);
    }
  }
  for (const row of dailyHistory ?? []) upsert(row.local_day, row.status);
  for (const row of checkinHistory ?? []) upsert(row.local_day, row.status);

  let totalGymDays = 0;
  let totalRestDays = 0;
  let totalExcusedDays = 0;
  let totalMissedDays = 0;
  for (const status of statusByDay.values()) {
    if (status === "verified" || status === "unverified") totalGymDays++;
    else if (status === "rest_day") totalRestDays++;
    else if (status === "missed") totalMissedDays++;
    else if (EXCUSED_STATUSES.has(status)) totalExcusedDays++;
  }
  const totalCheckins = totalGymDays;

  const joinDay = joinedAt.slice(0, 10);
  const weekStreak = computeWeekStreak(statusByDay, today, weeklyGoal, joinDay, restDays);

  const currentWeekMonday = isoWeekMonday(today);
  const currentWeekGoal = proratedWeeklyGoal(weeklyGoal, currentWeekMonday, joinDay, restDays);
  let thisWeekCheckins = 0;
  for (const [day, status] of statusByDay) {
    if (shouldCountTowardStreak(status) && isoWeekMonday(day) === currentWeekMonday) {
      thisWeekCheckins++;
    }
  }

  const history = [...statusByDay.entries()].map(([local_day, status]) => ({
    local_day,
    status,
  }));

  return {
    weekStreak,
    thisWeekCheckins,
    totalCheckins,
    totalGymDays,
    totalRestDays,
    totalExcusedDays,
    totalMissedDays,
    weeklyGoal,
    currentWeekGoal,
    joinedAt,
    history,
  };
}

export async function areUsersInSameChallenge(
  supabase: SupabaseClient,
  userA: string,
  userB: string
): Promise<boolean> {
  const { data } = await supabase
    .from("group_members")
    .select("group_id")
    .in("user_id", [userA, userB]);
  if (!data) return false;
  const counts = new Map<string, number>();
  for (const row of data) {
    counts.set(row.group_id, (counts.get(row.group_id) ?? 0) + 1);
  }
  return [...counts.values()].some((c) => c >= 2);
}
