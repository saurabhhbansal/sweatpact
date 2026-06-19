---
phase: 05-cross-route-walkthrough-teaching-content
verified: 2026-06-18T19:30:00Z
status: human_needed
score: 4/5 must-haves verified
behavior_unverified: 1
overrides_applied: 0
behavior_unverified_items:
  - truth: "The first walkthrough check-in is clearly labeled as a practice check-in and does NOT register as a real check-in or affect stakes, penalties, or stats"
    test: "Open the app, navigate the tour to the shortcut_viewed step, open DevTools Network tab filtered to 'checkin', click 'Practice check-in'. Confirm zero requests to /api/checkin are issued and the dashboard check-in state is unchanged."
    expected: "Zero /api/checkin network requests; tour advances to next step; dashboard state identical before and after."
    why_human: "The HARD SAFETY grep gate passes (0 api/checkin references in executable code) and the practice control is co-located for auditability, but the absolute zero-network guarantee can only be confirmed by a browser DevTools Network-tab observation at runtime. This was explicitly deferred to production deployment by the user (STATE.md, 05-04-SUMMARY.md)."
human_verification:
  - test: "Navigate the full cross-route walkthrough in the live app: schedule → gym (on /dashboard) → challenge (navigates to /groups or /notifications) → money (/groups) → shortcut (/shortcut). Confirm coachmark only appears AFTER each route's anchor mounts — never spotlights empty space mid-navigation."
    expected: "Each coachmark appears only once the new page has loaded and the data-tour anchor element is in the DOM. No coachmark over empty/transitioning space."
    why_human: "The navigate-then-reveal dual-gate (pathname change + MutationObserver anchor mount) is correct code, but the sequencing invariant across real route transitions cannot be exercised by grep or a unit test — requires real browser navigation."
  - test: "Confirm the invited-path: sign in as a user with a pending challenge invite (pendingCount > 0 on /groups), run the tour to the challenge step. Confirm it routes to /notifications with 'Your partner challenged you' copy and the anchor on the first invite card."
    expected: "Challenge step navigates to /notifications; invited copy shown; data-tour=challenge on first invite card is spotlit."
    why_human: "Requires a real user with a pending invite in the database; behavior depends on data-pending-count DOM read at runtime."
  - test: "FINANCIAL SAFETY (highest priority): Open DevTools Network tab, filter to 'checkin'. Advance the tour to the shortcut step. Click 'Practice check-in'. Confirm zero requests to /api/checkin are issued. Confirm dashboard check-in state is unchanged."
    expected: "Zero /api/checkin network requests. Tour advances. No real check-in created."
    why_human: "The grep gate (api/checkin=0 in executable code) and co-located PracticeCheckIn code provide strong source-level evidence, but the runtime Network-tab observation is the only definitive proof that the browser issues no fetch to the check-in endpoint. Deferred to production by user."
---

# Phase 5: Cross-Route Walkthrough & Teaching Content — Verification Report

