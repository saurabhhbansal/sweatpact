# Phase 3: Minimal Start & TourProvider Wiring - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-15
**Phase:** 3-minimal-start-tourprovider-wiring
**Areas discussed:** Gate cleanup strategy, Server hydration wiring, TourProvider context API, Skip/dismiss semantics

---

## Gate Cleanup Strategy

### Where should the username-only redirect gate live?

| Option | Description | Selected |
|--------|-------------|----------|
| Centralize in (tabs)/layout.tsx | Fetch profile once, redirect if username missing. DRY — single source of truth. Reuses request-cached getViewerProfile(). | ✓ |
| Remove onboarding_complete per-page, keep username check per-page | Surgical: delete only the !onboarding_complete lines. Leaves username redirect in 6+ pages. | |

**User's choice:** Centralize in (tabs)/layout.tsx

---

### When centralized: fallback strategy?

| Option | Description | Selected |
|--------|-------------|----------|
| Trust the layout — remove per-page redirects entirely | One gate, one place. Pages trust layout always runs first. | ✓ |
| Keep one page as safety net (dashboard only) | Belt-and-suspenders: dashboard keeps redirect as catch. Others cleaned up. | |

**User's choice:** Trust the layout — remove per-page redirects entirely

---

### Gate execution timing in layout?

| Option | Description | Selected |
|--------|-------------|----------|
| Add explicit gate before Suspense | Synchronous redirect at top of layout, before Suspense slots render. Cleanest guarantee. getViewerProfile() is cached so second call is free. | ✓ |
| Reuse existing Suspense/getNavProfile pattern | Extend TopBar/BottomBar's getNavProfile(). Avoids top-level await but Suspense streaming means gate may run slightly later. | |

**User's choice:** Add explicit gate before Suspense

---

## Server Hydration Wiring

### How does server-fetched progress reach the client TourProvider?

| Option | Description | Selected |
|--------|-------------|----------|
| Layout fetches + passes initialProgress prop | RSC layout calls GET /api/onboarding-progress server-side, renders <TourProvider initialProgress={data}>. Zero flash. Matches initialGymCount pattern. | ✓ |
| Separate OnboardingHydrator RSC component | Dedicated server component fetches and wraps TourProvider. Keeps layout clean but adds an extra file/layer. | |

**User's choice:** Layout fetches + passes initialProgress prop

---

### Where does TourProvider mount?

| Option | Description | Selected |
|--------|-------------|----------|
| Wrapping children in the layout | TourProvider wraps {children}. All tab pages can call useTour(). Correct layering for Phase 4+ coachmarks. | ✓ |
| Inside a specific page (dashboard only) | Simpler initially but requires move in Phase 4. Extra refactor later. | |

**User's choice:** Wrapping children in the layout

---

### Fetch failure behavior?

| Option | Description | Selected |
|--------|-------------|----------|
| Silent no-op — tour stays inactive | Null initialProgress treated as blank slate. Tour never activates. App fully usable. | ✓ |
| Show a toast and retry on next navigation | Surface error to user, queue retry. More complex; walkthrough is optional. | |

**User's choice:** Silent no-op — tour stays inactive

---

## TourProvider Context API

### What does useTour() expose?

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal Phase-3 surface | currentStepId, isActive, advance(), dismiss(). Phase 4 extends as needed. Avoids over-designing before coachmark library is picked. | ✓ |
| Full surface designed for Phase 4+ now | currentStepId, progress, isComplete, isActive, advance(stepId), skip(), dismiss(), goTo(stepId). Locks API before Phase 4 research. | |

**User's choice:** Minimal Phase-3 surface, extensible later

---

### Who owns the persistence write?

| Option | Description | Selected |
|--------|-------------|----------|
| TourProvider owns the write internally | advance(stepId) calls PATCH internally, optimistic state update. Consumers call function with no API knowledge. | ✓ |
| Caller is responsible for writing, then calls advance() | Each consumer calls PATCH itself, then advance(). Splits write responsibility across callers. | |

**User's choice:** TourProvider owns the write internally

---

### How is currentStepId derived?

| Option | Description | Selected |
|--------|-------------|----------|
| Call completion probes from Phase 2 (completion.ts) | Pure probes + step registry find first uncompleted/non-skippable step. Single source of truth for Phase 6 replay too. | ✓ |
| Use last_step_id from DB row directly | Simpler but bypasses completion probes — auto-skip won't work, would need refactor before Phase 6. | |

**User's choice:** Call completion probes from Phase 2 (completion.ts)

---

## Skip / Dismiss Semantics

### Same action or different?

| Option | Description | Selected |
|--------|-------------|----------|
| Dismiss only — one exit action | dismiss() sets dismissed=true via PATCH. No step-level skip. Single X/skip button in Phase 4. | ✓ |
| Two actions: skip-step and dismiss-tour | dismiss() exits tour entirely; skip() skips current step only. Requires two affordances in coachmark UI. | |

**User's choice:** Dismiss only — one exit action

---

### After dismiss: permanent or replayable?

| Option | Description | Selected |
|--------|-------------|----------|
| Replayable from Settings | dismissed=true hides walkthrough now. Phase 6 adds Settings reset entry. Consistent with PROG-03. | ✓ |
| Permanent dismiss | Once dismissed, never shows again. Would need revisiting for Phase 6 replay requirement anyway. | |

**User's choice:** Replayable from Settings

---

## Claude's Discretion

None — all gray areas had clear user preferences.

## Deferred Ideas

- Coachmark/spotlight UI — Phase 4
- Cross-route navigate-then-reveal — Phase 5
- Replay Settings entry (reset dismissed=false) — Phase 6
- tour_version drift handling on replay — Phase 6
- isComplete and full progress in context shape — Phase 4+ (after coachmark library is picked)
