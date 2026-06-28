// Pure admin-dashboard computation helpers (DASH-01/02/03).
//
// This module is intentionally side-effect free: no DB calls, no React, no
// "use client". The RSC page (Plan 06) fetches rows via the service-role admin
// client and feeds them into these helpers, so all financial + trend math is
// server-authoritative and unit-testable without a database.

import { isoWeekMonday } from "@/lib/derived-status";

// Re-export for admin financial display (shared pattern — components import
// formatCents from here alongside the metric helpers).
export { formatCents } from "@/lib/money";

// --- DASH-01: financial overview -----------------------------------------

// Penalties settled / penalties owed, where owed = settled + pending obligation
// rows. Disputed/voided obligations are excluded from the denominator by the
// caller (they are never passed in as pending) — see RESEARCH A5.
export function settlementRate(settled: number, pending: number): number {
  const total = settled + pending;
  return total === 0 ? 0 : settled / total;
}

// A live pact is structurally a `groups` row with >= 2 `group_members`
// (RESEARCH Open Q1 / A1; group_members PK is (group_id, user_id), unique(user_id)).
// PLANNER RESOLUTION of RESEARCH Open Q1 — confirm against owner intent in UAT.
export function activePactCount(
  memberRows: Array<{ group_id: string }>
): number {
  const counts = new Map<string, number>();
  for (const { group_id } of memberRows) {
    counts.set(group_id, (counts.get(group_id) ?? 0) + 1);
  }
  let active = 0;
  for (const n of counts.values()) {
    if (n >= 2) active++;
  }
  return active;
}

// Total money at stake = sum of each active group's configured penalty
// (RESEARCH A2: stake source is the group's default_penalty_cents). Each active
// group contributes its stake once; cents are integers.
export function totalStakesCents(
  activeGroups: Array<{ default_penalty_cents: number }>
): number {
  return activeGroups.reduce((sum, g) => sum + g.default_penalty_cents, 0);
}

// --- DASH-02: check-in trend ---------------------------------------------

// One ISO-week bucket of check-in activity. `week` is the isoWeekMonday key
// (e.g. "2026-06-22"). `geoFail` is sourced from PostHog (never written to
// checkin_events) and merged in via mergeGeoFailByWeek — it starts at 0.
export type WeekBucket = {
  week: string;
  verified: number;
  unverified: number;
  manual: number;
  shortcut: number;
  geoFail: number;
  total: number;
};

// Map a Zod-validated `?range` enum value to a day count. The page boundary
// (Plan 06) validates the searchParam against z.enum(["7d","30d","90d"]); this
// only maps the validated value to a fixed integer — no raw input interpolation.
export function rangeToDays(range: string): 7 | 30 | 90 {
  if (range === "7d") return 7;
  if (range === "90d") return 90;
  return 30; // default 30d (covers "30d" and any unexpected value)
}

// Inclusive-window start: the YYYY-MM-DD that is (days - 1) days before `today`,
// so the [start, today] window spans exactly `days` calendar days inclusive.
// e.g. rangeStartDay("2026-06-28", 7) === "2026-06-22".
export function rangeStartDay(today: string, days: number): string {
  const [y, m, d] = today.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() - (days - 1));
  return date.toISOString().slice(0, 10);
}

// Bucket raw checkin_events rows into ISO-week buckets keyed by
// isoWeekMonday(local_day) (reused from derived-status — no new week math).
// Counts verified/unverified by status and manual/shortcut by source; "admin"
// source rows count toward total but neither manual nor shortcut. geoFail is
// initialized to 0 (merged later from PostHog). Returns weeks ascending.
export function bucketCheckinsByWeek(
  rows: Array<{
    local_day: string;
    status: "verified" | "unverified";
    source: "shortcut" | "manual" | "admin";
  }>
): WeekBucket[] {
  const byWeek = new Map<string, WeekBucket>();
  for (const r of rows) {
    const week = isoWeekMonday(r.local_day);
    let bucket = byWeek.get(week);
    if (!bucket) {
      bucket = {
        week,
        verified: 0,
        unverified: 0,
        manual: 0,
        shortcut: 0,
        geoFail: 0,
        total: 0,
      };
      byWeek.set(week, bucket);
    }
    if (r.status === "verified") bucket.verified++;
    else bucket.unverified++;
    if (r.source === "manual") bucket.manual++;
    else if (r.source === "shortcut") bucket.shortcut++;
    bucket.total++;
  }
  return [...byWeek.values()].sort((a, b) => a.week.localeCompare(b.week));
}

// Join seam between the Supabase trend buckets and the PostHog
// `checkin:geo_failed` series (Plan 03). Geo-fail is never written to
// checkin_events, so each bucket's geoFail is set from the matching geoFailRows
// entry; weeks with no geo-fail row stay at 0. Returns the same bucket objects.
export function mergeGeoFailByWeek(
  buckets: WeekBucket[],
  geoFailRows: Array<{ week: string; count: number }>
): WeekBucket[] {
  const byWeek = new Map(geoFailRows.map((g) => [g.week, g.count]));
  for (const bucket of buckets) {
    bucket.geoFail = byWeek.get(bucket.week) ?? 0;
  }
  return buckets;
}

// --- DASH-06: engagement / retention (Supabase-sourced) ------------------

// Average current check-in streak across members, computed from verified
// daily_status rows (RESEARCH D-06: streak/churn have no PostHog event source,
// so they are derived server-side from Supabase). For each user we walk
// backwards from `today` over their set of verified local_day values, counting
// consecutive present days until the first gap. The streak is therefore anchored
// to `today` (a user with no verified row for `today` has a streak of 0, even if
// they checked in earlier). The returned value is the mean streak across every
// user that has >= 1 verified row; returns 0 when there are no rows.
export function computeAverageStreak(
  rows: Array<{ user_id: string; local_day: string }>,
  today: string
): number {
  if (rows.length === 0) return 0;

  const daysByUser = new Map<string, Set<string>>();
  for (const { user_id, local_day } of rows) {
    let set = daysByUser.get(user_id);
    if (!set) {
      set = new Set<string>();
      daysByUser.set(user_id, set);
    }
    set.add(local_day);
  }

  let totalStreak = 0;
  for (const days of daysByUser.values()) {
    let streak = 0;
    let cursor = today;
    while (days.has(cursor)) {
      streak++;
      cursor = shiftDay(cursor, -1);
    }
    totalStreak += streak;
  }
  return totalStreak / daysByUser.size;
}

// Shift a YYYY-MM-DD calendar day by `delta` days using UTC date math (DATE
// columns are timezone-naive; UTC arithmetic avoids any DST drift).
function shiftDay(day: string, delta: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

// --- DASH-03: user overview ----------------------------------------------

// Count distinct user_ids that belong to a group with >= 2 members. A user is
// counted once even if they (somehow) appear across multiple active groups.
export function usersWithActivePact(
  memberRows: Array<{ group_id: string; user_id: string }>
): number {
  const groupCounts = new Map<string, number>();
  for (const { group_id } of memberRows) {
    groupCounts.set(group_id, (groupCounts.get(group_id) ?? 0) + 1);
  }
  const users = new Set<string>();
  for (const { group_id, user_id } of memberRows) {
    if ((groupCounts.get(group_id) ?? 0) >= 2) users.add(user_id);
  }
  return users.size;
}
