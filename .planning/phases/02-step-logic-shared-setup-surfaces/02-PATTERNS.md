# Phase 2: Step Logic & Shared Setup Surfaces - Pattern Map

**Mapped:** 2026-06-15
**Files analyzed:** 11 (5 new, 6 modified)
**Analogs found:** 11 / 11

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/lib/onboarding/steps.ts` | utility (pure registry) | transform | `src/lib/onboarding-progress.ts` | role-match (pure `src/lib/*` + types) |
| `src/lib/onboarding/steps.test.ts` | test | transform | `src/lib/onboarding-progress.test.ts` | exact |
| `src/lib/onboarding/completion.ts` | utility (pure probes) | transform | `src/lib/onboarding-progress.ts` (`mergeProgress`) | role-match |
| `src/lib/onboarding/completion.test.ts` | test | transform | `src/lib/onboarding-progress.test.ts` | exact |
| `src/components/onboarding/gym-surface.tsx` (NEW, extracted) | component | CRUD / request-response | `src/app/onboarding/gym/client.tsx` (`GymOnboarding`) | exact (this IS the source) |
| `src/components/onboarding/schedule-surface.tsx` (NEW, extracted) | component | CRUD / request-response | `src/app/onboarding/schedule/client.tsx` (`ScheduleForm`) | exact (source) |
| `src/components/onboarding/shortcut-surface.tsx` (NEW, extracted) | component | request-response | `src/app/onboarding/shortcut/client.tsx` (`FinishOnboardingButtons`) | exact (source) |
| `src/app/onboarding/gym/{page,client}.tsx` (MOD → thin shell) | page + component | request-response | self (current) | exact |
| `src/app/onboarding/schedule/{page,client}.tsx` (MOD → thin shell) | page + component | request-response | self (current) | exact |
| `src/app/onboarding/shortcut/{page,client}.tsx` (MOD → thin shell) | page + component | request-response | self (current) | exact |

> The exact target paths for the three extracted surfaces (`src/components/onboarding/*` vs. keeping them co-located) is a planner decision; the analog patterns below hold either way. Recommended: `src/components/onboarding/*-surface.tsx` so both the legacy route and the Phase 3+ walkthrough import from a neutral location (not from an `app/onboarding/*/client.tsx`).

---

## Pattern Assignments

### `src/lib/onboarding/steps.ts` (pure registry)

**Analog:** `src/lib/onboarding-progress.ts`

**Module shape to copy** — named exports, types co-located, constant at top, JSDoc on exported symbols, no side effects, no DB access. Mirror the `STEP_KEY_REGEX` + `PatchInput`/`ProgressRow` style:

- `export const TOUR_VERSION = 1;` — opaque int Phase 1 persists (`tour_version` default 1 in `defaultProgress()`, onboarding-progress.ts:59). Document the bump rule in a JSDoc comment exactly like the `STEP_KEY_REGEX`/`PatchBody` comments (onboarding-progress.ts:3-16).
- `export type OnboardingStep = { id: string; title: string; surface?: ...; probe?: ... };`
- `export const STEPS: readonly OnboardingStep[] = [...]` — ordered array.
- Step `id`s MUST satisfy `STEP_KEY_REGEX` from onboarding-progress.ts:9 (lowercase snake) since they feed `complete_step`. The four completion-gating keys are `gym`, `challenge`, `money`, `shortcut_viewed` (CONTEXT D-01); `schedule` is a setup-bearing step but NOT completion-gating (CONTEXT note line 45-46).

**Import convention:** `@/` only, never relative (CLAUDE.md). Note onboarding-progress.ts imports `zod` only; steps.ts likely needs no runtime deps.

---

### `src/lib/onboarding/completion.ts` (pure probes)

**Analog:** `src/lib/onboarding-progress.ts` → `mergeProgress` (lines 72-89)

**Core pattern to copy** — pure function over passed-in state, no mutation of inputs, returns a derived value. `mergeProgress` is the template: takes `existing` state + a discriminating input, never touches the DB, fully unit-tested.

Probes are pure functions over caller-supplied state (CONTEXT D-02 — "No DB access inside the probe"):

```typescript
// gym set → user_gyms row count > 0 (same source as page.tsx gym count)
export function isGymDone(gymCount: number): boolean { return gymCount > 0; }

// weekly goal / schedule set → rest_days non-empty (NOT weekly_goal, which defaults to 4)
export function isScheduleDone(restDays: number[]): boolean { return restDays.length > 0; }

// shortcut viewed → semantic key present in completed_steps
export function isShortcutDone(completedSteps: string[]): boolean {
  return completedSteps.includes("shortcut_viewed");
}

