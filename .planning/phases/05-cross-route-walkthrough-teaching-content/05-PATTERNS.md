# Phase 5: Cross-Route Walkthrough & Teaching Content - Pattern Map

**Mapped:** 2026-06-18
**Files analyzed:** 11 (6 modify, 2 read-only embed, 3 new)
**Analogs found:** 11 / 11 (all have in-repo analogs — this phase extends an established subsystem)

## File Classification

| File | Action | Role | Data Flow | Closest Analog | Match Quality |
|------|--------|------|-----------|----------------|---------------|
| `src/lib/onboarding/steps.ts` | extend type + data | config/registry | static | self (own type) | exact |
| `src/components/tour/coachmark-renderer.tsx` | extend (nav) | component (client engine) | event-driven (advance→navigate) | self (Phase 4) | exact |
| `src/components/tour/coachmark-card.tsx` | extend (surface slot) | component (presentation) | request-response (callbacks) | self (Phase 4) | exact |
| `src/app/(tabs)/dashboard/page.tsx` | extend (anchor + checklist + CTA) | page (RSC) | CRUD/read | self + `groups/page.tsx` | exact |
| `src/app/(tabs)/groups/page.tsx` | extend (anchors + data-pending-count) | page (RSC) | CRUD/read | self | exact |
| `src/app/(tabs)/notifications/client.tsx` | extend (anchor on invite card) | component (client) | event-driven | self | exact |
| `src/app/(tabs)/shortcut/page.tsx` | extend (anchor) | page (RSC) | read | self + `dashboard/page.tsx` | exact |
| `src/components/onboarding/gym-surface.tsx` | read-only embed | component | CRUD | n/a (reuse as-is) | n/a |
| `src/components/onboarding/schedule-surface.tsx` | read-only embed | component | CRUD | n/a (reuse as-is) | n/a |
| `src/components/onboarding/shortcut-surface.tsx` | read-only embed | component | request-response | n/a (reuse as-is) | n/a |
| `src/components/tour/getting-started-checklist.tsx` | NEW | component (client) | read (derived state) | `coachmark-progress.ts` + `gym-surface.tsx` | role-match |
| `src/components/tour/empty-state-pact-cta.tsx` | NEW | component (presentation) | none (static CTA) | dashboard "All settled up" card (lines 182-191) | role-match |

## Pattern Assignments

### `src/lib/onboarding/steps.ts` (config/registry) — EXTEND

**Analog:** itself. Add `route?: string` to `OnboardingStep` and populate per D-07.

**Type extension** (current type at lines 37-42 — add one optional field, document with the same JSDoc style as `surface`/`probe`):
```typescript
export type OnboardingStep = {
  id: string;
  title: string;
  surface?: SurfaceId;
  probe?: ProbeId;
  route?: string; // tab route where this step's data-tour anchor lives (D-06)
};
```

**Registry population** (replace the array body at lines 54-60, keep `Object.freeze`/`as const`). Per D-07:
```typescript
export const STEPS: readonly OnboardingStep[] = Object.freeze([
  { id: "schedule", title: "...", surface: "schedule", probe: "schedule", route: "/dashboard" },
  { id: "gym", title: "...", surface: "gym", probe: "gym", route: "/dashboard" },
  { id: "challenge", title: "...", route: "/groups" }, // invited variant → /notifications resolved at runtime (D-09/D-10)
  { id: "money", title: "...", route: "/groups" },
  { id: "shortcut_viewed", title: "...", surface: "shortcut", probe: "shortcut", route: "/shortcut" },
] as const);
```

**CRITICAL constraint (canonical_refs line 88):** Do NOT bump `TOUR_VERSION`. Adding a `route` field does not change the ordered set or identity of step ids — the bump rule (lines 5-13) only fires on add/remove/reorder/rename.

---

### `src/components/tour/coachmark-renderer.tsx` (client engine) — EXTEND with navigation

**Analog:** itself (Phase 4). This file already owns every pattern the navigation logic needs.

**Hooks pattern** — `next/navigation` already used in `notifications/client.tsx` (line 5); add to the renderer's existing import block (line 3 area):
```typescript
import { useRouter, usePathname } from "next/navigation";
```

**Existing advance callback to extend** (lines 116-118) — navigate-then-reveal goes here (D-06). Read the NEXT step's `route` from `STEPS`, compare to `usePathname()`, `router.push()` if different:
```typescript
const handleAdvance = useCallback(() => {
  if (currentStepId) advance(currentStepId);
  // after advance, currentStepId recomputes via deriveCurrentStep; read the
  // next step's route from STEPS and push if it differs from usePathname().
}, [advance, currentStepId]);
```

**Anchor-gate to REUSE unchanged** (lines 85-95) — the existing `MutationObserver` on `document.body` already waits for the `data-tour` anchor to mount after navigation. No new polling (code_context line 119). Do NOT add a second observer for navigation.

**Dialog-pause observer** (lines 99-114) — same `MutationObserver` pattern is the precedent for any DOM-read you add (e.g., reading `data-pending-count` for D-09). Prefer reading the attribute inside the existing anchor-gate effect over adding a fetch.