**Phase Goal:** The full walkthrough runs end-to-end across tabs for both entry paths, teaching and completing the four points through real in-context actions — including a clearly-labeled practice check-in that never touches real stakes.
**Verified:** 2026-06-18T19:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Walkthrough navigates across tabs/routes, dual-gated on pathname + anchor presence (navigate-then-reveal, TOUR-05) | PRESENT_BEHAVIOR_UNVERIFIED | `usePathname`/`useRouter` imported and used (line 5/206-207); `effectiveRoute()` helper at lines 86-94; navigation `useEffect` keyed on `currentStepId` pushes only when `target !== pathname` (lines 257-264); anchor-gate `MutationObserver` reused from Phase 4 (lines 235-245). Code is present and wired; the sequencing invariant across real route transitions requires human runtime confirmation. |
| 2 | Both entry paths work: self-starter (challenge step → /groups, "Start a pact" copy) and invited user (challenge step → /notifications, "Your partner challenged you" copy) | PRESENT_BEHAVIOR_UNVERIFIED | `readPendingCount()` at lines 72-78 reads `data-pending-count` DOM attribute; `effectiveRoute()` swaps challenge to `/notifications` when `pendingCount > 0` (lines 90-92); `CHALLENGE_INVITED_COPY` constant at lines 53-56; `stepCopy` useMemo resolves invited variant at lines 326-340; `data-pending-count={pendingCount}` on /groups `<main>` (groups/page.tsx line 143); `data-tour="challenge"` conditional on first invite `<li>` in notifications/client.tsx (line 238). Wired; invited-path runtime requires a real pending invite for confirmation. |
| 3 | Each teaching point completes via a real in-context action: gym (GymSurface), schedule/goal (ScheduleSurface), challenge/money (teaching-only + "Next →"), shortcut (PracticeCheckIn surface) | VERIFIED | `GymSurface` imported (line 13) and mounted with `onComplete={handleAdvance}` (line 387); `ScheduleSurface` imported (line 14) and mounted with `onComplete={handleAdvance}` (lines 380-385); challenge/money have no surface (return `undefined`, line 396) → card keeps "Next →"; `PracticeCheckIn` mounted for `shortcut_viewed` (lines 391-393); `CoachmarkCard` passes `surface` prop (line 448); `PLACEHOLDER_BODY` count = 0. All five STEPS carry D-07 routes in steps.ts (lines 63-68). |
| 4 | The practice check-in is clearly labeled, makes ZERO API calls, and never touches /api/checkin (TEACH-05) | PRESENT_BEHAVIOR_UNVERIFIED | HARD SAFETY GREP GATE: `grep -v '^//' coachmark-renderer.tsx \| grep -c 'api/checkin'` = **0**. `PracticeCheckIn` component at lines 122-183: no `fetch`, no `XMLHttpRequest`, no reference to any API endpoint in executable code; only side effect is `handleAdvance()` → TourProvider's existing `complete_step` PATCH. HTML comment at lines 111-120 documents the safety guarantee. Sub-label "Practice only — never counts toward stakes." present at line 179. Source-level evidence is complete; runtime Network-tab confirmation deferred to production by user (STATE.md). |
| 5 | 4-item getting-started checklist reflects progress; empty-state "Start your first pact" CTA shows when no challenges; copy is brand-voiced (UX-01/UX-02/UX-04) | VERIFIED | `GettingStartedChecklist` at `src/components/tour/getting-started-checklist.tsx`: iterates `TEACHING_KEYS` (line 46), success checkmark per completed key (lines 52-59), hides when all four complete (lines 36-38), driven by `completedSteps: string[]` prop (line 32), `useTour` count = 0. All four UI-SPEC labels present (lines 13-16). `EmptyStatePactCTA` at `src/components/tour/empty-state-pact-cta.tsx`: "No stakes yet" heading (line 16), brand-voiced body (line 17-19), "Start your first pact" CTA linking to /groups (lines 20-25), `get started` count = 0. Dashboard RSC: `getOnboardingProgress()` called (line 37), `completedSteps` passed to checklist (dashboard line 136), `challengeCount === 0` gates CTA (dashboard line 202). All five STEP_COPY entries in coachmark-renderer.tsx (lines 29-50) present with UI-SPEC copy. |

**Score:** 4/5 truths verified (1 present-behavior-unverified — SC4 practice check-in safety guarantee, awaiting runtime Network-tab confirmation)

Note: SC1 (navigate-then-reveal) and SC2 (invited path) are also `PRESENT_BEHAVIOR_UNVERIFIED` due to their state-transition / sequencing invariant nature, but they are captured in the human verification section rather than as failures. SC4 is the highest-priority human item due to financial-safety classification.

---

### Deferred Items

