# Roadmap: SweatPact

**Created:** 2026-06-14
**Active milestone:** v1.1 — Guided Onboarding Walkthrough

## Milestones

- ✅ **v1.0 MVP** — Shipped Baseline (existing app, documented as Milestone 0)
- 🚧 **v1.1 Guided Onboarding Walkthrough** — Phases 1-6 (in progress)

## Overview

v1.1 replaces SweatPact's front-loaded four-screen setup wizard with a minimal
mandatory start (username only) plus a contextual coachmark walkthrough that
teaches the app and completes optional setup in-context. The build is strictly
dependency-ordered: server-side persistence and pure step/completion logic land
first; shared action surfaces are extracted before any coachmark embeds them;
the `TourProvider` is wired and resume-verified with no coachmarks before the
spotlight engine is built; the single-route coachmark engine is hardened before
cross-route sequencing and teaching content ride on top of it; skip-already-done
and replay hardening land last. The north star throughout: the user is in the
real app immediately and the walkthrough teaches the four points (gym, stakes
challenge, money model, iOS Shortcut) by doing real in-context actions —
including one clearly-labeled practice check-in that never affects real stakes.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 1: Onboarding Data Foundation** - Server-side progress persistence (table, RLS, API)
- [x] **Phase 2: Step Logic & Shared Setup Surfaces** - Pure step registry, completion probes, extracted gym/schedule/shortcut UIs (completed 2026-06-15)
- [x] **Phase 3: Minimal Start & TourProvider Wiring** - Username-only gate, provider mount, resume/replay plumbing (no coachmarks) (completed 2026-06-17)
- [x] **Phase 4: Coachmark Engine (single-route)** - Spotlight, click-through overlay, z-index, safe-area, a11y (completed 2026-06-18)
- [x] **Phase 5: Cross-Route Walkthrough & Teaching Content** - Navigate-then-reveal sequencing + the four teaching steps end-to-end (completed 2026-06-18; Task 4 human-verify deferred to production)
- [x] **Phase 6: Skip-on-Complete, Replay & Completion Hardening** - Derived skip-already-done, replay from settings, version-drift safety, "pact is live" moment (completed 2026-06-18)

## Phase Details

### Phase 1: Onboarding Data Foundation

**Goal**: Walkthrough progress is durably persisted per user server-side, with an idempotent, validated read/write path that survives interruption and works across devices.
**Depends on**: Nothing (first phase)
**Requirements**: PROG-01, PROG-04
**Success Criteria** (what must be TRUE):

  1. A new `onboarding_progress` row exists per user, readable/writable only by its owner (RLS verified), capturing `mandatory_done`, `tour_version`, `last_step_id`, `completed_steps`, `dismissed`, and `completed_at`.
  2. `GET /api/onboarding-progress` returns the caller's current progress; `PATCH` records advancement and is idempotent on additive `completed_steps` appends (replaying the same write is a no-op).
  3. All writes are Zod-validated and reject malformed step keys or unknown fields.
  4. The persisted `tour_version` is present so a later replay can detect stale versions without breaking.**Plans**: 2 plans

**Wave 1**

- [x] 01-01-PLAN.md — `0030_onboarding_progress` migration (table + owner-only RLS + D-02 backfill + new-profile trigger) and apply to live DB

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02-PLAN.md — pure merge/validation helper (+ Vitest) and `GET/PATCH /api/onboarding-progress` route

### Phase 2: Step Logic & Shared Setup Surfaces

**Goal**: The walkthrough's "what to teach next" and "what's already done" decisions live in pure, unit-tested logic, and the gym/schedule/Shortcut UIs are reusable surfaces both the walkthrough and the legacy entry can mount with no logic fork.
**Depends on**: Phase 1
**Requirements**: TEACH-06, PROG-02, SETUP-01
**Success Criteria** (what must be TRUE):

  1. A step registry (`lib/onboarding/steps.ts`) and `TOUR_VERSION` constant define the ordered teaching steps and are covered by Vitest.
  2. Completion probes (`lib/onboarding/completion.ts`) derive "already done" from real app state (gym set, weekly goal set, Shortcut viewed) — not a duplicate flag — and are unit-tested for each step.
  3. The walkthrough is computed "complete" exactly when all four teaching points (gym, challenge, money, Shortcut) are presented/done, verified by tests.
  4. Gym, schedule, and Shortcut setup render from shared components driven by an `onComplete` callback; the legacy onboarding routes still work, now as thin shells hitting the same existing endpoints.

