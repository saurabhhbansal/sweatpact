# Phase 2: Step Logic & Shared Setup Surfaces - Context

**Gathered:** 2026-06-15
**Status:** Ready for planning

<domain>
## Phase Boundary

The walkthrough's "what to teach next" and "what's already done" decisions live in
pure, unit-tested logic, and the gym/schedule/Shortcut setup UIs become reusable
surfaces that both the walkthrough and the legacy entry mount with no logic fork.

**Delivers:**
- `lib/onboarding/steps.ts` — ordered step registry + `TOUR_VERSION` constant (Vitest).
- `lib/onboarding/completion.ts` — pure completion/skip probes deriving "already done" from real app state (Vitest per step).
- Extracted, self-contained gym / schedule / Shortcut setup components driven by an `onComplete` callback; legacy `onboarding/{gym,schedule,shortcut}` routes rewired as thin shells over the same components and the SAME existing endpoints.

**Requirements:** TEACH-06, PROG-02, SETUP-01.

**Not this phase:** TourProvider wiring + minimal username-only start (Phase 3), the coachmark/spotlight engine (Phase 4), cross-route sequencing + teaching content end-to-end (Phase 5), skip-on-complete/replay/version-drift hardening (Phase 6). This phase builds the *logic and surfaces*; nothing renders a coachmark yet.
</domain>

<decisions>
## Implementation Decisions

### "Tour complete" definition (resolves Phase 1 Open Q3)
- **D-01:** **Presented = enough.** A teaching point is satisfied the moment its step is presented — its semantic key is appended to `completed_steps` on present (via the Phase-1 PATCH `{ complete_step: <key> }`). `completion.ts` computes the walkthrough "complete" exactly when all four teaching keys (`gym`, `challenge`, `money`, `shortcut_viewed`) are present in `completed_steps`, at which point `completed_at` is set (Phase 1 only persists the field; this phase owns the rule). `challenge` and `money` are informational teaching points with no setup action — presenting them is sufficient and never strands the user on optional setup.

### Auto-skip "already done" probes (PROG-02) — Claude's Discretion (user said "you decide")
- **D-02:** Probes derive from **real app state, never a duplicate flag** (PROG-02 explicitly forbids a duplicate flag):
  - **gym set** → `user_gyms` row count > 0 (same source the existing gym onboarding already reads as `initialGymCount`).
  - **weekly goal / schedule set** → use an explicit real-state edit signal, NOT `profiles.weekly_goal` directly: `weekly_goal` defaults to `4`, so a default is indistinguishable from a deliberate choice. Primary signal = `profiles.rest_days` non-empty (a fresh profile has `rest_days = '{}'`; editing the schedule sets it). The planner/researcher MAY substitute a stronger real-state signal if one exists in the schema, but MUST NOT introduce a duplicate boolean flag.
  - **Shortcut viewed** → `shortcut_viewed` semantic key present in `completed_steps` (Phase 1 D-05 — lives in the JSONB array, no dedicated column).
  - All probes are **pure functions** over passed-in state (e.g. `gymCount`, `restDays`/`weeklyGoal`, `completedSteps`), unit-tested per step. No DB access inside the probe — the caller supplies state.

### Shared setup surface contract (SETUP-01) — Claude's Discretion (user: "you decide, I want it to not be dummy")
- **D-03:** Each setup surface (gym, schedule, Shortcut) is extracted as a **self-contained** component that owns its own data fetch + save against the **existing endpoints** (no new endpoints, no logic fork). It is explicitly **NOT** a pure presentational/"dummy" view. The only injected behavior is an **`onComplete` callback** (plus a skip affordance):
  - Legacy `onboarding/{gym,schedule,shortcut}` routes become thin shells rendering the shared component with `onComplete = router.push(next)` — preserving today's linear wizard.
  - The walkthrough (Phase 3+) renders the SAME component with `onComplete = advance-the-tour` (append the step key via the Phase-1 PATCH, then move on).
  - Both paths hit identical save logic and identical existing endpoints — the "no logic fork" guarantee.

### Step registry shape
- **D-04:** `lib/onboarding/steps.ts` exports an **ordered array of uniform entries** `{ id, title, surface?, probe? }`. The four teaching points (`gym`, `challenge`, `money`, `shortcut`) are entries; `surface` and `probe` are **optional** — `challenge`/`money` are presented-only (no surface, no probe), while `gym`/`schedule`/`shortcut` carry a `surface` (the shared component) and a `probe` (the D-02 completion check). `TOUR_VERSION` is a constant bumped whenever the ordered set or identity of steps changes (this is the opaque integer Phase 1 persists; it drives PROG-04 replay drift detection in Phase 6).

