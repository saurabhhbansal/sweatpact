import Link from "next/link";
import { redirect } from "next/navigation";
import { formatCents } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { localDay, normalizeTimeZone } from "@/lib/time";
import { buttonVariants } from "@/components/ui/button";
import { CheckinStrip } from "@/components/checkin-strip";
import { StatusBadge } from "@/components/status-badge";
import { TodayActionCard } from "@/components/today-action-card";
import { PushPermissionPrompt } from "@/components/push-permission";

const EXCUSED_STATUSES = new Set(["sick_day", "gym_closed", "rest_day", "period_day"]);

function shouldCountTowardStreak(status: string) {
  return status === "verified" || status === "unverified";
}

// Returns the ISO-week Monday for a YYYY-MM-DD date string.
function isoWeekMonday(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const dow = (date.getUTCDay() + 6) % 7; // 0=Mon, 6=Sun
  date.setUTCDate(date.getUTCDate() - dow);
  return date.toISOString().slice(0, 10);
}

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  try {
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) redirect("/login");

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, username, onboarding_complete, timezone, created_at, weekly_goal, rest_days, gender")
      .eq("id", auth.user.id)
      .single();

    if (!profile) redirect("/login");

    if (!profile.username || /^user_[a-f0-9]{8}$/.test(profile.username)) {
      redirect("/onboarding/username");
    }
    if (!profile.onboarding_complete) {
      redirect("/onboarding/schedule");
    }

    const timezone = normalizeTimeZone(
      typeof profile.timezone === "string" ? profile.timezone : undefined
    );
    const today = localDay(new Date(), timezone);
    const joinedDay = localDay(new Date(profile.created_at), timezone);
    const weeklyGoal: number = (profile as any).weekly_goal ?? 4;
    const restDays: number[] = Array.isArray((profile as any).rest_days)
      ? (profile as any).rest_days
      : [];
    const todayDow = (() => {
      const [ty, tm, td] = today.split("-").map(Number);
      return new Date(Date.UTC(ty, tm - 1, td)).getUTCDay();
    })();
    const isTodayRestDay = restDays.includes(todayDow);

    const [
      { data: todayCheckins },
      { data: dailyHistory },
      { data: pendingOwes },
      { data: pendingOwed },
      { count: gymCount },
    ] = await Promise.all([
      supabase
        .from("checkin_events")
        .select("id, submission_id, status, occurred_at, distance_m, source")
        .eq("user_id", profile.id)
        .eq("local_day", today)
        .order("occurred_at", { ascending: false }),
      supabase
        .from("daily_status")
        .select("local_day, status")
        .eq("user_id", profile.id)
        .gte("local_day", joinedDay)
        .order("local_day", { ascending: false }),
      supabase
        .from("obligations")
        .select("id, amount_cents, to_user, status")
        .eq("from_user", profile.id)
        .eq("status", "pending"),
      supabase
        .from("obligations")
        .select("id, amount_cents, from_user, status")
        .eq("to_user", profile.id)
        .eq("status", "pending"),
      supabase
        .from("user_gyms")
        .select("id", { count: "exact", head: true })
        .eq("user_id", profile.id),
    ]);

    const todayStatus =
      dailyHistory?.find((row) => row.local_day === today)?.status ??
      todayCheckins?.find((row) => row.status === "verified")?.status ??
      todayCheckins?.find((row) => EXCUSED_STATUSES.has(row.status))?.status ??
      todayCheckins?.find((row) => row.status === "unverified")?.status ??
      "pending";

    // ── Weekly streak ──────────────────────────────────────────────────────
    const statusByDay = new Map<string, string>();
    for (const row of dailyHistory ?? []) {
      statusByDay.set(row.local_day, row.status);
    }
    statusByDay.set(today, todayStatus);

    const currentWeekMonday = isoWeekMonday(today);

    // Build a map of weekMonday → checkin count for completed weeks
    const weekCheckins = new Map<string, number>();
    for (const [day, status] of statusByDay) {
      if (!shouldCountTowardStreak(status)) continue;
      const mon = isoWeekMonday(day);
      weekCheckins.set(mon, (weekCheckins.get(mon) ?? 0) + 1);
    }

    // Walk weeks from most recent backward; break on a complete week that missed the goal
    const sortedWeekMondays = [...new Set(
      [...statusByDay.keys()].map(isoWeekMonday)
    )].sort((a, b) => b.localeCompare(a));

    let weekStreak = 0;
    for (const mon of sortedWeekMondays) {
      const count = weekCheckins.get(mon) ?? 0;
      const isCurrentWeek = mon === currentWeekMonday;
      if (count >= weeklyGoal) {
        weekStreak++;
      } else if (!isCurrentWeek) {
        break; // Past complete week that didn't hit goal → streak ends
      }
      // Current in-progress week below goal: don't count, don't break
    }

    // ── Owed totals (aggregated by unique counterparty) ────────────────────
    const totalOwes = (pendingOwes ?? []).reduce(
      (sum, o) => sum + Number(o.amount_cents ?? 0), 0
    );
    const totalOwed = (pendingOwed ?? []).reduce(
      (sum, o) => sum + Number(o.amount_cents ?? 0), 0
    );
    const owesPeopleCount = new Set((pendingOwes ?? []).map((o) => o.to_user)).size;
    const owedPeopleCount = new Set((pendingOwed ?? []).map((o) => o.from_user)).size;

    // ── Week dots (current ISO week Mon–Sun) ───────────────────────────────
    // Day-of-week index for each slot (Mon=1, …, Sat=6, Sun=0)
    const slotDow = [1, 2, 3, 4, 5, 6, 0];
    const weekDots = Array.from({ length: 7 }, (_, i) => {
      const [my, mm, md] = currentWeekMonday.split("-").map(Number);
      const mondayDate = new Date(Date.UTC(my, mm - 1, md));
      mondayDate.setUTCDate(mondayDate.getUTCDate() + i);
      const key = mondayDate.toISOString().slice(0, 10);
      const label = ["M", "T", "W", "T", "F", "S", "S"][i];
      const isFuture = key > today;
      const isRestSlot = restDays.includes(slotDow[i]);
      const recorded = statusByDay.get(key);
      const status = recorded ?? (isRestSlot && isFuture ? "rest_day" : "pending");
      return { key, label, current: key === today, status };
    });

    const thisWeekCheckins = weekDots.filter((d) =>
      shouldCountTowardStreak(d.status)
    ).length;

    return (
      <>
        <main className="container max-w-md flex min-h-[calc(100dvh-4.25rem)] flex-col gap-3 pb-[5.5rem] pt-3">
          <section className="animate-fade-up-item shrink-0 rounded-[2rem] border border-white/10 bg-white/[0.04] px-4 py-3 backdrop-blur-xl">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-white/45">This week</p>
                <p className="mt-0.5 text-xs">
                  <span className={thisWeekCheckins >= weeklyGoal ? "font-semibold text-white" : "text-white/70"}>
                    {thisWeekCheckins}
                  </span>
                  <span className="text-white/35">/{weeklyGoal}</span>
                  {thisWeekCheckins >= weeklyGoal ? (
                    <span className="ml-1.5 font-medium text-emerald-400">goal met</span>
                  ) : (
                    <span className="ml-1.5 text-white/35">days done</span>
                  )}
                </p>
              </div>
              <StatusBadge status={todayStatus} />
            </div>
            <CheckinStrip
              today={today}
              startDay={joinedDay}
              history={[...(dailyHistory ?? []), { local_day: today, status: todayStatus }]}
              restDays={restDays}
            />
            <div className="mt-2">
              <PushPermissionPrompt compact />
            </div>
          </section>

          <section
            className="animate-fade-up-item flex min-h-0 flex-1 flex-col items-center justify-center rounded-[2rem] border border-white/10 bg-white/[0.04] px-5 py-4 text-center backdrop-blur-xl"
            style={{ "--stagger": "60ms" } as React.CSSProperties}
          >
            <div className="relative mb-3 h-40 w-40">
              <div className="absolute inset-0 rounded-full bg-white p-[2px]">
                <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-black">
                  <p className="text-5xl font-bold text-white">{weekStreak}</p>
                  <p className="text-xs text-white/55">week streak</p>
                </div>
              </div>
            </div>
            {weekStreak === 0 ? (
              <p className="text-sm text-white/65">
                A week counts when you hit your {weeklyGoal}-day goal. Partial weeks don&apos;t break the streak.
              </p>
            ) : null}
            <p className="mt-2 text-xs text-white/45">
              {new Date(today + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
            </p>
          </section>

          <div
            className="animate-fade-up-item shrink-0"
            style={{ "--stagger": "120ms" } as React.CSSProperties}
          >
            <TodayActionCard
              initialStatus={todayStatus}
              isTodayRestDay={isTodayRestDay}
              gymCount={gymCount ?? 0}
              gender={profile.gender ?? "male"}
            />
          </div>

          <div
            className="animate-fade-up-item shrink-0 grid grid-cols-2 gap-3"
            style={{ "--stagger": "180ms" } as React.CSSProperties}
          >
            <div className={`rounded-[1.7rem] border p-3 backdrop-blur-xl ${totalOwes > 0 ? "border-red-500/20 bg-red-500/[0.04]" : "border-white/10 bg-white/[0.04]"}`}>
              <p className="text-xs uppercase tracking-[0.14em] text-white/55">You owe</p>
              <p className="mt-1 truncate text-lg font-bold text-white">{formatCents(totalOwes)}</p>
              <p className="mt-1 text-xs text-white/45">
                {owesPeopleCount === 0
                  ? "all clear"
                  : owesPeopleCount === 1
                    ? "to 1 person"
                    : `to ${owesPeopleCount} people`}
              </p>
            </div>
            <div className="rounded-[1.7rem] border border-white/10 bg-white/[0.04] p-3 backdrop-blur-xl">
              <p className="text-xs uppercase tracking-[0.14em] text-white/55">Owed to you</p>
              <p className="mt-1 truncate text-lg font-bold text-white">{formatCents(totalOwed)}</p>
              <p className="mt-1 text-xs text-white/45">
                {owedPeopleCount === 0
                  ? "all clear"
                  : owedPeopleCount === 1
                    ? "from 1 person"
                    : `from ${owedPeopleCount} people`}
              </p>
            </div>
          </div>

        </main>
      </>
    );
  } catch (error) {
    // Re-throw Next.js redirect/notFound signals so they reach the framework.
    if (
      error &&
      typeof error === "object" &&
      "digest" in error &&
      typeof (error as { digest: unknown }).digest === "string" &&
      ((error as { digest: string }).digest.startsWith("NEXT_REDIRECT") ||
        (error as { digest: string }).digest === "NEXT_NOT_FOUND")
    ) {
      throw error;
    }
    console.error("Dashboard render failed", error);
    return (
      <main className="container max-w-md py-10">
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
          <h1 className="text-base font-semibold text-white">Couldn&apos;t load dashboard</h1>
          <p className="mt-1 text-sm text-white/55">
            Please refresh. If it still fails, open Settings and save your timezone.
          </p>
          <div className="mt-4">
            <Link className={buttonVariants({ variant: "outline" })} href="/settings">
              Open settings
            </Link>
          </div>
        </section>
      </main>
    );
  }
}
