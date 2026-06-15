# Phase 2: Step Logic & Shared Setup Surfaces - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-15
**Phase:** 2-step-logic-shared-setup-surfaces
**Areas discussed:** Complete rule, Done probes, Shared surface, Registry shape

---

## "Tour complete" definition

| Option | Description | Selected |
|--------|-------------|----------|
| Presented = enough | Teaching point counts when its step is shown; complete = all four keys present | ✓ |
| Action-where-actionable | gym+Shortcut require real action done; challenge+money count on presentation | |
| All actions done | Every actionable point must be done + challenge/money presented (strictest) | |

**User's choice:** Presented = enough
**Notes:** Keeps the user from being stranded on optional setup to finish the tour. Sets `completed_at` when all four teaching keys present. → CONTEXT D-01.

---

## Auto-skip "already done" probes

| Option | Description | Selected |
|--------|-------------|----------|
| rest_days as goal signal | gym=user_gyms>0; goal=rest_days non-empty; shortcut=key present | (Claude's discretion) |
| weekly_goal != default | Treat goal set when weekly_goal ≠ 4 default | |
| Needs a set-marker | Add explicit goal-set marker | (rejected — PROG-02 forbids duplicate flag) |

**User's choice:** "you decide"
**Notes:** Claude locked: gym=`user_gyms`>0, weekly-goal=`rest_days` non-empty (weekly_goal default 4 is ambiguous; a marker would violate PROG-02's no-duplicate-flag rule), shortcut=`shortcut_viewed` key. Pure functions over passed-in state. → CONTEXT D-02.

---

## Shared setup surface contract

| Option | Description | Selected |
|--------|-------------|----------|
| onComplete prop, route owns nav | Presentational components; mount points fetch data | |
| Self-contained w/ data | Components own fetch+save; mount points pass only onComplete | ✓ (Claude's discretion) |
| Headless hook + view | Split headless hook + dumb view | |

**User's choice:** "you decide i want it to not be dummy"
**Notes:** User explicitly does not want inert/presentational shells. Locked self-contained components that own real fetch+save against existing endpoints, parameterized only by `onComplete` (+skip). Legacy routes become thin shells (`onComplete=router.push`); walkthrough uses `onComplete=advance-tour`. No logic fork. → CONTEXT D-03.

---

## Step registry shape

| Option | Description | Selected |
|--------|-------------|----------|
| Uniform entries w/ optional fields | `{ id, title, surface?, probe? }`; challenge/money presented-only | ✓ |
| Two kinds: teach vs setup | Separate teaching steps from setup surfaces, linked by id | |
| Let planner derive it | Lock only the four ids + TOUR_VERSION semantics | |

**User's choice:** Uniform entries with optional fields
**Notes:** `surface`/`probe` optional; challenge/money carry neither. `TOUR_VERSION` bumps when the ordered set changes. → CONTEXT D-04.

---

## Claude's Discretion

- Auto-skip probe data sources (D-02) — user deferred; resolved using real-state signals, no duplicate flag.
- Shared surface factoring (D-03) — user deferred with the constraint "not dummy"; resolved as self-contained fetch+save components driven only by `onComplete`.

## Deferred Ideas

- TourProvider/username-start (P3), coachmark engine (P4), cross-route sequencing + teaching content (P5), TOUR_VERSION drift handling on replay (P6).
- A stronger "weekly goal set" signal than `rest_days` non-empty if research surfaces one (no duplicate flag).