**Plans**: 2 plans
**UI hint**: yes

**Wave 1**

- [x] 02-01-PLAN.md — pure step registry (`steps.ts` + `TOUR_VERSION`) and completion/skip probes (`completion.ts`), both with co-located Vitest

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 02-02-PLAN.md — extract gym/schedule/Shortcut into shared `onComplete`-driven surfaces and rewire the legacy `/onboarding/*` routes as thin shells (same existing endpoints)

### Phase 3: Minimal Start & TourProvider Wiring

**Goal**: A new user completes a username-only mandatory start, lands directly in the real app, and a server-hydrated `TourProvider` tracks/persists their progress and can be resumed — all before any coachmark renders.
**Depends on**: Phase 2
**Requirements**: ONB-01, ONB-02, ONB-04
**Success Criteria** (what must be TRUE):

  1. A new user who sets only a username lands directly on the real dashboard — no forced setup wizard.
  2. The `(tabs)` redirect gate redirects only when username is missing; users with optional setup incomplete are no longer bounced to `/onboarding/schedule`.
  3. The `TourProvider` mounts in the `(tabs)` layout, hydrates from a server-side progress fetch on first paint (no client refetch flash), and persists advancement; reloading mid-walkthrough resumes at the same point.
  4. The user can skip/dismiss at any time and keep using the app, with the skip persisted so they are not re-prompted or nagged.

**Plans**: 3/3 plans complete
**UI hint**: yes

**Wave 1**

- [x] 03-01-PLAN.md — `getOnboardingProgress()` request-cached reader + pure `deriveCurrentStep()` helper (+ co-located Vitest, ONB-04 seam)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 03-02-PLAN.md — `TourProvider` + `useTour()` context (first in repo) and async `(tabs)/layout.tsx` gate + no-flash hydration + provider mount

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 03-03-PLAN.md — delete per-page username/`onboarding_complete` redirects from all 8 tab pages (preserve cycle gender, u/me, groups membership redirects)

### Phase 4: Coachmark Engine (single-route)

**Goal**: A robust single-route coachmark renderer spotlights live UI one step at a time without trapping input, colliding with app chrome, breaking on mobile safe areas, or failing accessibility — the hardest technical surface, proven on one route before content rides on it.
**Depends on**: Phase 3
**Requirements**: TOUR-01, TOUR-02, TOUR-03, TOUR-04
**Success Criteria** (what must be TRUE):

  1. A coachmark spotlights a target element one at a time and only appears once that element is actually mounted (never highlighting empty/streamed space); conditionally-absent targets are skipped cleanly.
  2. The overlay is a click-through cutout that coexists with the z-40/z-50 nav stack, Radix dialogs (pausing while one is open), and the install gate — the page stays interactive and nothing hides behind chrome.
  3. Coachmarks position correctly within PWA safe-area insets, verified on a notched device in standalone mode.
  4. Coachmarks are keyboard-operable (advance / skip / dismiss), manage focus correctly, honor reduced-motion, and announce via aria-live.

**Plans**: 3/3 plans complete
**UI hint**: yes
**Research**: resolved in 04-CONTEXT.md — D-01 picked react-joyride v3.1; Radix-dialog anchoring resolved via D-04 pause/hide (portal-within-portal deferred beyond Phase 5).

**Wave 1**

- [x] 04-01-PLAN.md — install react-joyride v3.1 (legitimacy gate), add `#tour-root` portal target, add dashboard `data-tour` anchor
- [x] 04-02-PLAN.md — pure `deriveDotStates` dot logic (+ Vitest) and `CoachmarkCard` visual shell (title/body/dots/Next/Skip)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 04-03-PLAN.md — `CoachmarkRenderer` (joyride wiring, click-through overlay, z-index, Radix pause, a11y, safe-area) via `next/dynamic` ssr:false, mounted in `(tabs)` layout, + human verification

### Phase 5: Cross-Route Walkthrough & Teaching Content

