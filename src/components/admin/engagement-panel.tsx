import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyPostHogState } from "@/components/admin/onboarding-funnel";
import type { EngagementRow } from "@/lib/admin-posthog";

// DASH-06 engagement & retention panel. Presentational only: an RSC component
// (no "use client", no hooks, no data loading). The admin page (Plan 06) runs
// the HogQL queries, validates with Zod, and passes the typed values — or
// `null` when PostHog is unconfigured/unreachable (renders the empty state).

export type EngagementPanelProps = {
  /**
   * Per-day distinct active-user series (DAU basis); `null` = no data / API
   * unavailable. WAU is derived as the distinct users across the trailing
   * window; both DAU (latest day) and WAU are shown as figures, the series as
   * a CSS trend bar set.
   */
  dailyActiveUsers: EngagementRow[] | null;
  /** Weekly active users (distinct over the window). */
  weeklyActiveUsers: number | null;
  /** Average streak length across active members. */
  avgStreakLength: number | null;
  /** Count of members churned in the trailing 14 days. */
  churn14d: number | null;
};

export function EngagementPanel({
  dailyActiveUsers,
  weeklyActiveUsers,
  avgStreakLength,
  churn14d,
}: EngagementPanelProps) {
  const hasSeries = dailyActiveUsers !== null && dailyActiveUsers.length > 0;
  const hasWau = weeklyActiveUsers !== null;
  const hasStreak = avgStreakLength !== null;
  const hasChurn = churn14d !== null;

  if (!hasSeries && !hasWau && !hasStreak && !hasChurn) {
    // Renders the shared locked empty state ("No data yet").
    return <EmptyPostHogState />;
  }

  const dauMax = hasSeries
    ? Math.max(...dailyActiveUsers!.map((d) => d.count), 1)
    : 1;
  const latestDau = hasSeries
    ? dailyActiveUsers![dailyActiveUsers!.length - 1].count
    : null;

  return (
    <Card className="rounded-[2rem] glass-card">
      <CardHeader>
        <CardTitle>Engagement &amp; retention</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          {latestDau !== null ? (
            <div>
              <p className="text-xs uppercase tracking-[0.08em] text-white/55">
                DAU
              </p>
              <p className="mt-1.5 text-3xl font-bold leading-tight text-white">
                {latestDau}
              </p>
            </div>
          ) : null}
          {hasWau ? (
            <div>
              <p className="text-xs uppercase tracking-[0.08em] text-white/55">
                WAU
              </p>
              <p className="mt-1.5 text-3xl font-bold leading-tight text-white">
                {weeklyActiveUsers}
              </p>
            </div>
          ) : null}
        </div>

        {hasSeries ? (
          <div className="space-y-1.5">
            <p className="text-xs uppercase tracking-[0.08em] text-white/55">
              Daily active (trend)
            </p>
            <div className="flex h-16 items-end gap-1">
              {dailyActiveUsers!.map((d) => {
                const heightPct = Math.round((d.count / dauMax) * 100);
                return (
                  <div
                    key={d.key}
                    className="flex h-full flex-1 items-end rounded-sm bg-white/10"
                    title={`${d.key}: ${d.count}`}
                  >
                    <div
                      className="w-full rounded-sm bg-white"
                      style={{ height: `${heightPct}%` }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-4">
          {hasStreak ? (
            <div>
              <p className="text-xs uppercase tracking-[0.08em] text-white/55">
                Avg streak
              </p>
              <p className="mt-1.5 text-3xl font-bold leading-tight text-white">
                {avgStreakLength}
              </p>
            </div>
          ) : null}
          {hasChurn ? (
            <div>
              <p className="text-xs uppercase tracking-[0.08em] text-white/55">
                Churn (14d)
              </p>
              <p className="mt-1.5 text-3xl font-bold leading-tight text-white">
                {churn14d}
              </p>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
