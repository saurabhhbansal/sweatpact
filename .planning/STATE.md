---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Guided Onboarding Walkthrough
current_phase: 6
status: shipped
stopped_at: Phase 6 shipped — PR #79
last_updated: "2026-06-19T00:10:00.000Z"
last_activity: 2026-06-19
last_activity_desc: Phase 6 shipped — PR #79
progress:
  total_phases: 6
  completed_phases: 6
  total_plans: 18
  completed_plans: 18
  percent: 100
current_phase_name: skip-on-complete-replay-completion-hardening
---

# Project State: SweatPact

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-06-14)

**Core value:** Make showing up have a consequence — if you skip, you owe your partner.
**Current focus:** Phase 06 — skip-on-complete-replay-completion-hardening

## Current Position

Phase: 6
Plan: Not started
Status: Phase complete — ready for verification
Last activity: 2026-06-18 — Phase 6 complete

Progress: [████████░░] 83% (5/6 phases)

## Performance Metrics

**Velocity:**

- Total plans completed: 15
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 2 | - | - |
| 03 | 3 | - | - |
| 05 | 4 | - | - |
| 6 | 4 | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
| Phase 01 P01 | 5min | 2 tasks | 1 files |
| Phase 01 P02 | 2min | 2 tasks | 3 files |
| Phase 02 P01 | 3min | 2 tasks | 4 files |
| Phase 02 P02 | 25min | 3 tasks | 6 files |
| Phase 03 P01 | 2min | 2 tasks | 3 files |
| Phase 03 P02 | 3min | 2 tasks | 2 files |
| Phase 03 P03 | 2min | 3 tasks | 8 files |
| Phase 05 P01 | 8min | 2 tasks | 3 files |
| Phase 05 P02 | 3min | 3 tasks | 3 files |
| Phase 05 P03 | 4min | 3 tasks | 3 files |
| Phase 05 P04 | 25min | 3 tasks | 1 files |
| Phase 06 P01 | 8min | 3 tasks | 3 files |
| Phase 06 P02 | 3min | 2 tasks | 3 files |
| Phase 06 P03 | 33min | 2 tasks | 4 files |
| Phase 06 P04 | 2min | 3 tasks | 9 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work (locked for v1.1):

