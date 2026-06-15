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

- [ ] **Phase 1: Onboarding Data Foundation** - Server-side progress persistence (table, RLS, API)
- [ ] **Phase 2: Step Logic & Shared Setup Surfaces** - Pure step registry, completion probes, extracted gym/schedule/shortcut UIs
- [ ] **Phase 3: Minimal Start & TourProvider Wiring** - Username-only gate, provider mount, resume/replay plumbing (no coachmarks)
- [ ] **Phase 4: Coachmark Engine (single-route)** - Spotlight, click-through overlay, z-index, safe-area, a11y
- [ ] **Phase 5: Cross-Route Walkthrough & Teaching Content** - Navigate-then-reveal sequencing + the four teaching steps end-to-end
- [ ] **Phase 6: Skip-on-Complete, Replay & Completion Hardening** - Derived skip-already-done, replay from settings, version-drift safety, "pact is live" moment

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

- [ ] 01-02-PLAN.md — pure merge/validation helper (+ Vitest) and `GET/PATCH /api/onboarding-progress` route

### Phase 2: Step Logic & Shared Setup Surfaces

**Goal**: The walkthrough's "what to teach next" and "what's already done" decisions live in pure, unit-tested logic, and the gym/schedule/Shortcut UIs are reusable surfaces both the walkthrough and the legacy entry can mount with no logic fork.
**Depends on**: Phase 1
**Requirements**: TEACH-06, PROG-02, SETUP-01
**Success Criteria** (what must be TRUE):

  1. A step registry (`lib/onboarding/steps.ts`) and `TOUR_VERSION` constant define the ordered teaching steps and are covered by Vitest.
  2. Completion probes (`lib/onboarding/completion.ts`) derive "already done" from real app state (gym set, weekly goal set, Shortcut viewed) — not a duplicate flag — and are unit-tested for each step.
  3. The walkthrough is computed "complete" exactly when all four teaching points (gym, challenge, money, Shortcut) are presented/done, verified by tests.
  4. Gym, schedule, and Shortcut setup render from shared components driven by an `onComplete` callback; the legacy onboarding routes still work, now as thin shells hitting the same existing endpoints.

**Plans**: TBD
**UI hint**: yes

### Phase 3: Minimal Start & TourProvider Wiring

**Goal**: A new user completes a username-only mandatory start, lands directly in the real app, and a server-hydrated `TourProvider` tracks/persists their progress and can be resumed — all before any coachmark renders.
**Depends on**: Phase 2
**Requirements**: ONB-01, ONB-02, ONB-04
**Success Criteria** (what must be TRUE):

  1. A new user who sets only a username lands directly on the real dashboard — no forced setup wizard.
  2. The `(tabs)` redirect gate redirects only when username is missing; users with optional setup incomplete are no longer bounced to `/onboarding/schedule`.
  3. The `TourProvider` mounts in the `(tabs)` layout, hydrates from a server-side progress fetch on first paint (no client refetch flash), and persists advancement; reloading mid-walkthrough resumes at the same point.
  4. The user can skip/dismiss at any time and keep using the app, with the skip persisted so they are not re-prompted or nagged.

**Plans**: TBD
**UI hint**: yes

### Phase 4: Coachmark Engine (single-route)

**Goal**: A robust single-route coachmark renderer spotlights live UI one step at a time without trapping input, colliding with app chrome, breaking on mobile safe areas, or failing accessibility — the hardest technical surface, proven on one route before content rides on it.
**Depends on**: Phase 3
**Requirements**: TOUR-01, TOUR-02, TOUR-03, TOUR-04
**Success Criteria** (what must be TRUE):

  1. A coachmark spotlights a target element one at a time and only appears once that element is actually mounted (never highlighting empty/streamed space); conditionally-absent targets are skipped cleanly.
  2. The overlay is a click-through cutout that coexists with the z-40/z-50 nav stack, Radix dialogs (pausing while one is open), and the install gate — the page stays interactive and nothing hides behind chrome.
  3. Coachmarks position correctly within PWA safe-area insets, verified on a notched device in standalone mode.
  4. Coachmarks are keyboard-operable (advance / skip / dismiss), manage focus correctly, honor reduced-motion, and announce via aria-live.

**Plans**: TBD
**UI hint**: yes
**Research**: needs spike before planning — final library pick (react-joyride v3 vs Onborda/NextStep) and anchoring to content inside a Radix dialog (pause-resume vs portal-within-portal).

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

**Plans**: TBD
**UI hint**: yes

### Phase 6: Skip-on-Complete, Replay & Completion Hardening

**Goal**: The walkthrough self-heals around already-done state, can be replayed from Settings without breaking on stale targets, and lands a sharp brand-voiced completion moment — closing out the milestone.
**Depends on**: Phase 5
**Requirements**: PROG-03, UX-03
**Success Criteria** (what must be TRUE):

  1. Steps whose work is already done (gym set, weekly goal set, Shortcut viewed) are auto-skipped end-to-end, derived live from real app state.
  2. The user can replay the walkthrough anytime from Settings, and replay re-derives completion and handles `tour_version` changes gracefully — no crash on stale or removed step targets.
  3. A sharp, brand-voiced "pact is live" completion moment marks walkthrough/first-challenge completion.
  4. The legacy `/onboarding/*` redirect chain is cleaned up so no path re-forces the old wizard.

**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Onboarding Data Foundation | v1.1 | 1/2 | In Progress|  |
| 2. Step Logic & Shared Setup Surfaces | v1.1 | 0/TBD | Not started | - |
| 3. Minimal Start & TourProvider Wiring | v1.1 | 0/TBD | Not started | - |
| 4. Coachmark Engine (single-route) | v1.1 | 0/TBD | Not started | - |
| 5. Cross-Route Walkthrough & Teaching Content | v1.1 | 0/TBD | Not started | - |
| 6. Skip-on-Complete, Replay & Completion Hardening | v1.1 | 0/TBD | Not started | - |

---
*Roadmap created: 2026-06-14 for milestone v1.1 (Guided Onboarding Walkthrough)*
