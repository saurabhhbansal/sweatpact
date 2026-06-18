---
phase: 03-minimal-start-tourprovider-wiring
fixed_at: 2026-06-18T00:00:00Z
review_path: .planning/phases/03-minimal-start-tourprovider-wiring/03-REVIEW.md
iteration: 1
fix_scope: critical_warning
findings_in_scope: 8
fixed: 8
skipped: 0
status: all_fixed
---

# Phase 03: Code Review Fix Report

**Fixed at:** 2026-06-18T00:00:00Z
**Source review:** `.planning/phases/03-minimal-start-tourprovider-wiring/03-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 8
- Fixed: 8
- Skipped: 0

## Fixed Issues

### CR-01: `getOnboardingProgress` / `getViewerProfile` silent error discard

**Files modified:** `src/lib/supabase/rsc.ts`
**Commit:** 5a8fc60
**Applied fix:** Destructured `error` from both admin client calls. Added `if (error) console.error(...)` blocks with prefixed function names (`[getViewerProfile]`, `[getOnboardingProgress]`) before returning `null`. Both functions now log DB errors rather than silently swallowing them.

---

### CR-02: `u/me/page.tsx` redirects to `/u/null` when username is null

**Files modified:** `src/app/(tabs)/u/me/page.tsx`
**Commit:** 381885f
**Applied fix:** Added `if (!profile.username) redirect("/onboarding/username");` after the existing profile null check, before the `redirect(\`/u/${profile.username}\`)` call.

---

### CR-03: `TourProvider` `advance()` appends arbitrary stepId without validation

**Files modified:** `src/components/tour-provider.tsx`
**Commit:** ff48429
**Applied fix:** Imported `STEPS` from `@/lib/onboarding/steps` and built `const VALID_IDS = new Set(STEPS.map((s) => s.id))` at module level. Added an early return with `console.error` in `advance()` if `!VALID_IDS.has(stepId)`, preventing phantom keys from entering optimistic state.

---

### WR-01: `dashboard/page.tsx` `(profile as any)` casts for `weekly_goal` / `rest_days`

**Files modified:** `src/app/(tabs)/dashboard/page.tsx`
**Commit:** 058020d
**Applied fix:** Removed all three `(profile as any)` casts. Access is now direct: `profile.weekly_goal ?? 4` and `Array.isArray(profile.rest_days)`. Since no Supabase generated database types file exists the client infers `any` for the select result, so the typed accesses compile cleanly without a cast.

---

### WR-02: `groups/page.tsx` and `groups/[id]/page.tsx` missing `Number()` coercion for `amount_cents`

**Files modified:** `src/app/(tabs)/groups/page.tsx`, `src/app/(tabs)/groups/[id]/page.tsx`
**Commit:** 72abd30
**Applied fix:**
- `groups/page.tsx` line 102: `obl.amount_cents` -> `Number(obl.amount_cents)` in the `inner.set(pairKey, ...)` accumulation.
- `groups/[id]/page.tsx`: both `entry.total_cents += obligation.amount_cents` and the initial `total_cents: obligation.amount_cents` in `aggregatedMap.set()` wrapped with `Number(...)`.

---

### WR-03: `rsc.ts` missing `import "server-only"` guard

**Files modified:** `src/lib/supabase/rsc.ts`
**Commit:** 5a8fc60 (combined with CR-01)
**Applied fix:** Added `import "server-only";` as the first line of `rsc.ts`. This turns any accidental client-component import of this module into a hard build error, preventing the service-role key from reaching the browser bundle.

---

### WR-04: `deriveCurrentStep` receives `completedSteps` redundantly in probe

**Files modified:** `src/components/tour-provider.tsx`, `src/lib/onboarding/current-step.ts`, `src/lib/onboarding/current-step.test.ts`
**Commit:** 3533359
**Applied fix:** Restructured `deriveCurrentStep` to accept `probe: { gymCount: number; restDays: number[] }` (no `completedSteps` field). The `isShortcutDone` check now uses the first `completedSteps` argument directly — since that is already the identical data, this removes the footgun where the two arrays could diverge. The JSDoc documents the reason. All three files updated atomically: the function signature, the call site in `TourProvider`, and all test probe objects.

---

### WR-05: `u/[username]/page.tsx` non-null assertions on `profile.username`

**Files modified:** `src/app/(tabs)/u/[username]/page.tsx`
**Commit:** f136ca8
**Applied fix:** Added `if (!profile.username) notFound();` immediately after the existing `if (!profile) notFound();` guard. Removed the three `profile.username!` non-null assertions at the `UsernameEditor`, and the two `ChallengeButton` `targetUsername` props — TypeScript narrows the type to `string` after the `notFound()` guard (which returns `never`).

---

_Fixed: 2026-06-18T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
