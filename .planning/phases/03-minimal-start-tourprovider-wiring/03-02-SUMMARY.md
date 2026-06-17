---
phase: "03"
plan: "02"
subsystem: onboarding/tour
status: complete
tags: [tour-provider, react-context, layout-gate, server-hydration]
completed: "2026-06-17"

dependency_graph:
  requires:
    - "03-01 (getOnboardingProgress reader + deriveCurrentStep)"
    - "01-02 (PATCH /api/onboarding-progress, PatchBody.strict())"
    - "02-01 (STEPS registry, deriveCurrentStep probes)"
  provides:
    - "TourProvider context provider + useTour() hook (src/components/tour-provider.tsx)"
    - "username-only gate in (tabs)/layout.tsx"
    - "server-hydrated TourProvider mount in (tabs)/layout.tsx"
  affects:
    - "All (tabs) routes — now wrapped in TourProvider"
    - "Phase 4 coachmarks — will consume useTour()"

tech_stack:
  added: []
  patterns:
    - "React createContext/useContext — first context provider in the codebase"
    - "RSC reads DB → passes prop to \"use client\" child (no-flash hydration)"
    - "Optimistic setState + best-effort fetch().catch(()=>{}) write pattern"
    - "Async RSC layout gate (await before JSX return)"

key_files:
  created:
    - "src/components/tour-provider.tsx"
  modified:
    - "src/app/(tabs)/layout.tsx"

decisions:
  - "D-01: username-only gate centralized in (tabs)/layout.tsx — no per-page divergence"
  - "D-02: onboarding_complete check removed entirely — wizard bounce deleted"
  - "D-04: layout hydrates progress via getOnboardingProgress() (direct DB read, not self-fetch)"
  - "D-05: TourProvider wraps {children} in layout — no wrapper element"
  - "D-06: null initialProgress falls back to defaultProgress() blank slate"
  - "D-08: advance/dismiss are best-effort (optimistic state + fire-and-forget PATCH)"
  - "TourValue frozen at 4 members: currentStepId, isActive, advance, dismiss (Phase 4+ extends)"

metrics:
  duration: "5min"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 1
---

# Phase 03 Plan 02: TourProvider + Layout Gate Summary

**One-liner:** React context provider with frozen 4-member `useTour()` contract, server-hydrated from `getOnboardingProgress()` in an async `(tabs)/layout.tsx` that gates on username-only with no `onboarding_complete` bounce.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Create TourProvider + useTour() hook | `22b87e4` | src/components/tour-provider.tsx (NEW) |
| 2 | Wire (tabs)/layout.tsx — async gate + hydration + TourProvider mount | `3c7e5bc` | src/app/(tabs)/layout.tsx |

## What Was Built

### Task 1: TourProvider context provider + useTour() hook

Created `src/components/tour-provider.tsx` as the codebase's first React context provider:

- `"use client"` directive; imports `createContext`, `useContext`, `useMemo`, `useState`
- `TourValue` type frozen at exactly 4 members: `currentStepId`, `isActive`, `advance`, `dismiss`
- `TourContext = createContext<TourValue | null>(null)`
- `TourProvider` seeds `useState` from `initialProgress ?? defaultProgress()` — no `useEffect` fetch
- `currentStepId` derived via `useMemo(() => deriveCurrentStep(...), [progress.completed_steps, progress.dismissed])` with neutral Phase-3 probe state (gymCount 0, restDays [])
- `advance(stepId)`: optimistic `setProgress` + PATCH `{ complete_step, last_step_id }` (never `completed_steps`)
- `dismiss()`: optimistic `setProgress({ dismissed: true })` + PATCH `{ dismissed: true }`
- Both writes are best-effort via `.catch(() => {})` (optional surface, D-08)
- Provider returns `<TourContext.Provider value={value}>{children}</TourContext.Provider>` — no wrapper DOM element
- `useTour()` throws `"useTour must be used within TourProvider"` when context is null

### Task 2: Wire (tabs)/layout.tsx

Modified `src/app/(tabs)/layout.tsx`:

- `TabsLayout` converted from synchronous to `async`
- Added `isAutoUsername(u)` helper with exact regex `/^user_[a-f0-9]{8}$/` (copied from username/page.tsx)
- Gate: `await getViewerProfile()` → redirect `/login` when null, redirect `/onboarding/username` when auto-username
- No `onboarding_complete` check, no `redirect("/onboarding/schedule")` (D-02 removed)
- Hydration: `const initialProgress = await getOnboardingProgress()` — direct request-cached DB read, not a self-fetch
- JSX: `<TourProvider initialProgress={initialProgress}>{children}</TourProvider>` with no wrapper div
- Preserved verbatim: `RefreshOnFocus`, both `<Suspense>` nav slots (`TopBar`/`BottomBar`), aria-hidden header spacer, `export const dynamic = "force-dynamic"`

## Verification

- `npx tsc --noEmit` exits 0 (strict mode, no errors)
- `npm test` — 123/123 tests pass, no regressions
- Grep: no `onboarding_complete` logic (only comments), no `redirect("/onboarding/schedule")`, no `fetch("/api/onboarding-progress")` self-fetch, no `NEXT_PUBLIC_SITE_URL` in layout
- Grep: PATCH bodies contain only `{ complete_step, last_step_id }` and `{ dismissed: true }` — never `completed_steps`

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. TourProvider is infrastructure only (no coachmark UI). Phase 4 will consume `useTour()` to render coachmarks.

## Threat Flags

No new security surface introduced beyond what the plan's threat model covers:

- `T-03-FORGE` mitigated: `advance`/`dismiss` send only `PatchBody.strict()`-compliant bodies
- `T-03-SMUGGLE` mitigated: no `completed_steps` in any PATCH body
- `T-03-GATE` mitigated: single async layout gate, no per-page divergence

## Self-Check: PASSED

- FOUND: src/components/tour-provider.tsx
- FOUND: src/app/(tabs)/layout.tsx
- FOUND commit 22b87e4 (Task 1)
- FOUND commit 3c7e5bc (Task 2)
