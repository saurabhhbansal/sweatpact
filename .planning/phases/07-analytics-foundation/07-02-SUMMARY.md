---
phase: 07-analytics-foundation
plan: "02"
subsystem: analytics
tags: [posthog, react-components, identity, pageview, typescript]
requires:
  - 07-01 (posthog-js installed, EVENT catalog)
provides:
  - PostHogProvider — SDK init wrapper with __loaded guard and StrictMode safety
  - PostHogPageview — manual $pageview capture on SPA route changes
  - PostHogIdentity — Supabase auth → PostHog identify/reset bridge
affects:
  - src/app/layout.tsx (wired in Plan 04)
tech_stack:
  added: []
  patterns:
    - posthog-js React provider pattern with manual pageview
    - onAuthStateChange subscription cleanup in useEffect
    - __loaded guard for race-condition safety between useEffect calls
key_files:
  created:
    - src/components/posthog-provider.tsx
    - src/components/posthog-pageview.tsx
    - src/components/posthog-identity.tsx
  modified: []
decisions:
  - capture_pageview:false required for SPA — automatic capture fires only once at init; manual PostHogPageview component handles per-route events
  - autocapture:false enforced — typed EVENT catalog is the sole event source, no uncontrolled noise
  - person_profiles:identified_only — no anonymous profiles until posthog.identify() is called
  - posthog.identify receives session.user.id (UUID) not email — UUID is non-guessable and contains no PII (T-07-03)
  - No __loaded guard in PostHogIdentity — identify() and reset() are safely queued internally before init; guard present in PostHogProvider and PostHogPageview where ordering matters
  - PostHogPageview needs Suspense wrapper in root layout (Plan 04) due to useSearchParams() static-generation bailout
metrics:
  duration: "3min"
  completed: "2026-06-27"
  tasks_completed: 2
  files_created: 3
  files_modified: 0
status: complete
requirements_satisfied:
  - FOUND-01
  - FOUND-02
---

# Phase 07 Plan 02: PostHog Client Components Summary

**One-liner:** Three PostHog client components created — SDK init provider with StrictMode guard, manual SPA pageview capture, and Supabase auth-state identity bridge.

## What Was Built

### Task 1 — PostHogProvider SDK init with useEffect guard (FOUND-01)

Created `src/components/posthog-provider.tsx` as a "use client" component wrapping children with `PHProvider` from `posthog-js/react`.

Key implementation decisions:
- `posthog.__loaded` guard in `useEffect([])` prevents double-init on React StrictMode double-invoke and HMR cycles
- `capture_pageview: false` — the SPA pattern requires manual capture per navigation; the automatic init-time capture misses all client-side route changes
- `autocapture: false` — typed EVENT catalog at `@/lib/analytics/events` is the only event source
- `person_profiles: "identified_only"` — no anonymous user profiles created before `posthog.identify()` is called
- `api_host` falls back to `"/ingest"` (reverse proxy path, configured in Plan 03) if `NEXT_PUBLIC_POSTHOG_HOST` is unset
- `defaults: "2026-01-30"` pins PostHog SDK defaults snapshot date

Returns `<PHProvider client={posthog}>{children}</PHProvider>` so all downstream components can use `usePostHog()` hook if needed.

### Task 2 — PostHogPageview and PostHogIdentity components (FOUND-01, FOUND-02)

**PostHogPageview** (`src/components/posthog-pageview.tsx`):
- "use client" component; returns `null` (no DOM output)
- Uses `usePathname()` and `useSearchParams()` from `next/navigation`
- `useEffect` with `[pathname, searchParams]` deps fires on every SPA navigation
- `!posthog.__loaded` guard prevents dropped events during the init race window
- Builds full URL from `window.origin + pathname + "?" + queryString` before capturing `$pageview`
- Requires `<Suspense fallback={null}>` wrapper in root layout (added Plan 04) — `useSearchParams()` causes static-generation bailout

**PostHogIdentity** (`src/components/posthog-identity.tsx`):
- "use client" component; returns `null` (no DOM output)
- `useEffect([])` creates a Supabase browser client and subscribes to `onAuthStateChange`
- `SIGNED_IN` with valid session → `posthog.identify(session.user.id)` — UUID only, no PII
- `SIGNED_OUT` → `posthog.reset()` — clears identified user so the next session starts fresh
- Cleanup function calls `subscription.unsubscribe()` on unmount

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 045e1df | feat | create PostHogProvider SDK init component (FOUND-01) |
| b679ea1 | feat | create PostHogPageview and PostHogIdentity components (FOUND-01, FOUND-02) |

## Verification Results

1. `ls src/components/posthog-{provider,pageview,identity}.tsx` — all three files exist: PASS
2. `npx tsc --noEmit` — exit 0, no TypeScript errors: PASS
3. `grep -c "capture_pageview.*false" src/components/posthog-provider.tsx` → 1: PASS
4. `grep -c "posthog.identify" src/components/posthog-identity.tsx` → 1: PASS
5. `grep -c "posthog.reset" src/components/posthog-identity.tsx` → 1: PASS

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all three components are complete implementations with no placeholder values or TODO markers. They are ready to be wired into the root layout in Plan 04.

## Threat Flags

No new network endpoints or auth paths beyond what was modeled in the plan's threat register.

| Flag | File | Description |
|------|------|-------------|
| threat_flag: Information Disclosure (T-07-03, mitigated) | posthog-identity.tsx | posthog.identify receives session.user.id (UUID) — not email or display name |

All T-07-03..T-07-06 mitigations applied as specified in the plan threat model.

## Self-Check: PASSED

- [x] src/components/posthog-provider.tsx exists
- [x] src/components/posthog-pageview.tsx exists
- [x] src/components/posthog-identity.tsx exists
- [x] All three files begin with "use client" directive
- [x] posthog-provider.tsx: capture_pageview:false, autocapture:false, posthog.__loaded guard
- [x] posthog-pageview.tsx: usePathname + useSearchParams, !posthog.__loaded guard, returns null
- [x] posthog-identity.tsx: onAuthStateChange, identify(user.id), reset(), unsubscribe cleanup, returns null
- [x] npx tsc --noEmit exits 0 (no TypeScript errors)
- [x] Commits 045e1df and b679ea1 exist in git log
