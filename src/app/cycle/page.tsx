import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { localDay, normalizeTimeZone } from "@/lib/time";
import { computePeriodStats, type CycleSummary, type PeriodStats } from "@/lib/period-stats";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { ProgressSection } from "@/components/progress-section";
import { MobileNav, TopNav } from "@/components/nav";
import { LogTodayButton } from "./client";

export const dynamic = "force-dynamic";

const PHASE_LABEL: Record<NonNullable<PeriodStats["currentPhase"]>, string> = {
  menstrual: "Menstrual",
  follicular: "Follicular",
  ovulation: "Ovulation",
  luteal: "Luteal",
};

function fmtShort(day: string): string {
  return new Date(day).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default async function CyclePage() {
  try {
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) redirect("/login");

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", auth.user.id)
      .single();
    if (!profile) redirect("/login");

    if (!profile.username || /^user_[a-f0-9]{8}$/.test(profile.username)) {
      redirect("/onboarding/username");
    }
    if (!profile.onboarding_complete) {
      redirect("/onboarding/schedule");
    }

    // The cycle tab is female-only; mirror the API gender gate server-side.
    if (profile.gender !== "female") {
      redirect("/dashboard");
    }

    const timezone = normalizeTimeZone(
      typeof profile.timezone === "string" ? profile.timezone : undefined
    );
    const today = localDay(new Date(), timezone);

    // 12 months of period records for richer trends + 90 days of daily status
    // to feed the shared calendar.
    const periodCutoffDate = new Date();
    periodCutoffDate.setUTCMonth(periodCutoffDate.getUTCMonth() - 12);
    const periodCutoff = periodCutoffDate.toISOString().slice(0, 10);

    const [{ data: periodRecords }, { data: dailyHistory }] = await Promise.all([
      supabase
        .from("period_records")
        .select("local_day, flow_level")
        .eq("user_id", profile.id)
        .gte("local_day", periodCutoff)
        .order("local_day", { ascending: true }),
      supabase
        .from("daily_status")
        .select("local_day, status")
        .eq("user_id", profile.id)
        .order("local_day", { ascending: false })
        .limit(90),
    ]);

    const records = periodRecords ?? [];
    const stats = computePeriodStats(records, today);
    const todayFlow =
      records.find((r) => r.local_day === today)?.flow_level ?? null;

    const topName =
      typeof profile.name === "string" && profile.name.trim().length > 0
        ? profile.name
        : typeof profile.email === "string"
          ? profile.email
          : "Account";

    return (
      <>
        <TopNav name={topName} username={profile.username} />
        <main className="animate-fade-up container max-w-md space-y-4 pb-28 pt-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-white/45">Your cycle</p>
            <h1 className="mt-1 text-3xl font-semibold text-white">Cycle</h1>
            <p className="mt-1 text-sm text-white/58">
              Predictions and trends from your logged period days.
            </p>
          </div>

          <PredictionHero stats={stats} />

          {stats.currentCycleDay != null ? (
            <CurrentCycleCard stats={stats} />
          ) : null}

          <StatGrid stats={stats} />

          <TrendsCard cycles={stats.cycles} averageCycleDays={stats.averageCycleDays} />

          <ProgressSection
            weekDots={[]}
            fullHistory={dailyHistory ?? []}
            today={today}
            todayStatus={
              (dailyHistory ?? []).find((r) => r.local_day === today)?.status ?? "pending"
            }
            thisWeekCheckins={0}
            weeklyGoal={profile.weekly_goal ?? 4}
            periodRecords={records}
            canEditPeriod
            calendarOnly
          />

          <LogTodayButton today={today} currentFlow={todayFlow} />

          <p className="px-1 text-center text-xs text-white/35">
            Predictions are estimates based on your logged history — not medical advice.
          </p>
        </main>
        <MobileNav />
      </>
    );
  } catch (error) {
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
    console.error("Cycle page render failed", error);
    return (
      <main className="container max-w-md py-10">
        <Card>
          <CardHeader>
            <CardTitle>Couldn&apos;t load your cycle</CardTitle>
            <CardDescription>
              Please refresh. If it still fails, open Settings and save your timezone.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link className={buttonVariants({ variant: "outline" })} href="/dashboard">
              Back to dashboard
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }
}

function PredictionHero({ stats }: { stats: PeriodStats }) {
  if (stats.nextPredictedStart == null || stats.daysUntilPredicted == null) {
    return (
      <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] px-5 py-6 text-center backdrop-blur-xl">
        <p className="text-xs uppercase tracking-[0.18em] text-white/45">Next period</p>
        <p className="mt-2 text-2xl font-bold text-white">Not enough data yet</p>
        <p className="mt-2 text-sm text-white/55">
          {stats.cyclesSampled === 0
            ? "Log your period days to start tracking your cycle."
            : "Log at least two cycles to unlock predictions."}
        </p>
      </section>
    );
  }

  const d = stats.daysUntilPredicted;
  const headline =
    d < -1
      ? `${Math.abs(d)} days late`
      : d === -1
        ? "1 day late"
        : d === 0
          ? "Predicted today"
          : d === 1
            ? "Predicted tomorrow"
            : `In ${d} days`;

  const confidence =
    stats.regularity === "regular"
      ? `Based on ${stats.cyclesSampled} fairly regular cycles.`
      : stats.regularity === "irregular"
        ? `Your cycles vary by ~${stats.cycleLengthSpreadDays} days, so this is a rough estimate.`
        : `Based on ${stats.cyclesSampled} cycle${stats.cyclesSampled === 1 ? "" : "s"} — accuracy improves as you log more.`;

  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] px-5 py-6 text-center backdrop-blur-xl">
      <p className="text-xs uppercase tracking-[0.18em] text-white/45">Next period</p>
      <p className="mt-2 text-4xl font-bold text-white">{headline}</p>
      <p className="mt-1 text-sm text-white/65">Expected {fmtShort(stats.nextPredictedStart)}</p>
      <p className="mt-3 text-xs text-white/45">{confidence}</p>
    </section>
  );
}

