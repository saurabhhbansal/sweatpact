# Phase 3: Minimal Start & TourProvider Wiring - Pattern Map

**Mapped:** 2026-06-17
**Files analyzed:** 12 (1 new component, 1 modified lib, 1 modified layout, 1 optional new lib + test, 8 modified pages)
**Analogs found:** 11 / 12 (the React context provider has no in-repo precedent — canonical shape documented from RESEARCH/UI-SPEC)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/components/tour-provider.tsx` | provider (NEW) | event-driven (client state + PATCH writes) | `src/components/onboarding/gym-surface.tsx` (client state + fetch-mutation) | role-match (no context precedent) |
| `src/lib/supabase/rsc.ts` | data-access (MODIFY: add `getOnboardingProgress`) | request-response (cached DB read) | `getViewerProfile` in same file | exact |
| `src/lib/onboarding/current-step.ts` | utility (NEW, optional) | transform (pure derivation) | `src/lib/onboarding/completion.ts` | exact |
| `src/lib/onboarding/current-step.test.ts` | test (NEW, optional) | — | `src/lib/onboarding/completion.test.ts` | exact |
| `src/app/(tabs)/layout.tsx` | layout/RSC (MODIFY: gate + hydrate + mount) | request-response | own `getNavProfile` + `username/page.tsx` gate | exact |
| `src/app/(tabs)/dashboard/page.tsx` | page (MODIFY: remove redirects) | request-response | self (delete lines 28-33) | exact |
| `src/app/(tabs)/groups/page.tsx` | page (MODIFY) | request-response | self (delete lines 35-40) | exact |
| `src/app/(tabs)/groups/[id]/page.tsx` | page (MODIFY) | request-response | self (delete lines 47-52) | exact |
| `src/app/(tabs)/cycle/page.tsx` | page (MODIFY — PRESERVE gender redirect) | request-response | self (delete 18-23, KEEP 24-26) | exact |
| `src/app/(tabs)/notifications/page.tsx` | page (MODIFY) | request-response | self (delete lines 15-20) | exact |
| `src/app/(tabs)/settings/page.tsx` | page (MODIFY) | request-response | self (delete lines 12-17) | exact |
| `src/app/(tabs)/u/me/page.tsx` | page (MODIFY — PRESERVE final redirect) | request-response | self (delete 9-14, KEEP 15) | exact |
| `src/app/(tabs)/u/[username]/page.tsx` | page (MODIFY) | request-response | self (delete lines 46-51) | exact |

## Pattern Assignments

### `src/lib/supabase/rsc.ts` — add `getOnboardingProgress()` (data-access, request-cached read)

**Analog:** `getViewerProfile` in the SAME file (lines 21-36). Copy its shape exactly — `cache()` wrapper, `getAuthUser()` for the request-cached user, service-role admin client scoped to `user.id`, return `null` when no user.

**Existing pattern to mirror** (`src/lib/supabase/rsc.ts:21-36`):
```ts
export const getViewerProfile = cache(async () => {
  const user = await getAuthUser();
  if (!user) return null;
  const { data } = await createAdminClient()
    .from("profiles")
    .select("id, username, ...")
    .eq("id", user.id)
    .single();
  return data;
});
```

**New reader to write** (column list copied verbatim from `route.ts:14` `SELECT_COLS`):
```ts
export const getOnboardingProgress = cache(async () => {
  const user = await getAuthUser();
  if (!user) return null;
  // Admin client + strict .eq("user_id", user.id) — same justified scope as
  // getViewerProfile (post-0029 column lockdown). SECURITY-CRITICAL: never widen this filter.
  const { data } = await createAdminClient()
    .from("onboarding_progress")
    .select("mandatory_done, tour_version, last_step_id, completed_steps, dismissed, completed_at")
    .eq("user_id", user.id)
    .maybeSingle();
  return data ?? null; // null → blank-slate handling in TourProvider (D-06)
});
```
Return type is the Phase-1 `ProgressRow | null` from `src/lib/onboarding-progress.ts:38-45`. Use `.maybeSingle()` (not `.single()`) so a missing row returns `null` rather than throwing — matches `route.ts:27`.

---

### `src/app/(tabs)/layout.tsx` — gate + hydrate + mount (RSC layout, MODIFY)

**Analog:** the file's own `getNavProfile` (lines 11-15) for the auth read, and `username/page.tsx:11` for `isAutoUsername`.

**Current state to change:** `TabsLayout` is **synchronous** (line 37). It must become `async` to await the gate and hydration read (RESEARCH Pitfall 2). The gate must run before the JSX returns the Suspense slots so nav never flashes.

**Auth/gate pattern** — combine the existing `getNavProfile` null→`/login` (line 13) with the username check copied from `username/page.tsx:11`:
```tsx
export default async function TabsLayout({ children }: { children: React.ReactNode }) {
  const profile = await getViewerProfile();      // request-cached — same call the nav slots make
  if (!profile) redirect("/login");
  if (isAutoUsername(profile.username)) redirect("/onboarding/username"); // D-01, ONB-02
  // NO onboarding_complete check (D-02)
  const initialProgress = await getOnboardingProgress(); // request-cached; null on failure (D-06)
  return (
    <>
      <RefreshOnFocus />
      <Suspense fallback={<TopNav />}><TopBar /></Suspense>
      <div aria-hidden="true" style={{ height: "calc(max(env(safe-area-inset-top), 0.75rem) + 3.5rem)" }} />
      <TourProvider initialProgress={initialProgress}>{children}</TourProvider>
      <Suspense fallback={<MobileNav />}><BottomBar /></Suspense>
    </>
  );
}
```
**`isAutoUsername` helper** — extract once and reuse (RESEARCH "Don't Hand-Roll"). Source definition (`username/page.tsx:11-13`):
```ts
function isAutoUsername(u: string | null) {
  return !u || /^user_[a-f0-9]{8}$/.test(u);
}
```
**Preservation (UI-SPEC checklist):** `TourProvider` replaces the bare `{children}` at line 56 — do NOT add a wrapper div. `RefreshOnFocus`, both Suspense nav slots, and the `aria-hidden` spacer (lines 52-55) are unchanged.

---

### `src/components/tour-provider.tsx` (NEW — provider, event-driven)

**Analog:** No `createContext`/`useContext` exists anywhere in `src/` (RESEARCH grep, line 602) — TourProvider establishes the pattern. Closest behavioral analog is `gym-surface.tsx` for the `"use client"` + `useState(initialProp)` + `fetch`-mutation shape.

**Hydration pattern** (mirror `gym-surface.tsx:1,14-21` — seed `useState` from prop, no `useEffect` fetch):
```tsx
"use client";
import { createContext, useContext, useMemo, useState } from "react";
import type { ProgressRow } from "@/lib/onboarding-progress";
import { defaultProgress } from "@/lib/onboarding-progress"; // reuse blank slate (D-06)
```
Source seed pattern (`gym-surface.tsx:21`): `const [count, setCount] = useState(initialGymCount);` → here `const [progress, setProgress] = useState<ProgressRow>(initialProgress ?? defaultProgress());`.

**Context shape** (canonical, frozen by UI-SPEC §"Interaction Contract" — exactly 4 members, no more):
```tsx
type TourValue = {
  currentStepId: string | null;
  isActive: boolean;
  advance: (stepId: string) => Promise<void>;
  dismiss: () => Promise<void>;
};
const TourContext = createContext<TourValue | null>(null);