- Walkthrough "complete" = all four teaching points (gym, challenge, money, Shortcut) presented/done — drives Phase 2 completion logic.
- Both entry paths supported in v1.1: self-starter (start a challenge) and invited (accept a challenge invite) — Phase 5.
- First walkthrough check-in is a labeled PRACTICE check-in — never a real check-in, never affects stakes/penalties/stats — Phase 5.
- Skip-already-done is derived from real app state (gym set, weekly goal set, Shortcut viewed), not a duplicate flag — Phases 2 & 6.
- Coachmark engine library NOT yet picked (react-joyride v3 vs Onborda/NextStep) — spike required before Phase 4 planning.
- [Phase ?]: D-03: onboarding_progress is the runtime source of truth for tour state; profiles.onboarding_complete read only at backfill to seed it (Plan 01-01)
- [Phase 01]: D-04: PATCH /api/onboarding-progress accepts a single semantic complete_step key (dedupe-appended server-side), never a client full completed_steps array; replay is a no-op (Plan 01-02)
- [Phase 01]: onboarding-progress route uses non-admin createClient() only; owner RLS is the enforcement boundary, never service-role (Plan 01-02)
- [Phase ?]: [Phase 02]: D-04 step registry — TOUR_VERSION=1, ordered STEPS [schedule,gym,challenge,money,shortcut_viewed]; schedule is setup-bearing but NOT a completion-gating teaching key (Plan 02-01)
- [Phase ?]: [Phase 02]: completion probes derive from real state (gymCount, rest_days non-empty, completed_steps), no duplicate flag; isTourComplete reuses TEACHING_KEYS (Plan 02-01)
- [Phase 02]: setup surfaces (gym/schedule/shortcut) are onComplete-driven and own their own fetch+save against existing endpoints — no logic fork; same surface serves legacy wizard and Phase 3+ walkthrough (D-03 "not dummy", SETUP-01) (Plan 02-02)
- [Phase 02]: write-authority decouple — ShortcutSurface writes only shortcut_viewed; the onboarding_complete:true flip is confined to the legacy shell so a walkthrough mount cannot prematurely end onboarding (Phase-1 D-05) (Plan 02-02)
- [Phase ?]: deriveCurrentStep extracted as pure .ts not inlined in provider .tsx so ONB-04 resume/dismiss is unit-covered by Vitest (plan 03-01)
- [Phase ?]: getOnboardingProgress uses admin client with strict .eq(user_id, user.id) filter as sole access-control boundary post-0029 column lockdown (T-03-IDOR) (plan 03-01)
- [Phase ?]: D-03 enforced: per-page username + onboarding_complete redirects removed from all 8 (tabs) pages; layout gate is single source of truth (plan 03-03)
- [Phase ?]: Phase 5 Plan 01: TOUR_VERSION stays 1 — adding optional route field is not an add/remove/reorder/rename
- [Phase ?]: Phase 5 Plan 01: challenge route stays /groups in registry; invited /notifications swap resolved at runtime in renderer (D-09/D-10)
- [Phase ?]: Phase 5 Plan 01: CoachmarkCard widens to w-[360px] only when a surface is present; remains pure prop-driven (no tour import)
- [Phase ?]: [Phase 05]: Plan 02 — money anchored to always-mounted /groups <main> (not per-challenge standing) so the coachmark always has a target; teaching copy carries the lesson
- [Phase ?]: [Phase 05]: Plan 02 — pending-invite count surfaced as data-pending-count DOM attribute (D-09 zero-latency); challenge anchored to the unconditional search section, never the conditional empty-state card
- [Phase ?]: [Phase 05]: Plan 03 — Open Decision resolved via option 1: dashboard RSC reads completed_steps from request-cached getOnboardingProgress() and passes completedSteps as a prop; TourValue stays frozen (D-08), no extra client fetch/round trip
- [Phase ?]: [Phase 05]: Plan 03 — challengeCount derived from group_members head-count; EmptyStatePactCTA gated on challengeCount===0; data-tour=gym on always-mounted TodayActionCard wrapper
- [Phase 05]: Plan 04 — navigate-then-reveal driven by a currentStepId-keyed effect (router.push guarded by route≠pathname); reveal reuses the single Phase-4 anchor-gate observer (no second observer); TourValue not extended (D-08), TOUR_VERSION not bumped
- [Phase 05]: Plan 04 — practice check-in is cosmetic only (TEACH-05/D-05): zero fetch, zero /api/checkin, zero geo/submission_id; only side effect is handleAdvance() routing through TourProvider's existing complete_step PATCH; HARD SAFETY grep gate (api/checkin=0 in executable code) holds the financial boundary at the source
- [Phase 05]: Plan 04 — Task 4 human-verify checkpoint deferred to production deployment by user (runtime Network-tab confirmation of zero /api/checkin requests still outstanding)
- [Phase ?]: [Phase 06]: Plan 01 — real gymCount + restDays probe flows server-side from (tabs) layout RSC into deriveCurrentStep; no new client fetch (D-07), TourValue stays frozen (D-08)
- [Phase ?]: Pact-is-live overlay shown-once via pact_live_seen completed_steps entry (cross-device, not a teaching key)
- [Phase ?]: [Phase 06]: Plan 04 — legacy /onboarding/{gym,schedule,shortcut} wizard pages + step-indicator.tsx deleted (D-08/D-09); shared surfaces in src/components/onboarding/ and the username mandatory-start route untouched
- [Phase ?]: [Phase 06]: Plan 04 — username post-save redirect retargeted /onboarding/schedule -> /dashboard (D-10/D-01); (tabs) layout gate only bounces auto-usernames so /dashboard renders cleanly once a real username is claimed

### Pending Todos

None yet.

### Blockers/Concerns

- **Phase 4 research spike (required before planning):** final coachmark library pick (react-joyride v3 vs Onborda/NextStep) and Radix-dialog-internal anchoring strategy (pause-resume vs portal-within-portal). Flagged in research SUMMARY.md.
- **Open question carried into Phase 5:** invited-path tour variant branching in the step registry (aha = "accept" not "start").

## Deferred Items

Items acknowledged and carried forward / out of v1.1 scope:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Analytics | Per-step onboarding drop-off analytics (ANL-01) | Deferred to v1.x/v2 | 2026-06-14 |
| Engagement | Re-engagement nudge for non-converters (ANL-02) | Deferred to v1.x/v2 | 2026-06-14 |
| Teaching | Money coachmark anchored to user's own live numbers (TEACH-07) | Deferred to v2 | 2026-06-14 |
| Onboarding | Adaptive step ordering by entry path (ONB-05) | Deferred to v1.x/v2 | 2026-06-14 |

## Session Continuity

Last session: 2026-06-18T18:54:06.772Z
Stopped at: Completed 06-01-PLAN.md
Resume file: None