None. All phase 5 success criteria are implemented; no items are addressed by a later phase.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/onboarding/steps.ts` | `route?: string` on `OnboardingStep` + D-07 routes on all 5 STEPS | VERIFIED | `route?: string` at line 49; all 5 STEPS carry routes (lines 63-68); TOUR_VERSION = 1 (line 13) |
| `src/lib/onboarding/steps.test.ts` | Route-mapping + route-format + TOUR_VERSION stability tests | VERIFIED | Route-mapping test at lines 62-71; route-format test at lines 73-79; TOUR_VERSION stability at lines 81-83; all 13 tests pass |
| `src/components/tour/coachmark-card.tsx` | `surface?: React.ReactNode` prop + bounded-scroll slot + conditional Next | VERIFIED | `surface?: React.ReactNode` at line 28; scroll slot `max-h-[calc(80vh-8rem)] overflow-y-auto` at line 74; `{surface ? null : <Button>}` at line 97; tour library import count = 0 |
| `src/app/(tabs)/groups/page.tsx` | `data-tour="challenge"` + `data-tour="money"` + `data-pending-count` | VERIFIED | `data-tour="money"` on `<main>` (line 142); `data-pending-count={pendingCount}` on `<main>` (line 143); `data-tour="challenge"` on unconditionally-mounted search `<section>` (line 221); empty-state card has no anchor |
| `src/app/(tabs)/notifications/client.tsx` | `data-tour="challenge"` conditional on first invite card | VERIFIED | Attribute spread `{...(index === 0 && isInvite ? { "data-tour": "challenge" } : {})}` at line 238; gated correctly; only first pending invite carries the anchor |
| `src/app/(tabs)/shortcut/page.tsx` | `data-tour="shortcut_viewed"` on always-mounted element | VERIFIED | Anchor on `ShortcutSetup` wrapper `<div>` at line 32; id is exactly `shortcut_viewed` (matches `STEPS[].id`) |
| `src/components/tour/getting-started-checklist.tsx` | 4-item TEACHING_KEYS-driven checklist, completedSteps prop, hides when complete | VERIFIED | 75 lines, substantive; `TEACHING_KEYS` iterated (line 46); `completedSteps: string[]` prop (line 32); hides at line 36-38; all 4 UI-SPEC labels; `useTour` count = 0 |
| `src/components/tour/empty-state-pact-cta.tsx` | "No stakes yet" / "Start your first pact" CTA linking to /groups | VERIFIED | "No stakes yet" at line 16; "Start your first pact" at line 24; `href="/groups"` at line 21; `get started` count = 0; no `"use client"` (server component) |
| `src/app/(tabs)/dashboard/page.tsx` | Checklist + CTA + gym anchor wired from RSC reads | VERIFIED | `getOnboardingProgress()` imported and called (lines 7, 37); `GettingStartedChecklist completedSteps={completedSteps}` (line 136); `data-tour="gym"` on TodayActionCard wrapper (line 190); `EmptyStatePactCTA` under `challengeCount === 0` (line 202); no `fetch('/api/onboarding-progress')` self-fetch |
| `src/components/tour/coachmark-renderer.tsx` | Navigate-then-reveal, surface embedding, practice check-in, invited-path, brand-voiced copy | VERIFIED (source) + PRESENT_BEHAVIOR_UNVERIFIED (runtime) | `usePathname`/`useRouter` at lines 5, 206-207; `effectiveRoute()` at lines 86-94; navigation effect at lines 257-264; `GymSurface`/`ScheduleSurface` embedded with `onComplete={handleAdvance}`; `STEP_COPY` and `CHALLENGE_INVITED_COPY` present; `PracticeCheckIn` co-located; PLACEHOLDER_BODY = 0; `api/checkin` in executable code = 0; `MutationObserver` count = 2 |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `coachmark-renderer.tsx` | `src/lib/onboarding/steps.ts` | `.route` field on STEPS drives `effectiveRoute()` → `router.push` | WIRED | `step?.route ?? null` at line 89; STEPS imported at line 15 |
| `coachmark-renderer.tsx` | `src/components/onboarding/gym-surface.tsx` | `GymSurface` embedded in surface slot with `onComplete={handleAdvance}` | WIRED | Imported line 13; mounted at line 387 |
| `coachmark-renderer.tsx` | `src/components/onboarding/schedule-surface.tsx` | `ScheduleSurface` embedded in surface slot with `onComplete={handleAdvance}` | WIRED | Imported line 14; mounted at lines 380-385 |
| `coachmark-renderer.tsx` | `src/app/(tabs)/groups/page.tsx` | `data-pending-count` DOM read for invited-path detection | WIRED | `document.querySelector("[data-pending-count]")` at line 74; groups/page.tsx exposes the attribute at line 143 |
| `src/app/(tabs)/dashboard/page.tsx` | `src/lib/supabase/rsc.ts` | `getOnboardingProgress()` request-cached read for `completed_steps` | WIRED | Imported at line 7; called at line 37; no self-fetch |
| `src/app/(tabs)/dashboard/page.tsx` | `src/components/tour/getting-started-checklist.tsx` | `completedSteps` prop passed from RSC to checklist | WIRED | `<GettingStartedChecklist completedSteps={completedSteps} />` at dashboard line 136 |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `GettingStartedChecklist` | `completedSteps: string[]` | Dashboard RSC calls `getOnboardingProgress()` → `progress?.completed_steps ?? []` | Yes — server-side DB read via request-cached RLS-scoped reader | FLOWING |
| `EmptyStatePactCTA` | (no data — pure presentation; visibility gated in parent) | Dashboard RSC `challengeCount` from `group_members` head-count in `Promise.all` | Yes — real DB head count | FLOWING |
| `data-pending-count` | `pendingCount` integer | /groups RSC derives from `pendingInvites?.length ?? 0` (line 128 of groups/page.tsx) | Yes — real DB query | FLOWING |
| `STEP_COPY` / `CHALLENGE_INVITED_COPY` | Copy strings rendered in coachmark card | Static constant keyed by `currentStepId` | N/A — static copy, no data needed | VERIFIED |
| `GymSurface` embedded surface | `initialGymCount` | Passed as `0` (auto-skip-from-real-state deferred to Phase 6) | Neutral default — intentional | FLOWING (neutral) |
| `ScheduleSurface` embedded surface | `initialGoal`, `initialRestDays` | `initialGoal={4}`, `initialRestDays={[]}` (Phase 6 will seed from real state) | Neutral default — intentional | FLOWING (neutral) |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| steps.ts route field: all 5 STEPS carry D-07 routes | `npx vitest run src/lib/onboarding/steps.test.ts` | 13 tests passed | PASS |
| TypeScript: all modified files typecheck | `npx tsc --noEmit -p tsconfig.json` | No output (clean) | PASS |
| HARD SAFETY: no `/api/checkin` in executable code | `grep -v '^//' coachmark-renderer.tsx \| grep -c 'api/checkin'` | 0 | PASS |
| MutationObserver count (no second observer added) | `grep -c 'new MutationObserver' coachmark-renderer.tsx` | 2 (anchor gate + dialog pause — unchanged) | PASS |
| PLACEHOLDER_BODY removed | `grep -c 'Real lessons land in the next phase' coachmark-renderer.tsx` | 0 | PASS |
| All 5 UI-SPEC copy bodies present | `grep -c 'no gym, no proof'` = 1; `grep -c 'how it settles every week'` = 1 | 1 and 1 | PASS |
| GettingStartedChecklist: useTour not consumed (D-08) | `grep -c 'useTour' getting-started-checklist.tsx` | 0 | PASS |
| EmptyStatePactCTA: no generic copy | `grep -ci 'get started' empty-state-pact-cta.tsx` | 0 | PASS |
| CoachmarkCard: no tour library imports | `grep -c 'react-joyride\|useTour\|tour-provider' coachmark-card.tsx` | 0 | PASS |
| TOUR_VERSION unchanged | `grep -c 'TOUR_VERSION = 1' steps.ts` | 1 | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| TOUR-05 | 05-01, 05-04 | Walkthrough sequences across tabs/routes (navigate-then-reveal) | VERIFIED (source) | `effectiveRoute()` + navigation effect in coachmark-renderer.tsx; `route` field on STEPS |
| ONB-03 | 05-02, 05-04 | Both entry paths supported (self-starter + invited) | VERIFIED (source) | `data-pending-count` bridge; invited-path route swap; `CHALLENGE_INVITED_COPY`; conditional anchor on /notifications first invite card |
| TEACH-01 | 05-03, 05-04 | Gym setup taught in-context | VERIFIED | `data-tour="gym"` on dashboard; `GymSurface` embedded with `onComplete=handleAdvance` |
| TEACH-02 | 05-02, 05-04 | Challenge teaching in-context | VERIFIED | `data-tour="challenge"` on /groups (self-starter) and /notifications (invited); challenge teaching copy present |
| TEACH-03 | 05-02, 05-04 | Money model teaching anchored to real UI | VERIFIED | `data-tour="money"` on always-mounted /groups `<main>`; "This is the scoreboard that matters" copy present |
| TEACH-04 | 05-02, 05-04 | iOS Shortcut integration teaching, manual fallback | VERIFIED | `data-tour="shortcut_viewed"` on /shortcut; copy references both iOS Shortcut and manual check-in; `PracticeCheckIn` surface embedded |
| TEACH-05 | 05-04 | Practice check-in — zero API calls, never real check-in | PRESENT_BEHAVIOR_UNVERIFIED | Grep gate = 0; no fetch in `PracticeCheckIn`; safety comment present; runtime Network-tab confirmation deferred to production |
| SETUP-02 | 05-01, 05-04 | Weekly schedule/goal settable in-context during walkthrough | VERIFIED | `ScheduleSurface` embedded in `schedule` step with `onComplete=handleAdvance`; `surface` slot on `CoachmarkCard` |
| UX-01 | 05-03 | 4-item getting-started checklist reflects progress | VERIFIED | `GettingStartedChecklist` with `TEACHING_KEYS` iteration, `completedSteps` prop, self-hiding when complete |
| UX-02 | 05-03 | "Start your first pact" empty-state CTA on dashboard | VERIFIED | `EmptyStatePactCTA` gated on `challengeCount === 0`; consequence-first copy; links to /groups |
| UX-04 | 05-04 | Brand-voiced, outcome-framed copy for all five steps | VERIFIED | All 5 STEP_COPY entries + CHALLENGE_INVITED_COPY present in coachmark-renderer.tsx; "stakes not stats" framing confirmed |

All 11 requirement IDs declared across Phase 5 plans are accounted for. No orphaned requirements.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `coachmark-renderer.tsx` | 263 | `// eslint-disable-next-line react-hooks/exhaustive-deps` | Info | Intentional: `pathname` excluded from navigation effect deps to prevent the invited-path loop (CR-01 fix documented at line 253-256). Legitimate suppression with documented rationale. |
| `coachmark-renderer.tsx` | 339 | `// eslint-disable-next-line react-hooks/exhaustive-deps` | Info | Intentional: `dialogOpen` included as extra trigger in `stepCopy` useMemo without being directly referenced; documented at lines 335-338. |
| `coachmark-renderer.tsx` | 456 | `// eslint-disable-next-line react-hooks/exhaustive-deps` | Info | Intentional: `TooltipAdapter` memoized with empty deps by design (stable component reference pattern, WR-02). |

