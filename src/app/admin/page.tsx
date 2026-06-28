import { z } from "zod";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_TIME_ZONE, localDay } from "@/lib/time";
import { isoWeekMonday } from "@/lib/derived-status";
import {
  activePactCount,
  bucketCheckinsByWeek,
  computeAverageStreak,
  mergeGeoFailByWeek,
  rangeStartDay,
  rangeToDays,
  settlementRate,
  totalStakesCents,
  usersWithActivePact,
} from "@/lib/admin-metrics";
import {
  checkinMethodQuery,
  dauWauQuery,
  geoFailByWeekQuery,
  notificationClickQuery,
  onboardingFunnelQuery,
  parseAdoptionRows,
  parseEngagementRows,
  parseFunnelRows,
  parseGeoFailRows,
  runHogQL,
  shortcutViewQuery,
  tabUsageQuery,
} from "@/lib/admin-posthog";
import { FinancialOverview } from "@/components/admin/financial-overview";
import { CheckinTrendChart } from "@/components/admin/checkin-trend-chart";
import { UserOverview } from "@/components/admin/user-overview";
import { RangeControl } from "@/components/admin/range-control";
import { OnboardingFunnel } from "@/components/admin/onboarding-funnel";
import { FeatureAdoption } from "@/components/admin/feature-adoption";
import { EngagementPanel } from "@/components/admin/engagement-panel";

// Extract a single scalar count from a HogQL `[[count]]` result (the
// notification-click and shortcut-view queries return one row, one column).
// Returns null on null/empty/bad shape so FeatureAdoption renders its empty
// state — mirrors the parser null-contract in admin-posthog.ts.
function scalarCount(results: unknown[] | null): number | null {
  if (!results || results.length === 0) return null;
  const first = results[0];
  if (Array.isArray(first) && typeof first[0] === "number") return first[0];
  return null;
}

// Force-dynamic: the dashboard reads live service-role aggregates on every
// request (no static prerender). Authorization is already enforced in
// layout.tsx via `await requireOwner()`, so reaching this RSC means the viewer
// is a verified owner — only THEN is the RLS-bypassing admin client created
// (T-09-14: the service-role client is unreachable before the 404 gate passes).
export const dynamic = "force-dynamic";

// Re-throw Next.js redirect/notFound control-flow signals so they reach the
// framework instead of being caught as render errors (T-09-16).
function isNextSignal(error: unknown): boolean {
  return (
    !!error &&
    typeof error === "object" &&
    "digest" in error &&
    typeof (error as { digest: unknown }).digest === "string" &&
    ((error as { digest: string }).digest.startsWith("NEXT_REDIRECT") ||
      (error as { digest: string }).digest === "NEXT_NOT_FOUND")
  );
}

