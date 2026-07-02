import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { safeEqual } from "@/lib/secure-compare";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { localDay, normalizeTimeZone } from "@/lib/time";
import {
  EXCUSED_STATUSES,
  computeWeekStreak,
  deriveDayStatus,
  isoWeekMonday,
  proratedWeeklyGoal,
  shouldCountTowardStreak,
} from "@/lib/derived-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Read-only dashboard summary for the Scriptable home-screen widget.
// Authenticated with the same user_id + webhook_secret pair the iOS Shortcut
// uses, so the widget works without a browser session cookie.
const Body = z.object({
  user_id: z.string().uuid(),
  secret: z.string().min(8),
});

function addDaysStr(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + n);
  return date.toISOString().slice(0, 10);
}

export async function POST(req: NextRequest) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = Body.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const body = parsed.data;
  const admin = createAdminClient();

  if (!(await rateLimit(admin, `widget:${clientIp(req)}`, 30, 60))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const { data: secretRow, error: secretError } = await admin
    .from("profile_secrets")
    .select("user_id, webhook_secret")
    .eq("user_id", body.user_id)
    .maybeSingle();

  if (secretError) {
    return NextResponse.json({ error: "db_error", detail: secretError.message }, { status: 500 });
  }
  if (!secretRow || !safeEqual(secretRow.webhook_secret, body.secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("id, timezone, weekly_goal, rest_days, created_at, name, username")
    .eq("id", secretRow.user_id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "no_profile" }, { status: 404 });
  }

  const timezone = normalizeTimeZone(
    typeof profile.timezone === "string" ? profile.timezone : undefined
  );
  const today = localDay(new Date(), timezone);
  const joinedDay = localDay(new Date(profile.created_at), timezone);
  const weeklyGoal: number = profile.weekly_goal ?? 4;
  const restDays: number[] = Array.isArray(profile.rest_days) ? profile.rest_days : [];

  const [
    { data: todayCheckins },
    { data: dailyHistory },
    { data: pendingOwes },
    { data: pendingOwed },
  ] = await Promise.all([
    admin
      .from("checkin_events")
      .select("status, occurred_at")
      .eq("user_id", profile.id)
      .eq("local_day", today)
      .order("occurred_at", { ascending: false }),
    admin
      .from("daily_status")
      .select("local_day, status")
      .eq("user_id", profile.id)
      .gte("local_day", joinedDay)
      .order("local_day", { ascending: false }),
    admin
      .from("obligations")
      .select("amount_cents, to_user")
      .eq("from_user", profile.id)
      .eq("status", "pending"),
    admin
      .from("obligations")
      .select("amount_cents, from_user")
      .eq("to_user", profile.id)
      .eq("status", "pending"),
  ]);

  // Same today-status precedence as the dashboard page.
  const todayStatus =
    dailyHistory?.find((row) => row.local_day === today)?.status ??
    todayCheckins?.find((row) => row.status === "verified")?.status ??
    todayCheckins?.find((row) => EXCUSED_STATUSES.has(row.status))?.status ??
    todayCheckins?.find((row) => row.status === "unverified")?.status ??
    "pending";

  const statusByDay = new Map<string, string>();
  for (const row of dailyHistory ?? []) {
    statusByDay.set(row.local_day, row.status);
  }
  statusByDay.set(today, todayStatus);

  const currentWeekMonday = isoWeekMonday(today);
  const weekStreak = computeWeekStreak(statusByDay, today, weeklyGoal, joinedDay, restDays);
  const currentWeekGoal = proratedWeeklyGoal(weeklyGoal, currentWeekMonday, joinedDay, restDays);

  let thisWeekCheckins = 0;
  for (const [day, status] of statusByDay) {
    if (shouldCountTowardStreak(status) && isoWeekMonday(day) === currentWeekMonday) {
      thisWeekCheckins++;
    }
  }

  // Current ISO week, Monday → Sunday, with the same derived display status the
  // dashboard check-in strip renders.
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const day = addDaysStr(currentWeekMonday, i);
    const [y, m, d] = day.split("-").map(Number);
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    return {
      day,
      day_of_month: d,
      dow,
      status: deriveDayStatus({
        recorded: statusByDay.get(day),
        day,
        today,
        isRestDay: restDays.includes(dow),
      }),
      is_today: day === today,
    };
  });

  const owesCents = (pendingOwes ?? []).reduce((sum, o) => sum + Number(o.amount_cents ?? 0), 0);
  const owedCents = (pendingOwed ?? []).reduce((sum, o) => sum + Number(o.amount_cents ?? 0), 0);
  const owesPeople = new Set((pendingOwes ?? []).map((o) => o.to_user)).size;
  const owedPeople = new Set((pendingOwed ?? []).map((o) => o.from_user)).size;

  return NextResponse.json({
    ok: true,
    name: profile.name ?? profile.username ?? null,
    today,
    today_status: todayStatus,
    week_streak: weekStreak,
    this_week_checkins: thisWeekCheckins,
    current_week_goal: currentWeekGoal,
    week_days: weekDays,
    owes_cents: owesCents,
    owed_cents: owedCents,
    owes_people: owesPeople,
    owed_people: owedPeople,
  });
}