export function TourProvider({
  initialProgress,
  children,
}: { initialProgress: ProgressRow | null; children: React.ReactNode }) {
  const [progress, setProgress] = useState<ProgressRow>(initialProgress ?? defaultProgress());
  const currentStepId = useMemo(
    () => deriveCurrentStep(progress.completed_steps, progress.dismissed, /* probe state */),
    [progress.completed_steps, progress.dismissed]
  );
  // advance / dismiss below ...
  const value: TourValue = { currentStepId, isActive: currentStepId !== null, advance, dismiss };
  return <TourContext.Provider value={value}>{children}</TourContext.Provider>; // NO wrapper element (UI-SPEC Pitfall 5)
}

export function useTour() {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error("useTour must be used within TourProvider");
  return ctx;
}
```

**Write pattern (`advance`/`dismiss`)** — optimistic setState, then best-effort client `fetch`. Mirror `gym-surface.tsx:73-77` fetch shape; PATCH body shape per UI-SPEC §"Interaction Contract":
```tsx
async function advance(stepId: string) {
  setProgress((p) => ({ ...p, completed_steps: p.completed_steps.includes(stepId) ? p.completed_steps : [...p.completed_steps, stepId], last_step_id: stepId }));
  await fetch("/api/onboarding-progress", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ complete_step: stepId, last_step_id: stepId }), // matches PatchBody (onboarding-progress.ts:17-29)
  }).catch(() => {}); // best-effort — optional surface (D-08)
}
async function dismiss() {
  setProgress((p) => ({ ...p, dismissed: true })); // optimistic → currentStepId null, isActive false
  await fetch("/api/onboarding-progress", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ dismissed: true }),
  }).catch(() => {});
}
```
**Critical:** `advance` sends only `complete_step` (single key) — never the full `completed_steps` array. Server `mergeProgress` (`onboarding-progress.ts:72-89`) is authoritative and dedupe-appends. PATCH body must satisfy `PatchBody.strict()` — no extra fields (`onboarding-progress.ts:17-29`).

---

### `src/lib/onboarding/current-step.ts` (NEW, optional — utility, pure transform)

**Analog:** `src/lib/onboarding/completion.ts` (pure functions over passed-in state, no Supabase import, never mutate inputs). Co-locate as a pure `.ts` so Vitest collects its test (`vitest.config.ts` includes only `src/**/*.test.ts`, NOT `.tsx` — RESEARCH Pitfall 6).

**Pattern:** import the frozen `STEPS` registry (`steps.ts:54-60`) and the probes (`completion.ts:17-39`), walk in order, return first pending non-skippable step. Reuse `isGymDone`/`isScheduleDone`/`isShortcutDone` — do not re-derive ordering or probe logic.
```ts
import { STEPS } from "@/lib/onboarding/steps";
import { isGymDone, isScheduleDone, isShortcutDone } from "@/lib/onboarding/completion";