// tour complete → all four teaching keys present (CONTEXT D-01)
export function isTourComplete(completedSteps: string[]): boolean {
  return ["gym", "challenge", "money", "shortcut_viewed"].every((k) => completedSteps.includes(k));
}
```

**State-source justification (cite in plan):**
- `gymCount` source confirmed: `gym/page.tsx:27-31` selects `user_gyms` and passes `gyms?.length ?? 0` as `initialGymCount` (gym/page.tsx:55).
- `restDays` source confirmed: `schedule/page.tsx:18` selects `weekly_goal, rest_days`; passes `Array.isArray(profile.rest_days) ? profile.rest_days : []` (schedule/page.tsx:51). A fresh profile has empty `rest_days` → reliable "edited" signal. `weekly_goal` defaults to 4 (gym/schedule pages use `?? 4`), so it is NOT a usable signal — matches D-02 forbidding default-indistinguishable signals.
- `completedSteps` source: the `ProgressRow.completed_steps` array from `onboarding-progress.ts:42`.

**Hard constraint:** No duplicate boolean flag (PROG-02). Derive only from the three real-state inputs above.

---

### `src/lib/onboarding/steps.test.ts` & `completion.test.ts` (Vitest)

**Analog:** `src/lib/onboarding-progress.test.ts` (exact structural template)

**Test structure to copy:**
- `import { describe, it, expect } from "vitest";` (onboarding-progress.test.ts:1)
- Import the unit under test by relative `./` path (test files use `./module`, line 2-8) — the one place relative imports appear, matching project test convention.
- One `describe` per exported symbol; `it` cases assert pure return values with `expect(...).toEqual(...)`.
- Mirror the "no shared mutable state" defensiveness test (lines 26-31) for `steps.ts` if `STEPS` is exposed as a mutable array — assert callers can't corrupt the registry (or freeze it).
- For `completion.test.ts`: test each probe at its boundary — empty vs. non-empty `restDays`, `gymCount` 0 vs 1, `completedSteps` missing/partial/all-four for `isTourComplete` (the partial case is the important one: 3 of 4 keys → still incomplete).

---

### `src/components/onboarding/gym-surface.tsx` (extracted from `GymOnboarding`)

**Analog / SOURCE:** `src/app/onboarding/gym/client.tsx` (lines 1-203) — copy verbatim, change ONLY navigation.

**Extraction delta (the only change):** Replace the `next()` function (gym/client.tsx:122-124) and `useRouter`/`useTransition` navigation with an injected `onComplete` prop. Both the skip button (lines 184-191) and `Continue` button (lines 192-199) currently call `next` → both call the injected callback instead. The surface NEVER hard-codes a destination (UI-SPEC line 189).

```typescript
export function GymSurface({
  initialGymCount,
  onComplete,
}: { initialGymCount: number; onComplete: () => void }) { ... }
```

**Preserve verbatim (parity-lock, UI-SPEC):**
- Fetch+save logic: `/api/places/search` (line 37), `/api/places/details` (line 65), `POST /api/gyms` (lines 69, 96) — no new endpoints.
- Debounced search effect (lines 26-59), geolocation (lines 87-120), all error strings (lines 43-53, 89, 109).
- Bottom action row markup `flex items-center gap-3`, skip-left/`Continue`-right, `disabled={busy}` on both (lines 183-200).

---

### `src/components/onboarding/schedule-surface.tsx` (extracted from `ScheduleForm`)

**Analog / SOURCE:** `src/app/onboarding/schedule/client.tsx` (lines 1-144)

**Extraction delta:** `save(true)` currently calls `router.push("/onboarding/gym")` (line 56) and `skip()` does likewise (lines 59-61). Replace both navigation calls with injected `onComplete`. `save` still PATCHes `/api/profile` first (lines 45-49), THEN invokes `onComplete` on success (preserve the `!res.ok` early-return at lines 51-55).

```typescript
export function ScheduleSurface({
  initialGoal, initialRestDays, onComplete,
}: { initialGoal: number; initialRestDays: number[]; onComplete: () => void }) { ... }
```

**Preserve verbatim:** `PATCH /api/profile { weekly_goal, rest_days }` (lines 45-49 — endpoint schema confirmed at `api/profile/route.ts:30-31`), `tooMany` guard (lines 32, 39-42, 136), all picker markup incl. grandfathered `gap-1.5` chips (lines 67, 90), `Saving…`/`Continue` busy label (line 139), error in `text-white/85` (line 122).

---

### `src/components/onboarding/shortcut-surface.tsx` (extracted from `FinishOnboardingButtons`)

**Analog / SOURCE:** `src/app/onboarding/shortcut/client.tsx` (lines 1-46)

**Extraction delta (two changes):**
1. Navigation → injected `onComplete` (replaces `router.push("/dashboard") + refresh`, lines 20-23).
2. **Write-path decouple (CONTEXT D-01/D-05):** the Shortcut "viewed" signal is now `shortcut_viewed` appended to `completed_steps` via `PATCH /api/onboarding-progress { complete_step: "shortcut_viewed" }` (the Phase-1 write path, onboarding-progress.ts:18-29). The legacy `PATCH /api/profile { onboarding_complete: true }` (lines 14-18) is the LEGACY-shell concern — the planner must decide whether the surface still writes `onboarding_complete` or whether that moves to the legacy shell's `onComplete`. Per D-03/D-05 the surface owns the `shortcut_viewed` write; the legacy `onboarding_complete` flip belongs to the legacy mount's `onComplete` so the walkthrough mount does NOT prematurely end onboarding.

```typescript
export function ShortcutSurface({ onComplete }: { onComplete: () => void }) { ... }
```

**Preserve verbatim:** bottom row `flex items-center gap-3 pt-2` (line 27), skip-left/`Done`-right, `Saving…` busy label (line 42), `disabled={busy}` both actions.

---

### Modified legacy shells — `src/app/onboarding/{gym,schedule,shortcut}/{page,client}.tsx`

**Analog:** current `page.tsx` files (read in full) — they ALREADY do auth-gate + data-fetch + mount. Keep the server `page.tsx` virtually unchanged; only swap the imported component.

**Page pattern (preserve):** each `page.tsx` is an async RSC: `createClient()` → `getUser()` → redirect guards → select state → render shell mounting the surface (gym/page.tsx:11-62, schedule/page.tsx:11-59, shortcut/page.tsx:16-95). The `dynamic = "force-dynamic"`, `StepIndicator`, `Card`, `SweatPactSeal` chrome is shell-owned (UI-SPEC: wrapper differs per mount context) — keep it on the legacy route.

**`client.tsx` → thin shell delta:** the legacy `client.tsx` becomes a `"use client"` wrapper that owns `useRouter` and passes `onComplete = () => router.push(next)` into the shared surface. This is where navigation lives now (hoisted out of the surface per D-03):

```typescript
"use client";
import { useRouter } from "next/navigation";
import { GymSurface } from "@/components/onboarding/gym-surface";
export function GymOnboarding({ initialGymCount }: { initialGymCount: number }) {
  const router = useRouter();
  return <GymSurface initialGymCount={initialGymCount} onComplete={() => router.push("/onboarding/shortcut")} />;
}
```

Preserve each route's existing `next` destination: schedule → `/onboarding/gym` (schedule/client.tsx:56), gym → `/onboarding/shortcut` (gym/client.tsx:123), shortcut → `/dashboard` + `router.refresh()` (shortcut/client.tsx:21-22). The shortcut legacy shell's `onComplete` additionally performs the `PATCH /api/profile { onboarding_complete: true }` flip (see ShortcutSurface delta above).

---

## Shared Patterns

### Fetch + JSON-parse + error fallback
**Source:** `gym/client.tsx:74` and `schedule/client.tsx:52`
**Apply to:** all three surfaces (already present — preserve)
```typescript
const data = await res.json().catch(() => ({}));
if (!res.ok) { setErr(data.error ?? "Failed to add gym."); return; }
```
Matches CLAUDE.md error-handling convention (`.catch(() => ({}))`, `error` string + optional `detail`).

### Bottom action row (skip-left / primary-right)
**Source:** identical in all three current components (gym/client.tsx:183-200, schedule/client.tsx:124-141, shortcut/client.tsx:27-44)
**Apply to:** every surface, every mount context (UI-SPEC parity checklist)
```tsx
<div className="flex items-center gap-3">
  <button type="button" onClick={onComplete} disabled={busy}
    className="text-sm text-white/55 underline-offset-4 hover:text-white hover:underline disabled:opacity-50">
    Skip for now
  </button>
  <Button type="button" onClick={onComplete} disabled={busy} className="ml-auto rounded-full">Continue</Button>