**Invited-path detection (D-09/D-10)** — read `data-pending-count` from the DOM using the same `document.querySelector` style already in `anyDialogOpen()` (lines 26-29). When resolving the `challenge` step's effective route: if `pendingCount > 0`, target `/notifications` instead of `/groups`.

---

### `src/components/tour/coachmark-card.tsx` (presentation) — EXTEND with surface slot

**Analog:** itself (Phase 4). Pure-presentation, prop-driven — no tour-library/context import (line 7-17 contract). Keep it that way.

**Props extension** (type at lines 18-24) — add optional `surface`:
```typescript
export type CoachmarkCardProps = {
  stepId: string | null;
  title: string;
  body: string;
  surface?: React.ReactNode; // embedded setup surface (D-01); when present, hide "Next →" (D-03)
  onAdvance: () => void;
  onDismiss: () => void;
};
```

**Surface slot render** — insert between body (`<p>` line 62) and the dot indicator (line 65). Use the bounded-scroll container from D-02:
```tsx
{surface ? (
  <div className="mt-3 max-h-[calc(80vh-8rem)] overflow-y-auto">{surface}</div>
) : null}
```

**Conditional "Next →" (D-03)** — the existing primary `Button` (lines 83-85) must be hidden when `surface` is present; the surface owns the advance CTA. "Skip tour" (lines 88-94) always stays. The card root width `w-[300px]` (line 55) likely needs widening when a surface is embedded — gym/schedule surfaces have search inputs and result lists.

**Style tokens to reuse:** `glass-card animate-fade-up rounded-2xl` (line 54), `Button` default variant (white bg), `cn()` from `@/lib/utils`. Embedded surfaces already use `glass-card`, `Button`, `Input` — visually consistent.

---

### Route page anchor additions (dashboard, groups, notifications, shortcut)