export function deriveCurrentStep(
  completedSteps: string[],
  dismissed: boolean,
  probe: { gymCount: number; restDays: number[]; completedSteps: string[] }
): string | null {
  if (dismissed) return null;                                    // D-10 / ONB-04
  for (const step of STEPS) {
    if (completedSteps.includes(step.id)) continue;
    if (step.probe === "gym" && isGymDone(probe.gymCount)) continue;
    if (step.probe === "schedule" && isScheduleDone(probe.restDays)) continue;
    if (step.probe === "shortcut" && isShortcutDone(probe.completedSteps)) continue;
    return step.id;                                              // first pending, non-skippable
  }
  return null;
}
```
**Planner decision (RESEARCH A2/OQ1):** Phase 3 may pass neutral probe state (gymCount 0, restDays []) and resume from `completed_steps` + `dismissed` alone, OR thread `profile.rest_days` + a gym count from the layout. Keep the function pure either way so the resume/dismiss logic is unit-covered. The full auto-skip UX is Phase 6.

---

### `src/lib/onboarding/current-step.test.ts` (NEW, optional — test)

**Analog:** `src/lib/onboarding/completion.test.ts:1-25`. Same structure: `import { describe, it, expect } from "vitest"`, relative import `./current-step`, one `describe` per behavior.
**Cover (ONB-04):** `dismissed=true` → `null`; fresh state → first step `"schedule"`; resume returns first pending step after some `completed_steps`; auto-skip when a probe is satisfied. Run: `npx vitest run src/lib/onboarding/current-step.test.ts`.

---

### The 8 tab pages — remove per-page redirects (MODIFY, mechanical)

**Pattern:** Each page currently carries an identical 6-line block — a username redirect AND an `onboarding_complete → /onboarding/schedule` redirect. Delete BOTH; the layout gate is now the single source of truth (D-03). Keep `if (!profile) redirect("/login")` (auth guard, not onboarding) AND any functional non-onboarding redirect.

| File | DELETE lines | KEEP (do NOT delete) |
|------|--------------|----------------------|
| `dashboard/page.tsx` | 28-33 (username + onboarding_complete) | 26 `!profile→/login`; the try/catch + NEXT_REDIRECT re-throw guard (RESEARCH Pitfall 3) |
| `groups/page.tsx` | 35-40 | 34 `!profile→/login` |
| `groups/[id]/page.tsx` | 47-52 | 46 `!profile→/login`; 56 `redirect("/groups")` (functional) |
| `cycle/page.tsx` | **18-23 ONLY** | 16 `!profile→/login`; **24-26 `gender !== "female" → /dashboard` (PRESERVE — RESEARCH Pitfall 4)**; try/catch re-throw guard |
| `notifications/page.tsx` | 15-20 | 14 `!profile→/login` |
| `settings/page.tsx` | 12-17 | 11 `!profile→/login` |
| `u/me/page.tsx` | **9-14 ONLY** | 8 `!profile→/login`; **15 `redirect(\`/u/\${profile.username}\`)` (PRESERVE — RESEARCH Pitfall 4)** |
| `u/[username]/page.tsx` | 46-51 | 44 `!viewerProfile→/login` |

**Warning (RESEARCH Pitfall 3):** After deleting redirects, `tsc --strict` may flag `profile` as possibly-null if the `if (!profile) redirect(...)` is also removed — it must NOT be. Out of scope: do NOT touch `/onboarding/*` self-redirects or the `onboarding_complete` column itself (Phase 6).

## Shared Patterns

### Request-cached owner-scoped DB read (admin client)
**Source:** `src/lib/supabase/rsc.ts:13-36` (`getAuthUser` + `getViewerProfile`)
**Apply to:** `getOnboardingProgress` (new). `cache()` wrapper, `getAuthUser()`, `createAdminClient().from(...).eq("user_id"/"id", user.id)`. SECURITY-CRITICAL: the `.eq("user_id", user.id)` filter is the single line preventing cross-user leakage (RESEARCH Security Domain) — never widen it.

### RSC reads DB → passes prop to `"use client"` child (no-flash hydration)
**Source:** `gym/page.tsx` reads `user_gyms` → `<GymSurface initialGymCount={...}>` ; child seeds `useState` from prop (`gym-surface.tsx:21`)
**Apply to:** layout reads `getOnboardingProgress()` → `<TourProvider initialProgress={...}>`; provider seeds `useState(initialProgress ?? defaultProgress())`. No `useEffect` fetch (RESEARCH anti-pattern). Do NOT have the RSC self-`fetch` its own API route (RESEARCH Pitfall 1).

### Client write via best-effort `fetch("/api/...")` PATCH
**Source:** `gym-surface.tsx:73-77` (POST), `route.ts:40-89` (server-authoritative PATCH + `mergeProgress`)
**Apply to:** `advance`/`dismiss` in TourProvider. Optimistic `setState` first, then `fetch(...).catch(() => {})`. Body must satisfy `PatchBody.strict()` (`onboarding-progress.ts:17-29`): `{ complete_step, last_step_id }` for advance, `{ dismissed: true }` for dismiss. Never send `completed_steps`.

### Pure logic in `.ts` + co-located `.test.ts`
**Source:** `completion.ts` + `completion.test.ts`; `steps.ts` + `steps.test.ts`
**Apply to:** `current-step.ts` + `current-step.test.ts`. Pure, no Supabase, no mutation. `.tsx` test files are NOT collected by Vitest (RESEARCH Pitfall 6) — keep the testable seam in `.ts`.

### Reuse, don't re-implement (Phase 1 + Phase 2 contracts)
- Blank slate: `defaultProgress()` (`onboarding-progress.ts:54-63`) — do not hand-roll `{ dismissed: false, completed_steps: [] }`.
- Type: `ProgressRow` (`onboarding-progress.ts:38-45`).
- Ordered registry: `STEPS` (`steps.ts:54-60`, frozen) — never hardcode the step list.
- Probes: `isGymDone`/`isScheduleDone`/`isShortcutDone`/`isTourComplete` (`completion.ts`).
- `isAutoUsername` regex `/^user_[a-f0-9]{8}$/` — one definition, extracted from `username/page.tsx:11`.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/components/tour-provider.tsx` (context portion) | provider | event-driven | First `createContext`/`useContext` in the codebase (verified: zero usages in `src/`). Canonical shape documented above from RESEARCH Pattern 4 + UI-SPEC §"Interaction Contract". The `"use client"` + `useState(prop)` + `fetch`-mutation half DOES have an analog (`gym-surface.tsx`); only the React-context plumbing is net-new. |

## Metadata

**Analog search scope:** `src/app/(tabs)/`, `src/app/onboarding/`, `src/lib/supabase/`, `src/lib/onboarding/`, `src/components/onboarding/`, `src/app/api/onboarding-progress/`
**Files scanned (read in full):** layout.tsx, rsc.ts, route.ts, onboarding-progress.ts, steps.ts, completion.ts, username/page.tsx, gym-surface.tsx, cycle/page.tsx (head), completion.test.ts (head); 8-page redirect grep
**Pattern extraction date:** 2026-06-17