No TBD/FIXME/XXX unresolved debt markers found in phase 5 modified files. No unreferenced stubs. No hardcoded empty arrays in rendering paths.

---

### Human Verification Required

#### 1. Navigate-Then-Reveal Cross-Route Sequencing (TOUR-05)

**Test:** Start the dev server (`npm run dev`). Sign in as a user whose tour is active. Advance through all 5 steps: schedule → gym → challenge → money → shortcut. Each advance should navigate to the step's route (if different from current) and only reveal the coachmark once that route's `data-tour` anchor appears in the DOM.
**Expected:** Coachmarks never appear over empty/transitioning space. Each step reveals only after the new page's anchor element is mounted. The tour completes all 5 steps across at least 3 different routes.
**Why human:** The navigate-then-reveal invariant (pathname guard + MutationObserver anchor gate across real route transitions) cannot be exercised by grep or unit tests — it requires real browser navigation and DOM mutation observation.

#### 2. Invited-Path Route Swap (ONB-03)

**Test:** Sign in as a user who has a pending challenge invite (so `/groups` shows `pendingCount > 0`). Run the tour to the challenge step. Observe which route the step navigates to and what copy appears.
**Expected:** Challenge step routes to `/notifications` and shows "Your partner challenged you" / "This is where you respond. Accept the pact to put real money on the line — or decline." The anchor is on the first pending invite card.
**Why human:** Requires a real database row with a pending invite; the `data-pending-count` DOM read and consequent route swap are runtime-dependent.