</div>
```

### Pure-module + co-located test convention
**Source:** `onboarding-progress.ts` + `onboarding-progress.test.ts` pairing
**Apply to:** `steps.ts`/`steps.test.ts`, `completion.ts`/`completion.test.ts`
Pure `src/lib/*` modules have a co-located `*.test.ts`; route handlers are NOT unit-tested (onboarding-progress.ts:70 comment — "route handlers are untested per project convention"). So the surfaces' fetch wiring is not unit-tested; only steps.ts/completion.ts get Vitest coverage. CLAUDE.md: "domain rule changes in `src/lib/*` require updating co-located `*.test.ts`."

### Phase-1 write path (the PATCH the surfaces drive)
**Source:** `onboarding-progress.ts:17-29` (`PatchBody`), consumed via `PATCH /api/onboarding-progress`
**Apply to:** ShortcutSurface (`complete_step: "shortcut_viewed"`); walkthrough mounts of all surfaces (Phase 3+) append their step key here. Clients send at most one `complete_step` per write — server dedupes (D-04).

---

## No Analog Found

None. Every file maps to an existing, recently-modified analog (the three surfaces ARE the sources being extracted; the two pure modules clone the Phase-1 `onboarding-progress` pair).

## Metadata

**Analog search scope:** `src/lib/`, `src/app/onboarding/`, `src/app/api/profile/`, `src/components/ui/`
**Files scanned:** 9 (read in full: 3 surface clients, 3 legacy pages, onboarding-progress.ts + its test; grepped: profile route, onboarding glob)
**Pattern extraction date:** 2026-06-15
