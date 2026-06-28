import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyPostHogState } from "@/components/admin/onboarding-funnel";
import type { AdoptionRow } from "@/lib/admin-posthog";

// DASH-05 feature adoption panel. Presentational only: an RSC component (no
// "use client", no hooks, no data loading). The admin page (Plan 06) runs the
// HogQL queries, validates with Zod, and passes the typed values — or `null`
// when PostHog is unconfigured/unreachable, which renders the locked empty state.

export type FeatureAdoptionProps = {
  /** Per-tab visit counts (label = tab id); `null` = no data / API unavailable. */
  tabUsage: AdoptionRow[] | null;
  /**
   * Total notification-click events. NOTE (RESEARCH Open Q2): PostHog has no
   * `notification_sent` event, so there is no denominator for a click-through
   * *rate*. This is surfaced honestly as a raw click count — never a fabricated
   * percentage.
   */
  notificationClicks: number | null;
  /** Total Shortcut-setup-viewed events. */
  shortcutSetups: number | null;
  /**
   * Manual-vs-Shortcut check-in split. Each entry is a method label and its
   * count; rendered as a two-segment ratio bar.
   */
  checkinMethods: AdoptionRow[] | null;
};

export function FeatureAdoption({
  tabUsage,
  notificationClicks,
  shortcutSetups,
  checkinMethods,
}: FeatureAdoptionProps) {
  // Each underlying metric is PostHog-sourced; if every source is null, the
  // panel has nothing to show and degrades to the shared empty state.
  const hasTabUsage = tabUsage !== null && tabUsage.length > 0;
  const hasMethods = checkinMethods !== null && checkinMethods.length > 0;
  const hasNotifications = notificationClicks !== null;
  const hasShortcuts = shortcutSetups !== null;

  if (!hasTabUsage && !hasMethods && !hasNotifications && !hasShortcuts) {
    // Renders the shared locked empty state ("No data yet").
    return <EmptyPostHogState />;
  }

  const tabMax = hasTabUsage
    ? Math.max(...tabUsage!.map((t) => t.count), 1)
    : 1;
  const methodTotal = hasMethods
    ? checkinMethods!.reduce((sum, m) => sum + m.count, 0)
    : 0;

  return (
    <Card className="rounded-[2rem] glass-card">
      <CardHeader>
        <CardTitle>Feature adoption</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {hasTabUsage ? (
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.08em] text-white/55">
              Tab usage
            </p>
            {tabUsage!.map((tab) => {
              const widthPct = Math.round((tab.count / tabMax) * 100);
              return (
                <div key={tab.label}>
                  <div className="flex items-baseline justify-between">
                    <p className="text-sm text-white/70">{tab.label}</p>
                    <p className="text-sm font-semibold text-white">
                      {tab.count}
                    </p>
                  </div>
                  <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-white"
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}

        {hasMethods ? (
          <div className="space-y-1.5">
            <p className="text-xs uppercase tracking-[0.08em] text-white/55">
              Check-in method (manual vs Shortcut)
            </p>
            <div className="flex h-2 w-full overflow-hidden rounded-full bg-white/10">
              {checkinMethods!.map((m, i) => {
                const widthPct =
                  methodTotal === 0
                    ? 0
                    : Math.round((m.count / methodTotal) * 100);
                return (
                  <div
                    key={m.label}
                    className={`h-full ${i === 0 ? "bg-white" : "bg-success"}`}
                    style={{ width: `${widthPct}%` }}
                  />
                );
              })}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {checkinMethods!.map((m) => (
                <span key={m.label} className="text-xs text-white/55">
                  {m.label}: {m.count}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-4">
          {hasNotifications ? (
            <div>
              {/*
                Honest metric: click COUNT, not a rate. No `notification_sent`
                event exists in PostHog, so a click-through rate has no
                denominator (RESEARCH Open Q2).
              */}
              <p className="text-xs uppercase tracking-[0.08em] text-white/55">
                Notification clicks
              </p>
              <p className="mt-1.5 text-3xl font-bold leading-tight text-white">
                {notificationClicks}
              </p>
            </div>
          ) : null}
          {hasShortcuts ? (
            <div>
              <p className="text-xs uppercase tracking-[0.08em] text-white/55">
                Shortcut setups
              </p>
              <p className="mt-1.5 text-3xl font-bold leading-tight text-white">
                {shortcutSetups}
              </p>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
