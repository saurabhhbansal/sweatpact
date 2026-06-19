import Link from "next/link";
import { redirect } from "next/navigation";
import { formatCents } from "@/lib/money";
import {
  getSupabaseRSC,
  getViewerProfile,
  getOnboardingProgress,
} from "@/lib/supabase/rsc";
import { createAdminClient } from "@/lib/supabase/admin";
import { localDay, normalizeTimeZone } from "@/lib/time";
import { buttonVariants } from "@/components/ui/button";
import { CheckinStrip } from "@/components/checkin-strip";
import { StatusBadge } from "@/components/status-badge";
import { TodayActionCard } from "@/components/today-action-card";
import { PushPermissionPrompt } from "@/components/push-permission";
import { GettingStartedChecklist } from "@/components/tour/getting-started-checklist";
import { EmptyStatePactCTA } from "@/components/tour/empty-state-pact-cta";
import {
  EXCUSED_STATUSES,
  computeWeekStreak,
  isoWeekMonday,
  shouldCountTowardStreak,
} from "@/lib/derived-status";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  try {
    const supabase = getSupabaseRSC();

    const profile = await getViewerProfile();

    if (!profile) redirect("/login");

    // Onboarding completion for the getting-started checklist (UX-01). This is
    // the SAME request-cached reader the (tabs) layout already invoked, so it
    // adds no extra DB round trip (Open Decision option 1, no self-fetch).
    const progress = await getOnboardingProgress();
    const completedSteps: string[] = progress?.completed_steps ?? [];

    const timezone = normalizeTimeZone(
      typeof profile.timezone === "string" ? profile.timezone : undefined
    );
    const today = localDay(new Date(), timezone);
    const joinedDay = localDay(new Date(profile.created_at), timezone);
    const weeklyGoal: number = profile.weekly_goal ?? 4;
    const restDays: number[] = Array.isArray(profile.rest_days)
      ? profile.rest_days
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
      { count: challengeCount },
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
      createAdminClient()
        .from("user_gyms")
        .select("id", { count: "exact", head: true })
        .eq("user_id", profile.id), // SECURITY-CRITICAL: never widen this filter
      supabase
        .from("group_members")
        .select("group_id", { count: "exact", head: true })
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
    const weekStreak = computeWeekStreak(statusByDay, today, weeklyGoal);

    // ── Owed totals (aggregated by unique counterparty) ────────────────────
    const totalOwes = (pendingOwes ?? []).reduce(
      (sum, o) => sum + Number(o.amount_cents ?? 0), 0
    );
    const totalOwed = (pendingOwed ?? []).reduce(
      (sum, o) => sum + Number(o.amount_cents ?? 0), 0
    );
    const owesPeopleCount = new Set((pendingOwes ?? []).map((o) => o.to_user)).size;
    const owedPeopleCount = new Set((pendingOwed ?? []).map((o) => o.from_user)).size;

    // This week's check-in count toward the weekly goal. Counted directly from
    // statusByDay (single pass, same approach as computeProfileStats) — only
    // verified/unverified days in the current ISO week count. No inline status
    // derivation, so it can't drift from deriveDayStatus.
    let thisWeekCheckins = 0;
    for (const [day, status] of statusByDay) {
      if (shouldCountTowardStreak(status) && isoWeekMonday(day) === currentWeekMonday) {
        thisWeekCheckins++;
      }
    }

    return (
      <>
        <main className="container max-w-md flex min-h-[calc(100dvh-3.5rem-max(env(safe-area-inset-top),0.75rem))] flex-col gap-3 pb-[calc(4.25rem+max(env(safe-area-inset-bottom),20px))] pt-3">
          <GettingStartedChecklist completedSteps={completedSteps} gymCount={gymCount ?? 0} />

          <section data-tour="schedule" className="animate-fade-up-item shrink-0 rounded-[2rem] glass-card px-4 py-3">
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
            className="animate-fade-up-item flex min-h-0 flex-1 flex-col items-center justify-center rounded-[2rem] glass-card px-5 py-4 text-center"
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
            data-tour="gym"
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

          {challengeCount === 0 ? <EmptyStatePactCTA /> : null}

          {totalOwes === 0 && totalOwed === 0 ? (
            <div
              className="animate-fade-up-item shrink-0 rounded-[2rem] glass-card p-4 text-center"
              style={{ "--stagger": "180ms" } as React.CSSProperties}
            >
              <p className="text-sm font-semibold text-white">All settled up</p>
              <p className="mt-1 text-xs text-white/55">
                No debts in either direction. Keep the streak alive.
              </p>
            </div>
          ) : (
            // Single composed ledger — the two owe/owed boxes share one shell,
            // split by a hairline, each half tappable to the challenges list.
            <div
              className="animate-fade-up-item shrink-0 overflow-hidden rounded-[2rem] glass-card"
              style={{ "--stagger": "180ms" } as React.CSSProperties}
            >
              <div className="grid grid-cols-2">
                <Link
                  href="/groups"
                  className={`p-4 transition ${totalOwes > 0 ? "bg-red-500/10 hover:bg-red-500/15" : "hover:bg-white/[0.06]"}`}
                >
                  <p className="text-[11px] uppercase tracking-[0.08em] text-white/55">You owe</p>
                  <p className="mt-1.5 truncate text-xl font-bold text-white">{formatCents(totalOwes)}</p>
                  <p className="mt-1 text-xs text-white/45">
                    {owesPeopleCount === 0
                      ? "all clear"
                      : owesPeopleCount === 1
                        ? "to 1 person"
                        : `to ${owesPeopleCount} people`}
                  </p>
                </Link>
                <Link
                  href="/groups"
                  className="border-l border-white/10 p-4 transition hover:bg-white/[0.06]"
                >
                  <p className="text-[11px] uppercase tracking-[0.08em] text-white/55">Owed to you</p>
                  <p className="mt-1.5 truncate text-xl font-bold text-white">{formatCents(totalOwed)}</p>
                  <p className="mt-1 text-xs text-white/45">
                    {owedPeopleCount === 0
                      ? "all clear"
                      : owedPeopleCount === 1
                        ? "from 1 person"
                        : `from ${owedPeopleCount} people`}
                  </p>
                </Link>
              </div>
            </div>
          )}

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
        <section className="rounded-[2rem] glass-card p-5">
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