#### 3. Practice Check-In Financial Safety (TEACH-05) — HIGHEST PRIORITY

**Test:** Open browser DevTools → Network tab, filter to "checkin". Navigate the tour to the shortcut step. Click "Practice check-in". Observe the network activity and your dashboard's check-in state.
**Expected:** Zero requests to `/api/checkin` are issued. The button shows a brief pulse (or advances immediately under reduced motion). The tour advances to the next step. The dashboard check-in count/status is unchanged — no real check-in was created.
**Why human:** The HARD SAFETY grep gate (0 `api/checkin` references in executable code) provides strong source-level assurance, but only the browser's Network inspector can definitively confirm zero runtime requests. Explicitly deferred to production by the user (STATE.md, 05-04-SUMMARY.md deviation #1).

---

### Gaps Summary

No gaps blocking goal achievement. All implementation artifacts exist, are substantive, and are wired. The three human verification items (navigate-then-reveal sequencing, invited-path swap, and practice check-in safety) represent behavior-dependent runtime confirmation rather than missing implementation — the code is present and source-level evidence is strong.

The phase goal is implemented. Status is `human_needed` because three behavior-dependent truths (two involving cross-route sequencing/state transitions, one involving a financial-safety invariant) require live-app confirmation that automated checks cannot substitute for. Task 4 of Plan 05-04 was explicitly deferred to production deployment by the user.

---

_Verified: 2026-06-18T19:30:00Z_
_Verifier: Claude (gsd-verifier)_
