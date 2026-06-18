---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Guided Onboarding Walkthrough
current_phase: 04
current_phase_name: coachmark-engine-single-route
status: executing
stopped_at: Phase 4 UI-SPEC approved
last_updated: "2026-06-18T07:19:57.788Z"
last_activity: 2026-06-18
last_activity_desc: Phase 04 execution started
progress:
  total_phases: 6
  completed_phases: 3
  total_plans: 10
  completed_plans: 7
  percent: 50
---

# Project State: SweatPact

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-06-14)

**Core value:** Make showing up have a consequence — if you skip, you owe your partner.
**Current focus:** Phase 04 — coachmark-engine-single-route

## Current Position

Phase: 04 (coachmark-engine-single-route) — EXECUTING
Plan: 1 of 3
Status: Executing Phase 04
Last activity: 2026-06-18 — Phase 04 execution started

Progress: [███░░░░░░░] 33%

## Performance Metrics

**Velocity:**

- Total plans completed: 7
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 2 | - | - |
| 03 | 3 | - | - |

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

Last session: 2026-06-18T07:02:26.766Z
Stopped at: Phase 4 UI-SPEC approved
Resume file: .planning/phases/04-coachmark-engine-single-route/04-UI-SPEC.md
