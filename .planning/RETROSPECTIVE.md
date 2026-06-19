# Retrospective: SweatPact

## Milestone: v1.1 — Guided Onboarding Walkthrough

**Shipped:** 2026-06-19
**Phases:** 6 | **Plans:** 18 | **Timeline:** 5 days (2026-06-14 → 2026-06-19)
**Files changed:** 171 | **Lines:** +19,298 / -512

### What Was Built

1. Server-side `onboarding_progress` table with owner-only RLS + idempotent PATCH API (Phase 1)
2. Pure step registry (STEPS, TOUR_VERSION, TEACHING_KEYS) and completion probes + shared GymSurface/ScheduleSurface/ShortcutSurface (Phase 2)
3. `TourProvider` context with server-hydration and username-only entry gate — per-page onboarding bounces removed from all 8 tab pages (Phase 3)
4. react-joyride v3.1 CoachmarkRenderer: click-through overlay, z-[100] in #tour-root, Radix-dialog pause, a11y, safe-area (Phase 4)
5. Cross-route navigate-then-reveal sequencing + both entry paths + embedded teaching surfaces + brand-voiced copy + practice check-in zero-API safety (Phase 5)
6. Auto-skip from real app state (gymCount/restDays from layout RSC), replay from Settings, "pact is live" overlay, legacy wizard deleted (Phase 6)

### What Worked

- **Strict dependency ordering** — server persistence before UI, pure logic before components, engine before content. Never hit a "I need Phase N to build Phase N-1" issue.
- **Pure function seam pattern** — extracting `deriveCurrentStep()` and `deriveDotStates()` as pure `.ts` (not inlined in context/components) made them Vitest-coverable and made the context types stay stable across all phases.
- **Hard safety gate pattern** — the HARD SAFETY grep gate (`grep -v '^//' coachmark-renderer.tsx | grep -c 'api/checkin'` = 0) as a documented invariant gave strong confidence in the financial boundary without requiring a browser runtime test.
- **Frozen TourValue API (D-08)** — the decision to freeze `useTour()` to `{ currentStepId, isActive, advance, dismiss }` at Phase 3 and never extend it meant all later phases could embed it without ripple effects.
- **Data-pending-count DOM bridge** — using a `data-pending-count` DOM attribute on /groups `<main>` as the invited-path signal was an elegant zero-round-trip solution for the self-starter vs. invited branch decision.

### What Was Inefficient

- **TOUR-01..04 checkboxes not updated in REQUIREMENTS.md** — Phase 4 shipped all four requirements but the checkboxes were left unchecked. Had to correct this at milestone archive. Small process gap.
- **UAT skipped in Phases 03, 04, 06** — 10+ UAT scenarios were skipped by user decision during execution. This left the audit tool flagging "partial" UAT at close. Runtime behavior confidence relies entirely on verification artifacts.
- **Phase 05 human_needed verification** — three runtime items (navigate-then-reveal sequencing, invited-path swap, practice check-in Network-tab proof) were explicitly deferred to production. These represent legitimate behavior-dependent tests but create a residual uncertainty at close.

### Patterns Established

- **`data-tour` anchor convention**: DOM attributes on always-mounted wrappers as coachmark targets; MutationObserver anchor gate in CoachmarkRenderer ensures coachmark appears only after anchor is in DOM.
- **Setup surfaces pattern**: `onComplete`-driven components (`GymSurface`, `ScheduleSurface`, `ShortcutSurface`) that own their own fetch+save, callable from both walkthrough and legacy entry — no logic fork.
- **navigate-then-reveal pattern**: `router.push` guarded by `route !== pathname` in a `currentStepId`-keyed effect; coachmark reveal gated on both pathname match AND MutationObserver anchor present.
- **shown-once pattern via completed_steps**: features that should show only once (pact-live overlay) use a `pact_live_seen` key in `completed_steps` rather than a separate DB column.

### Key Lessons

1. Freezing context API early and keeping domain logic in pure `.ts` pays dividends across every later phase — don't skip this even when it feels like overhead.
2. Grep-gate safety invariants (zero-count checks in CI-friendly shell commands) are a practical substitute for network-level runtime tests in financial-boundary code.
3. When tests are skipped in execution, verification files carry the epistemic weight — write them thoroughly.
4. The `data-tour` anchor + MutationObserver pattern is robust for dynamic RSC-rendered pages where elements may arrive asynchronously.

### Cost Observations

- Model mix: sonnet throughout (quality mode)
- Sessions: ~6 sessions across 5 days
- Notable: Wave-based parallelization within Phase 5 (Plans 01–03 parallel, Plan 04 blocked on them) was the most complex coordination but saved significant execution time.

---

## Cross-Milestone Trends

| Milestone | Phases | Plans | Days | Files | Lines |
|-----------|--------|-------|------|-------|-------|
| v1.1 | 6 | 18 | 5 | 171 | +19,298 |

*(Add rows as milestones ship)*