### Note on schedule vs the four teaching points
- `schedule` (weekly goal) is an **optional setup surface with a probe** but is **not** one of the four completion-gating teaching points (gym, challenge, money, Shortcut). It can be skipped without blocking "complete." Keep it in the registry as a setup-bearing step, distinct from the four teaching keys that gate completion.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/ROADMAP.md` §"Phase 2: Step Logic & Shared Setup Surfaces" — goal + 4 success criteria.
- `.planning/REQUIREMENTS.md` — TEACH-06 (complete = all four taught/done), PROG-02 (auto-skip from real state, not a duplicate flag), SETUP-01 (reusable surfaces, no logic fork, existing endpoints).

### Prior-phase decisions this phase builds on
- `.planning/phases/01-onboarding-data-foundation/01-CONTEXT.md` — semantic step keys (`gym`, `challenge`, `money`, `shortcut_viewed`), D-04 single-key idempotent PATCH, D-05 `shortcut_viewed` in `completed_steps`, `tour_version` opaque int default 1, Open Q3 (tour-complete rule) deferred here.
- `src/lib/onboarding-progress.ts` + `src/app/api/onboarding-progress/route.ts` — the Phase-1 PATCH `{ complete_step }` write path the surfaces/registry drive.

### Research
- `.planning/research/SUMMARY.md` — write-path, Pitfall 4 (write races) & Pitfall 6 (tour-version drift), Open Questions 3 & 5.
- `.planning/research/PITFALLS.md` — Pitfall 6 (tour-version drift) is relevant to `TOUR_VERSION` semantics.

### Codebase conventions
- `.planning/codebase/CONVENTIONS.md`, `.planning/codebase/STRUCTURE.md`, `.planning/codebase/TESTING.md` — naming, layering (`src/lib/*` pure + co-located `*.test.ts`), Vitest expectations.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (to extract / wrap — the SETUP-01 work)
- `src/app/onboarding/gym/client.tsx` (`GymOnboarding({ initialGymCount })`, 203 lines) — gym search (`/api/places/search`), geolocation, gym save; currently owns `router.push` to next step. Hoist navigation behind `onComplete`.
- `src/app/onboarding/schedule/client.tsx` (`ScheduleForm({ initialGoal, initialRestDays })`, 144 lines) — weekly goal + rest-days picker; saves via `PATCH /api/profile`; owns `router.push`. Source of the `rest_days` "set" signal (D-02).
- `src/app/onboarding/shortcut/client.tsx` (`FinishOnboardingButtons()`, 46 lines) — currently PATCHes `/api/profile { onboarding_complete: true }` then routes to `/dashboard`. The Shortcut "viewed" signal becomes `shortcut_viewed` in `completed_steps` (D-05), decoupled from the legacy `onboarding_complete` write.
- `src/app/(tabs)/u/[username]/weekly-goal-picker.tsx`, `src/app/(tabs)/settings/gyms-section.tsx` — existing in-app goal/gym editors; reference for shared-surface behavior outside onboarding.

### Established Patterns
- `src/lib/*` domain logic is pure + has co-located `*.test.ts` (proven in Phase 1 with `onboarding-progress.ts`). `steps.ts` and `completion.ts` follow this exactly.
- Existing endpoints to reuse (no new ones): `PATCH /api/profile` (weekly_goal, rest_days), `/api/places/search` + gym save (gym), `PATCH /api/onboarding-progress` (append step keys).

### Integration Points
- `completion.ts` probes are consumed in Phase 3+ to decide auto-skip; `steps.ts` ordered registry + `TOUR_VERSION` is consumed by the TourProvider (Phase 3) and replay hardening (Phase 6).
- Shared surfaces are mounted by the walkthrough (Phase 4/5) and by the rewired legacy routes (this phase).

</code_context>

<specifics>
## Specific Ideas

- User: shared setup components must "not be dummy" — they own real fetch + save behavior, parameterized only by `onComplete` (+ skip), not split into inert presentational shells.
- Completion is deliberately lenient ("presented = enough") so a user is never blocked on optional gym/schedule/Shortcut setup to finish the tour; auto-skip probes still prevent re-teaching things already done.

</specifics>

<deferred>
## Deferred Ideas

- TourProvider wiring, resume/replay plumbing, username-only minimal start — Phase 3.
- Coachmark/spotlight engine, overlay, z-index, a11y — Phase 4.
- Cross-route navigate-then-reveal sequencing + the four teaching steps rendered end-to-end — Phase 5.
- `TOUR_VERSION` *drift handling* on replay (stale-target safety) — Phase 6 (this phase only defines the constant + bump rule).
- Stronger "weekly goal set" real-state signal, if research finds one better than `rest_days` non-empty — open for the planner, but a duplicate flag stays forbidden (PROG-02).

None of the above is scope creep — all are downstream phases already on the roadmap.

</deferred>

---

*Phase: 2-step-logic-shared-setup-surfaces*
*Context gathered: 2026-06-15*