**Goal**: The full walkthrough runs end-to-end across tabs for both entry paths, teaching and completing the four points through real in-context actions — including a clearly-labeled practice check-in that never touches real stakes.
**Depends on**: Phase 4
**Requirements**: TOUR-05, ONB-03, TEACH-01, TEACH-02, TEACH-03, TEACH-04, TEACH-05, SETUP-02, UX-01, UX-02, UX-04
**Success Criteria** (what must be TRUE):

  1. The walkthrough navigates across tabs/routes and reveals each next step only once its anchor is mounted (dual-gated on pathname + anchor presence), completing the gym → challenge → money → Shortcut path without spotlighting empty space.
  2. Both entry paths work: a self-starter is taught to start a stakes challenge, and an invited user is taught to accept their partner's challenge invite.
  3. Each teaching point completes via a real in-context action against existing endpoints — set gym (Google Places), start/accept a stakes challenge, see the money model (earned/owed, penalties, settlement) anchored to real UI, and the iOS Shortcut step with manual check-in shown as the universal fallback for non-iOS users; the user can set their weekly schedule/goal in-context.
  4. The first walkthrough check-in is clearly labeled as a practice check-in and does NOT register as a real check-in or affect stakes, penalties, or stats.
  5. A 4-item "getting started" checklist reflects progress as real actions complete; the dashboard shows a "Start your first pact" empty-state CTA fallback for users who skip; copy is outcome-framed and brand-voiced.

**Plans**: 4/4 plans complete
**UI hint**: yes

**Wave 1** *(parallel — no file overlap)*

- [x] 05-01-PLAN.md — STEPS `route?` field (D-06/D-07) + `CoachmarkCard` inline `surface` slot (D-01/D-02/D-03)
- [x] 05-02-PLAN.md — cross-route `data-tour` anchors on /groups, /notifications, /shortcut + `data-pending-count` (TOUR-05/ONB-03/TEACH-02..04)
- [x] 05-03-PLAN.md — `GettingStartedChecklist` (UX-01) + `EmptyStatePactCTA` (UX-02) + dashboard gym anchor + RSC `completed_steps` wiring

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 05-04-PLAN.md — `CoachmarkRenderer` navigate-then-reveal + surface embedding + invited-path swap + pure-UI practice check-in (TEACH-05) + brand-voiced copy (Task 4 human verification deferred to production)

### Phase 6: Skip-on-Complete, Replay & Completion Hardening

**Goal**: The walkthrough self-heals around already-done state, can be replayed from Settings without breaking on stale targets, and lands a sharp brand-voiced completion moment — closing out the milestone.
**Depends on**: Phase 5
**Requirements**: PROG-03, UX-03
**Success Criteria** (what must be TRUE):

  1. Steps whose work is already done (gym set, weekly goal set, Shortcut viewed) are auto-skipped end-to-end, derived live from real app state.
  2. The user can replay the walkthrough anytime from Settings, and replay re-derives completion and handles `tour_version` changes gracefully — no crash on stale or removed step targets.
  3. A sharp, brand-voiced "pact is live" completion moment marks walkthrough/first-challenge completion.
  4. The legacy `/onboarding/*` redirect chain is cleaned up so no path re-forces the old wizard.

**Plans**: 4/4 plans complete
**UI hint**: yes

**Wave 1** *(all parallel — zero file overlap)*

- [x] 06-01-PLAN.md — wire real `gymCount`/`restDays` probes from the layout RSC into `deriveCurrentStep()` so already-done steps auto-skip with no flash (skip-on-complete hardening)
- [x] 06-02-PLAN.md — replay from Settings: extend `PatchBody`/`mergeProgress` with a `replay` signal and add the "Replay app tour" control to `SettingsForm` (PROG-03)
- [x] 06-03-PLAN.md — "Your pact is live." full-screen overlay on first active challenge, shown once via `pact_live_seen` (UX-03)
- [x] 06-04-PLAN.md — delete the legacy `/onboarding/{gym,schedule,shortcut}` wizard + `step-indicator.tsx`; repair the kept username route redirect

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Onboarding Data Foundation | v1.1 | 2/2 | Complete    | 2026-06-15 |
| 2. Step Logic & Shared Setup Surfaces | v1.1 | 2/2 | Complete   | 2026-06-15 |
| 3. Minimal Start & TourProvider Wiring | v1.1 | 3/3 | Complete    | 2026-06-17 |
| 4. Coachmark Engine (single-route) | v1.1 | 3/3 | Complete   | 2026-06-18 |
| 5. Cross-Route Walkthrough & Teaching Content | v1.1 | 4/4 | Complete    | 2026-06-18 |
| 6. Skip-on-Complete, Replay & Completion Hardening | v1.1 | 4/4 | Complete   | 2026-06-18 |

---
*Roadmap created: 2026-06-14 for milestone v1.1 (Guided Onboarding Walkthrough)*
