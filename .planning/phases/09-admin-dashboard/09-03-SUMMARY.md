---
phase: 09-admin-dashboard
plan: 03
subsystem: api
tags: [posthog, hogql, zod, analytics, server-only, next-data-cache]

# Dependency graph
requires:
  - phase: 08-event-instrumentation
    provides: PostHog EVENT catalog (onboarding/checkin/feature events) consumed by HogQL builders
  - phase: 09-admin-dashboard
    provides: 09-02 admin Supabase metrics groundwork (sibling plan, same wave)
provides:
  - Server-only PostHog Query API client (runHogQL) with fail-soft null fallback and Next Data-Cache revalidation
  - Seven static HogQL query builders for DASH-04/05/06 (funnel, tab usage, checkin method, notification clicks, shortcut views, geo-fail by week, DAU/WAU)
  - Zod response parsers (parseFunnelRows/parseAdoptionRows/parseEngagementRows/parseGeoFailRows) with null-on-failure
  - Exported row types (FunnelRow/AdoptionRow/EngagementRow/GeoFailRow) for Plans 05/06
  - Documented server-only env vars ADMIN_USER_IDS, POSTHOG_PERSONAL_API_KEY, POSTHOG_PROJECT_ID
affects: [09-admin-dashboard plan 05 (panels), 09-admin-dashboard plan 06 (page)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "PostHog Query API client via raw fetch() with next:{revalidate} (NOT posthog-node SDK)"
    - "Static HogQL builders using EVENT constants — no external/user interpolation"
    - "Zod safeParse on external response rows, null-on-mismatch degrades to empty state"

key-files:
  created:
    - src/lib/admin-posthog.ts
    - src/lib/admin-posthog.test.ts
  modified:
    - .env.example

key-decisions:
  - "Query API host hardcoded to https://eu.posthog.com (private), distinct from the eu.i. ingestion host"
  - "days input clamped via safeDays() to a non-negative integer before embedding as a HogQL numeric literal (injection defense)"
  - "Engagement parser keys the day/week column generically as `key` so DAU/WAU and other day-bucketed series share one parser"

patterns-established:
  - "Fail-soft analytics: runHogQL returns null on unset env / non-ok / thrown error — analytics never breaks the page"
  - "External JSON validated with Zod safeParse before render; null on shape mismatch"

requirements-completed: [DASH-04, DASH-05, DASH-06]

# Metrics
duration: 5min
completed: 2026-06-28
status: complete
---

# Phase 9 Plan 03: PostHog Query API Client & HogQL Builders Summary

**Fail-soft server-only PostHog Query API client (runHogQL on eu.posthog.com with revalidate:3600), seven static HogQL builders for DASH-04/05/06, and Zod parsers that degrade to the empty state on bad data**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-06-28T15:07:00Z
- **Completed:** 2026-06-28T15:11:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- `runHogQL<T>()` — server-only authenticated fetch to the PostHog Query API, cached in Next's Data Cache (`next: { revalidate: 3600 }`), returning `null` (never throwing) when unconfigured or on any failure.
- Seven static HogQL builders (`onboardingFunnelQuery`, `tabUsageQuery`, `checkinMethodQuery`, `notificationClickQuery`, `shortcutViewQuery`, `geoFailByWeekQuery`, `dauWauQuery`) — all using `EVENT.*` constants, no external interpolation; `days` clamped to a numeric literal.
- Four Zod parsers with exported row types, returning typed rows on success and `null` on null input or shape mismatch.
- Documented three server-only env vars in `.env.example`.

## Task Commits

1. **Task 1: runHogQL client + static HogQL builders + env docs** - `3a75845` (feat)
2. **Task 2 (RED): failing tests for Zod parsers** - `b363600` (test)
3. **Task 2 (GREEN): implement Zod response parsers** - `14dcedd` (feat)
4. **Acceptance-criterion fix: drop literal ingestion-host string from comment** - `5e5bde7` (fix)

## Files Created/Modified
- `src/lib/admin-posthog.ts` - runHogQL client, seven HogQL builders, four Zod parsers + exported row types
- `src/lib/admin-posthog.test.ts` - builder string assertions + parser success/null/shape-mismatch coverage (20 tests)
- `.env.example` - appended `# Admin Dashboard (Phase 9)` block: `ADMIN_USER_IDS`, `POSTHOG_PERSONAL_API_KEY`, `POSTHOG_PROJECT_ID` (all server-only, no NEXT_PUBLIC_ prefix)

## Decisions Made
- Hardcoded the private Query API host `https://eu.posthog.com` (RESEARCH Pitfall 2: the ingestion host 404s the Query API).
- Added a `safeDays()` clamp so the only numeric input embedded into HogQL is guaranteed a non-negative integer literal (T-09-08 injection defense), and unit-tested the clamp.
- `parseEngagementRows` keys its first column generically (`key`) to serve both DAU/WAU day buckets and any other day/week-keyed series.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Acceptance compliance] Removed literal `eu.i.posthog.com` from explanatory comment**
- **Found during:** Post-task verification of Task 1 acceptance criteria
- **Issue:** The "do not use the ingestion host" warning comment literally contained `eu.i.posthog.com`, which would fail the acceptance grep "Source does NOT contain `eu.i.posthog.com`".
- **Fix:** Reworded the comment to reference "the `eu.i.` subdomain" without the full literal, preserving the warning.
- **Files modified:** src/lib/admin-posthog.ts
- **Verification:** Grep confirms 0 occurrences of `eu.i.posthog.com`; `https://eu.posthog.com` still present; 20 tests pass.
- **Committed in:** `5e5bde7`

---

**Total deviations:** 1 auto-fixed (1 acceptance-criterion compliance)
**Impact on plan:** Cosmetic comment change to satisfy the literal grep acceptance check. No behavior change, no scope creep.

## Issues Encountered
- `.env.example` is blocked from the Read/Grep/`cat` tools by this environment's permission settings. The append (`printf >> .env.example`) succeeded and the committed content uses no `NEXT_PUBLIC_` prefix on any of the three new keys, so the acceptance criterion is met by construction; it could not additionally be re-verified by reading the file back.

## User Setup Required

DASH-04/05/06 panels render data only when the PostHog Query API is configured. Owner must set (server-only, in `.env.local` / Vercel):
- `POSTHOG_PERSONAL_API_KEY` — PostHog → Settings → Personal API Keys → create with "Query Read" scope
- `POSTHOG_PROJECT_ID` — PostHog → Project Settings → Project ID
- `ADMIN_USER_IDS` — comma-separated owner Supabase Auth user UUID(s)

Without these, `runHogQL` returns `null` and the panels show their locked empty state; the `/admin` page still loads for the owner.

## Next Phase Readiness
- Plan 05 (panels) and Plan 06 (page) can import the builders, `runHogQL`, the parsers, and the exported row types directly.
- No blockers. Threat mitigations T-09-07 (server-only secrets), T-09-08 (static queries), T-09-09 (Zod validation), T-09-10 (revalidate cache) are all implemented in this plan.

## Self-Check: PASSED

- FOUND: src/lib/admin-posthog.ts
- FOUND: src/lib/admin-posthog.test.ts
- FOUND commit 3a75845, b363600, 14dcedd, 5e5bde7

---
*Phase: 09-admin-dashboard*
*Completed: 2026-06-28*
