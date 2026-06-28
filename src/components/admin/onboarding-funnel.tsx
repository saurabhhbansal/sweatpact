import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FunnelRow } from "@/lib/admin-posthog";

// DASH-04 onboarding funnel panel. Presentational only: an RSC component (no
// "use client", no hooks, no data loading). The admin page (Plan 06) runs the
// HogQL query, validates with Zod, and passes the typed rows — or `null` when
// PostHog is unconfigured/unreachable, which renders the locked empty state.

/**
 * Shared PostHog empty state. Each PostHog-backed panel renders this
 * independently when its rows prop is `null`/empty, so the admin page degrades
 * gracefully whether or not PostHog is reachable. Copy matches the UI-SPEC
 * Copywriting Contract verbatim.
 */
export function EmptyPostHogState() {
  return (
    <div className="rounded-[2rem] glass-card p-4 text-center">
      <p className="text-sm font-semibold text-white">No data yet</p>
      <p className="mt-1 text-xs text-white/55">
        Events started 2026-06-28. Check back once members generate activity.
      </p>
    </div>
  );
}

export type OnboardingFunnelProps = {
  /** Funnel rows from PostHog; `null` = no data / API unavailable. */
  rows: FunnelRow[] | null;
};

// Drop-off coloring thresholds (relative to the previous step's user count):
// moderate drop → warning accent; large drop → destructive accent.
const MODERATE_DROP = 0.15;
const LARGE_DROP = 0.4;

export function OnboardingFunnel({ rows }: OnboardingFunnelProps) {
  if (!rows || rows.length === 0) {
    return <EmptyPostHogState />;
  }

  // The funnel top is the step with the most users; bar widths are relative to it.
  const max = Math.max(...rows.map((r) => r.users), 1);

  return (
    <Card className="rounded-[2rem] glass-card">
      <CardHeader>
        <CardTitle>Onboarding funnel</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.map((row, i) => {
          const widthPct = Math.round((row.users / max) * 100);
          // Drop-off measured against the prior (higher) step in the funnel.
          const prev = i === 0 ? row.users : rows[i - 1].users;
          const dropoff = prev === 0 ? 0 : (prev - row.users) / prev;
          const barColor =
            i === 0
              ? "bg-white"
              : dropoff >= LARGE_DROP
                ? "bg-destructive"
                : dropoff >= MODERATE_DROP
                  ? "bg-warning"
                  : "bg-white";

          return (
            <div key={row.step}>
              <div className="flex items-baseline justify-between">
                <p className="text-xs uppercase tracking-[0.08em] text-white/55">
                  {row.step}
                </p>
                <p className="text-sm font-semibold text-white">{row.users}</p>
              </div>
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full rounded-full ${barColor}`}
                  style={{ width: `${widthPct}%` }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