function CurrentCycleCard({ stats }: { stats: PeriodStats }) {
  const phase = stats.currentPhase ? PHASE_LABEL[stats.currentPhase] : null;
  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] px-5 py-5 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-white/45">Current cycle</p>
          <p className="mt-1 text-2xl font-semibold text-white">Day {stats.currentCycleDay}</p>
        </div>
        {phase ? (
          <span className="rounded-full border border-white/20 bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-white/80">
            {phase} phase
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-xs text-white/45">
        Phase is an estimate based on your average cycle — bodies vary.
      </p>
    </section>
  );
}

function StatGrid({ stats }: { stats: PeriodStats }) {
  const regularityLabel =
    stats.regularity === "regular"
      ? "Regular"
      : stats.regularity === "irregular"
        ? "Variable"
        : "—";
  return (
    <div className="grid grid-cols-2 gap-3">
      <StatTile
        label="Avg cycle"
        value={stats.averageCycleDays != null ? `${stats.averageCycleDays}d` : "—"}
        hint={stats.averageCycleDays == null ? "needs 2+ cycles" : `${stats.cyclesSampled} cycles`}
      />
      <StatTile
        label="Avg period"
        value={stats.averageDurationDays != null ? `${stats.averageDurationDays}d` : "—"}
        hint="per cycle"
      />
      <StatTile
        label="Last started"
        value={stats.lastPeriodStart ? fmtShort(stats.lastPeriodStart) : "—"}
        hint={
          stats.daysSinceLastPeriod != null
            ? stats.daysSinceLastPeriod === 0
              ? "today"
              : `${stats.daysSinceLastPeriod}d ago`
            : "—"
        }
      />
      <StatTile
        label="Regularity"
        value={regularityLabel}
        hint={
          stats.cycleLengthSpreadDays != null
            ? `±${stats.cycleLengthSpreadDays}d spread`
            : "needs 3+ cycles"
        }
      />
    </div>
  );
}

function StatTile({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-[1.7rem] border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl">
      <p className="text-xs uppercase tracking-[0.14em] text-white/55">{label}</p>
      <p className="mt-1 truncate text-2xl font-bold text-white">{value}</p>
      <p className="mt-1 text-xs text-white/40">{hint}</p>
    </div>
  );
}

function TrendsCard({
  cycles,
  averageCycleDays,
}: {
  cycles: CycleSummary[];
  averageCycleDays: number | null;
}) {
  // Most recent up to 8 cycles, oldest → newest for left-to-right reading.
  const recent = cycles.slice(-8);
  const lengthBars = recent
    .filter((c) => c.cycleLengthDays != null)
    .map((c) => ({ label: fmtShort(c.start), value: c.cycleLengthDays as number }));
  const durationBars = recent.map((c) => ({ label: fmtShort(c.start), value: c.durationDays }));

  if (durationBars.length < 1) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>Trends</CardTitle>
        <CardDescription>Cycle length and period duration over time</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {lengthBars.length >= 1 ? (
          <BarChart
            title="Cycle length (days)"
            bars={lengthBars}
            referenceValue={averageCycleDays}
          />
        ) : (
          <p className="text-xs text-white/45">
            Cycle-length trend appears once you&apos;ve logged 2+ cycles.
          </p>
        )}
        <BarChart title="Period duration (days)" bars={durationBars} referenceValue={null} />
      </CardContent>
    </Card>
  );
}

function BarChart({
  title,
  bars,
  referenceValue,
}: {
  title: string;
  bars: Array<{ label: string; value: number }>;
  referenceValue: number | null;
}) {
  const max = Math.max(...bars.map((b) => b.value), referenceValue ?? 0, 1);
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs uppercase tracking-[0.16em] text-white/50">{title}</p>
        {referenceValue != null ? (
          <p className="text-xs text-white/40">avg {referenceValue}d</p>
        ) : null}
      </div>
      <div className="relative flex h-16 items-end gap-1.5">
        {referenceValue != null ? (
          <div
            className="pointer-events-none absolute left-0 right-0 border-t border-dashed border-white/25"
            style={{ bottom: `${(referenceValue / max) * 100}%` }}
            aria-hidden
          />
        ) : null}
        {bars.map((b, i) => (
          <div key={i} className="flex min-w-0 flex-1 flex-col items-center justify-end">
            <span className="mb-1 text-[10px] text-white/55">{b.value}</span>
            <div
              className="w-full rounded-t bg-white/70"
              style={{ height: `${Math.max((b.value / max) * 100, 4)}%` }}
              title={`${b.label}: ${b.value} days`}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1.5">
        {bars.map((b, i) => (
          <span key={i} className="min-w-0 flex-1 truncate text-center text-[9px] text-white/35">
            {b.label}
          </span>
        ))}
      </div>
    </div>
  );
}