**Established anchor pattern (Phase 4, dashboard/page.tsx line 119):**
```tsx
<section data-tour="schedule" className="...">
```
All new anchors follow `data-tour="<step-id>"` on an **unconditionally-mounted** element (Claude's Discretion, CONTEXT line 64 — never inside a loading/streaming slot).

#### `src/app/(tabs)/dashboard/page.tsx` — add `data-tour="gym"`, checklist, empty-state CTA
- **`data-tour="gym"` anchor:** attach to the `TodayActionCard` wrapper (lines 170-180) — it already receives `gymCount` and is always mounted. Or the streak section.
- **Getting-started checklist (UX-01):** render a new client component above the daily strip (`data-tour="schedule"` section, line 119). Per code_context line 132 it reads completion client-side. SEE GAP below — `useTour()` does NOT expose `completedSteps`.
- **Empty-state CTA (UX-02):** mirror the "All settled up" conditional card (lines 182-191) — same `glass-card p-4 text-center` shell, `animate-fade-up-item`. Condition: `gymCount`/active-challenge count === 0. Brand copy per specifics line 143.
- **RSC error-handling pattern to preserve:** the whole render is wrapped in try/catch that re-throws `NEXT_REDIRECT`/`NEXT_NOT_FOUND` (lines 235-263). Any new server reads stay inside it.

#### `src/app/(tabs)/groups/page.tsx` — add `data-tour="challenge"`, `data-tour="money"`, `data-pending-count`
- `pendingCount` already derived at line 128. Add `data-pending-count={pendingCount}` to an always-mounted container (the `<main>` at line 140) so the renderer reads it without a fetch (D-09, code_context line 131).
- **`data-tour="challenge"`:** the new-challenge search `<section>` (lines 216-224) is always mounted (the empty-state card at 162-171 is conditional — avoid). 
- **`data-tour="money"`:** anchor to a financial/standing element. Note: per-challenge standing is rendered inside `ChallengeVersusCard` (line 207) and may not exist when there are no challenges. Pick an unconditionally-mounted element; if none shows money, anchor the search section and let copy teach (specifics line 141).

#### `src/app/(tabs)/notifications/client.tsx` — add `data-tour="challenge"` (invited variant)
- This is a `"use client"` component rendering invite cards. Anchor the FIRST pending invite `<li>` — the `isInvite` branch (lines 254-300). The list maps items (line 211); add the attribute only when `index === 0 && isInvite`. The `respond()` accept/decline flow (lines 161-188) already exists — do NOT touch it.

#### `src/app/(tabs)/shortcut/page.tsx` — add `data-tour="shortcut_viewed"`
- Anchor the always-mounted `ShortcutSetup` wrapper `<div>` (lines 31-37) or the header (line 24). Both render unconditionally. Note the surface embedded in the CARD (shortcut-surface.tsx) is separate from this page anchor — the anchor just gates where the coachmark points.

---

### `src/components/tour/getting-started-checklist.tsx` (NEW, client component)

**Analogs:** `coachmark-progress.ts` (registry-iteration pattern) + `gym-surface.tsx` (client component + glass-card list shape).

**Registry-driven iteration** (copy the `STEPS.map`/`findIndex` approach from `deriveDotStates`, coachmark-progress.ts lines 24-40) — map over `TEACHING_KEYS` (steps.ts line 68: `["gym","challenge","money","shortcut_viewed"]`), one row per key, checkmark when the key is complete.

**Component skeleton** (follow `"use client"` + `glass-card` conventions):
```tsx
"use client";
import { TEACHING_KEYS } from "@/lib/onboarding/steps";
import { cn } from "@/lib/utils";
// reuse glass-card / animate-fade-up-item / text-white tokens from dashboard cards
```
Hide entirely when all four keys complete (specifics line 142).

> **GAP — see "Open Decision" below.** The checklist needs per-key completion. `useTour()` (tour-provider.tsx lines 18-23) is FROZEN and exposes only `currentStepId`, `isActive`, `advance`, `dismiss` — NOT `completedSteps`. The planner must resolve the data source (see below) before this component can derive checkmarks.

---

### `src/components/tour/empty-state-pact-cta.tsx` (NEW, presentation)

**Analog:** dashboard "All settled up" card (dashboard/page.tsx lines 182-191) — exact shell to copy:
```tsx
<div className="animate-fade-up-item shrink-0 rounded-[2rem] glass-card p-4 text-center">
  <p className="text-sm font-semibold text-white">{/* "Start your first pact" */}</p>
  <p className="mt-1 text-xs text-white/55">{/* "No stakes yet. Your partner is waiting." */}</p>
</div>
```
Wrap the CTA in a `Link href="/groups"` (Link import already in dashboard line 1) or a `buttonVariants` link (line 6 / 256). Brand voice per specifics line 143 — consequence-first, not "Get started."

## Shared Patterns

### data-tour anchor naming
**Source:** `dashboard/page.tsx` line 119
**Apply to:** all four route pages
`data-tour="<step-id>"` on an unconditionally-mounted element. The id MUST equal a `STEPS[].id` (steps.ts line 54-60).

### MutationObserver DOM-readiness gate
**Source:** `coachmark-renderer.tsx` lines 85-95 (anchor gate) and 99-114 (dialog pause)
**Apply to:** post-navigation anchor wait (reuse — do not re-implement) and `data-pending-count` read
```typescript
const observer = new MutationObserver(check);
observer.observe(document.body, { childList: true, subtree: true });
return () => observer.disconnect();
```

### Surface onComplete → advance wiring
**Source:** `shortcut-surface.tsx` lines 28 / `gym-surface.tsx` lines 191,199 (the `onComplete` prop)
**Apply to:** every embedded-surface step (D-03)
The renderer passes `onComplete={() => advance(stepId)}` to each surface. Surfaces own their own "Continue"/"Skip for now" buttons; no standalone "Next →".

### Best-effort PATCH (optional surface)
**Source:** `tour-provider.tsx` lines 83-88; `shortcut-surface.tsx` lines 15-28
**Apply to:** any new write the checklist/CTA might trigger
```typescript
await fetch("/api/onboarding-progress", { method: "PATCH", ... }).catch(() => {});
```
Note: `shortcut-surface.tsx` ALREADY writes `complete_step: "shortcut_viewed"` (line 19) — do NOT double-write from the renderer for that step.

### Client component + token conventions
**Source:** `gym-surface.tsx` line 1-5, `coachmark-card.tsx` line 1-5
`"use client"` at top; import `@/` aliases only (CLAUDE.md — never relative); `glass-card`, `animate-fade-up`, `text-white/55`, `cn()`, `Button`/`Input` shadcn primitives.

## Open Decision (planner must resolve)

**The "getting started" checklist needs a completion data source that the frozen `useTour()` does not provide.**

- CONTEXT code_context (lines 132, 142) and Claude's Discretion (line 66) say the checklist derives from `useTour()` `completedSteps` client-side, "no extra fetch."
- But `TourValue` (tour-provider.tsx lines 18-23) is FROZEN at 4 members and `completedSteps` is NOT one of them. D-08 / canonical_refs line 83 explicitly forbid extending `TourValue` in Phase 5.

These conflict. Resolution options for the planner (do NOT extend `TourValue`):
1. **Pass server-read progress as a prop** — dashboard RSC already reads profile/gym data; it can read `onboarding_progress.completed_steps` (the same row `TourProvider` hydrates from, tour-provider.tsx line 41) and pass `completedSteps` to the checklist as a prop. Zero extra client fetch, no context change. **Recommended** — matches the RSC data-loading pattern already in dashboard/page.tsx lines 43-76.
2. Derive "in-progress vs done" from `currentStepId` position via `STEPS.findIndex` (steps before current = done) — but this is ordering-based, not true completion, and loses the dismissed/skipped distinction.

Flagging because the planner's checklist plan cannot proceed without choosing one; option 1 is the lowest-risk, convention-aligned path.

## No Analog Found

None. Every file extends an existing Phase 2/3/4 subsystem or copies an in-repo card/list pattern.

## Metadata

**Analog search scope:** `src/components/tour/`, `src/components/onboarding/`, `src/lib/onboarding/`, `src/app/(tabs)/{dashboard,groups,notifications,shortcut}/`, `src/components/tour-provider.tsx`
**Files scanned:** 11 read in full + type/registry inspection
**Pattern extraction date:** 2026-06-18