// Shift a YYYY-MM-DD calendar day by `delta` days (UTC math; DATE columns are
// timezone-naive). Used for the fixed streak (90d) and churn (14d) lookbacks.
function shiftDay(day: string, delta: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: { range?: string };
}) {
  try {
    // T-09-15: whitelist the range searchParam to a fixed enum, default 30d.
    // The validated value maps to a fixed integer day count — never interpolated.
    const range = z.enum(["7d", "30d", "90d"]).catch("30d").parse(searchParams.range);
    const days = rangeToDays(range);

    const today = localDay(new Date(), DEFAULT_TIME_ZONE);
    const rangeStart = rangeStartDay(today, days);
    const weekMonday = isoWeekMonday(today);
    const streakWindowStart = shiftDay(today, -90); // fixed 90d window (range-independent)
    const churnWindowStart = shiftDay(today, -14); // fixed 14d window (range-independent)

    // SECURITY: createAdminClient() bypasses RLS — correct ONLY because the
    // layout already gated this route to owners. Never widen its use.
    const admin = createAdminClient();

    const [
      totalUsersRes,
      onboardedRes,
      memberRes,
      groupsRes,
      penaltyRes,
      obligationRes,
      trendRes,
      weekCheckinRes,
      streakRes,
      churnRes,
    ] = await Promise.all([
      // DASH-03: total registered users
      admin.from("profiles").select("id", { count: "exact", head: true }),
      // DASH-03: onboarded users
      admin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("onboarding_complete", true),
      // DASH-01/03: group membership (feeds activePactCount + usersWithActivePact)
      admin.from("group_members").select("group_id, user_id"),
      // DASH-01: each group's configured stake
      admin.from("groups").select("id, default_penalty_cents"),
      // DASH-01: penalty events (count + sum)
      admin.from("penalty_events").select("amount_cents"),
      // DASH-01: obligation settlement status
      admin.from("obligations").select("status"),
      // DASH-02: check-in trend over the selected range
      admin
        .from("checkin_events")
        .select("local_day, status, source")
        .gte("local_day", rangeStart),
      // DASH-03: distinct users who verified a check-in this ISO week
      admin
        .from("checkin_events")
        .select("user_id")
        .eq("status", "verified")
        .gte("local_day", weekMonday),
      // DASH-06: verified daily_status rows over a fixed 90d window (streak basis)
      admin
        .from("daily_status")
        .select("user_id, local_day")
        .eq("status", "verified")
        .gte("local_day", streakWindowStart),
      // DASH-06: verified check-ins over a fixed 14d window (churn basis)
      admin
        .from("checkin_events")
        .select("user_id")
        .eq("status", "verified")
        .gte("local_day", churnWindowStart),
    ]);

    // ── DASH-01: financial overview ────────────────────────────────────────
    const memberRows: Array<{ group_id: string; user_id: string }> =
      memberRes.data ?? [];

    // Active-group set: groups with >= 2 members (same rule as activePactCount).
    const memberCounts = new Map<string, number>();
    for (const { group_id } of memberRows) {
      memberCounts.set(group_id, (memberCounts.get(group_id) ?? 0) + 1);
    }
    const activeGroupIds = new Set<string>();
    for (const [gid, n] of memberCounts) {
      if (n >= 2) activeGroupIds.add(gid);
    }

    const activeGroups: Array<{ default_penalty_cents: number }> = (
      (groupsRes.data ?? []) as Array<{
        id: string;
        default_penalty_cents: number;
      }>
    ).filter((g) => activeGroupIds.has(g.id));

    const totalPenaltiesCents = (
      (penaltyRes.data ?? []) as Array<{ amount_cents: number }>
    ).reduce((sum, p) => sum + Number(p.amount_cents ?? 0), 0);

    const obligationRows = (obligationRes.data ?? []) as Array<{
      status: string;
    }>;
    const settledCount = obligationRows.filter(
      (o) => o.status === "settled"
    ).length;
    const pendingCount = obligationRows.filter(
      (o) => o.status === "pending"
    ).length;

    const activePacts = activePactCount(memberRows);
    const stakesCents = totalStakesCents(activeGroups);
    const settlement = settlementRate(settledCount, pendingCount);

    // ── DASH-02: check-in trend ────────────────────────────────────────────
    const trendRows = (trendRes.data ?? []) as Array<{
      local_day: string;
      status: "verified" | "unverified";
      source: "shortcut" | "manual" | "admin";
    }>;
    const weekBuckets = bucketCheckinsByWeek(trendRows);

    // ── DASH-03: user overview ─────────────────────────────────────────────
    const totalUsers = totalUsersRes.count ?? 0;
    const onboardedUsers = onboardedRes.count ?? 0;
    const usersWithPact = usersWithActivePact(memberRows);
    const checkedInThisWeek = new Set(
      ((weekCheckinRes.data ?? []) as Array<{ user_id: string }>).map(
        (r) => r.user_id
      )
    ).size;

    // ── DASH-06: streak + churn (Supabase-sourced, passed to EngagementPanel) ─
    const averageStreakLength = computeAverageStreak(
      (streakRes.data ?? []) as Array<{ user_id: string; local_day: string }>,
      today
    );

    const verifiedRecently = new Set(
      ((churnRes.data ?? []) as Array<{ user_id: string }>).map(
        (r) => r.user_id
      )
    );
    const distinctMembers = new Set(memberRows.map((r) => r.user_id));
    let churnCount = 0;
    for (const uid of distinctMembers) {
      if (!verifiedRecently.has(uid)) churnCount++;
    }

    // ── PostHog block (DASH-04/05/06) ──────────────────────────────────────
    // runHogQL never throws (returns null on any failure), and each parser maps
    // null → empty state, so the PostHog block needs no try/catch of its own.
    const [
      funnelResult,
      tabResult,
      methodResult,
      notificationResult,
      shortcutResult,
      geoFailResult,
      dauResult,
    ] = await Promise.all([
      runHogQL(onboardingFunnelQuery()),
      runHogQL(tabUsageQuery()),
      runHogQL(checkinMethodQuery()),
      runHogQL(notificationClickQuery()),
      runHogQL(shortcutViewQuery()),
      runHogQL(geoFailByWeekQuery(days)),
      runHogQL(dauWauQuery(days)),
    ]);

    const funnelRows = parseFunnelRows(funnelResult);
    const tabUsage = parseAdoptionRows(tabResult);
    const checkinMethods = parseAdoptionRows(methodResult);
    const notificationClicks = scalarCount(notificationResult);
    const shortcutSetups = scalarCount(shortcutResult);
    const dailyActiveUsers = parseEngagementRows(dauResult);

    // DASH-02 geo-fail series is PostHog-sourced (never written to checkin_events),
    // so it is merged into the Supabase week buckets BEFORE the chart renders.
    const mergedBuckets = mergeGeoFailByWeek(
      weekBuckets,
      parseGeoFailRows(geoFailResult) ?? []
    );

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-base font-semibold text-white">Dashboard</h1>
          <RangeControl current={range} />
        </div>

        {/* Supabase block (DASH-01/02/03) — live service-role aggregates. */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FinancialOverview
            activePactCount={activePacts}
            totalStakesCents={stakesCents}
            totalPenaltiesCents={totalPenaltiesCents}
            settlementRate={settlement}
          />
          <UserOverview
            totalUsers={totalUsers}
            onboardedUsers={onboardedUsers}
            usersWithActivePact={usersWithPact}
            checkedInThisWeek={checkedInThisWeek}
          />
          <Card className="rounded-[2rem] glass-card md:col-span-2">
            <CardHeader>
              <CardTitle>Check-in trend</CardTitle>
            </CardHeader>
            <CardContent>
              <CheckinTrendChart data={mergedBuckets} />
            </CardContent>
          </Card>
        </div>

        {/* Source divider: Supabase block above, PostHog block below. */}
        <div className="border-t border-white/10 pt-6">
          {/* PostHog block (DASH-04/05/06). Streak + churn come from Supabase. */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <OnboardingFunnel rows={funnelRows} />
            <FeatureAdoption
              tabUsage={tabUsage}
              notificationClicks={notificationClicks}
              shortcutSetups={shortcutSetups}
              checkinMethods={checkinMethods}
            />
            <EngagementPanel
              dailyActiveUsers={dailyActiveUsers}
              // No PostHog query yields a true weekly-distinct count (dauWau is
              // per-day distinct), so WAU is omitted rather than fabricated —
              // same honesty rule as notificationClicks (no invented metric).
              weeklyActiveUsers={null}
              avgStreakLength={Math.round(averageStreakLength)}
              churn14d={churnCount}
            />
          </div>
        </div>
      </div>
    );
  } catch (error) {
    if (isNextSignal(error)) throw error;
    console.error("Admin dashboard render failed", error);
    return (
      <div className="rounded-[2rem] glass-card p-5">
        <h1 className="text-base font-semibold text-white">
          Couldn&apos;t load financial data
        </h1>
        <p className="mt-1 text-sm text-white/55">
          Refresh the page to retry.
        </p>
      </div>
    );
  }
}
