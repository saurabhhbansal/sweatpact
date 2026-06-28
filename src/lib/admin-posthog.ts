import "server-only";

import { EVENT } from "@/lib/analytics/events";

/**
 * Server-only PostHog Query API (HogQL) client for the admin dashboard panels
 * DASH-04 (onboarding funnel), DASH-05 (feature adoption), DASH-06 (engagement).
 *
 * IMPORTANT — host: the Query API is a PRIVATE/authenticated endpoint served at
 * `https://eu.posthog.com`. This is NOT the ingestion host `eu.i.posthog.com`
 * used by `src/lib/analytics/server.ts`. Copying the ingestion host here 404s
 * (Pitfall 2 / RESEARCH). Do not reuse `NEXT_PUBLIC_POSTHOG_HOST` either — that
 * is the browser-only `/ingest` reverse proxy.
 */
const HOST = "https://eu.posthog.com";

/**
 * Execute a HogQL query against the PostHog Query API and return the raw result
 * rows (arrays indexed by column order), or `null` on any failure.
 *
 * Fail-soft contract (mirrors the silent-catch philosophy of analytics/server.ts):
 * - Returns `null` (never throws) when `POSTHOG_PROJECT_ID` or
 *   `POSTHOG_PERSONAL_API_KEY` is unset — the panel renders its empty state.
 * - Returns `null` on any non-ok response or thrown error — analytics must never
 *   break the admin page.
 *
 * Caching: `next: { revalidate: 3600 }` stores the result in Next's Data Cache
 * for one hour (~24 fetches/day), comfortably under the Query API rate limit.
 */
export async function runHogQL<T>(query: string): Promise<T[] | null> {
  const projectId = process.env.POSTHOG_PROJECT_ID;
  const key = process.env.POSTHOG_PERSONAL_API_KEY;
  if (!projectId || !key) return null; // empty-state fallback when unconfigured

  try {
    const res = await fetch(`${HOST}/api/projects/${projectId}/query/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
      next: { revalidate: 3600 }, // 1-hour Next Data Cache window
    });
    if (!res.ok) return null; // error → panel shows empty/error state
    const json = (await res.json()) as { results?: unknown };
    return (json.results as T[]) ?? null;
  } catch {
    return null; // analytics must never throw into the page
  }
}

/**
 * Clamp an externally-supplied day count to a non-negative integer before it is
 * embedded as a numeric literal in a HogQL string. The page passes a fixed
 * integer (7/30/90); this guard guarantees no raw string is ever interpolated
 * into a query (injection defense, T-09-08).
 */
function safeDays(days: number): number {
  return Math.max(0, Math.trunc(Number(days) || 0));
}

// ---------------------------------------------------------------------------
// HogQL query builders (DASH-04/05/06)
//
// Every builder returns a STATIC HogQL string. Event-name literals come from the
// typed EVENT catalog (never raw strings); the only numeric input (`days`) is
// clamped to an integer literal. No external/user value is interpolated.
// ---------------------------------------------------------------------------

/** DASH-04: distinct users completing each onboarding step (drop-off funnel). */
export function onboardingFunnelQuery(): string {
  return `SELECT properties.step_id AS step, count(DISTINCT person_id) AS users
FROM events
WHERE event = '${EVENT.ONBOARDING_STEP_COMPLETED}'
GROUP BY step
ORDER BY users DESC`;
}

/** DASH-05: tab-usage counts grouped by the visited tab. */
export function tabUsageQuery(): string {
  return `SELECT properties.tab AS tab, count() AS count
FROM events
WHERE event = '${EVENT.FEATURE_TAB_VISITED}'
GROUP BY tab
ORDER BY count DESC`;
}

/** DASH-05: check-in submissions grouped by method (manual vs shortcut ratio). */
export function checkinMethodQuery(): string {
  return `SELECT properties.method AS method, count() AS count
FROM events
WHERE event = '${EVENT.CHECKIN_SUBMITTED}'
GROUP BY method
ORDER BY count DESC`;
}

/** DASH-05: total notification-click events (click count only — no sent denominator). */
export function notificationClickQuery(): string {
  return `SELECT count() AS count
FROM events
WHERE event = '${EVENT.FEATURE_NOTIFICATION_CLICKED}'`;
}

/** DASH-05: total Shortcut-setup-viewed events. */
export function shortcutViewQuery(): string {
  return `SELECT count() AS count
FROM events
WHERE event = '${EVENT.FEATURE_SHORTCUT_SETUP_VIEWED}'`;
}

/** DASH-02/06: geo-fail check-ins bucketed by ISO week over the last N days. */
export function geoFailByWeekQuery(days: number): string {
  const n = safeDays(days);
  return `SELECT toStartOfWeek(timestamp) AS week, count() AS count
FROM events
WHERE event = '${EVENT.CHECKIN_GEO_FAILED}' AND timestamp >= now() - INTERVAL ${n} DAY
GROUP BY week
ORDER BY week`;
}

/** DASH-06: daily distinct active users (DAU/WAU basis) over the last N days. */
export function dauWauQuery(days: number): string {
  const n = safeDays(days);
  return `SELECT toDate(timestamp) AS day, count(DISTINCT person_id) AS count
FROM events
WHERE timestamp >= now() - INTERVAL ${n} DAY
GROUP BY day
ORDER BY day`;
}
