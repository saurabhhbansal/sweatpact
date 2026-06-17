---
phase: 03-minimal-start-tourprovider-wiring
reviewed: 2026-06-17T00:00:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - src/app/(tabs)/cycle/page.tsx
  - src/app/(tabs)/dashboard/page.tsx
  - src/app/(tabs)/groups/[id]/page.tsx
  - src/app/(tabs)/groups/page.tsx
  - src/app/(tabs)/layout.tsx
  - src/app/(tabs)/notifications/page.tsx
  - src/app/(tabs)/settings/page.tsx
  - src/app/(tabs)/u/[username]/page.tsx
  - src/app/(tabs)/u/me/page.tsx
  - src/components/tour-provider.tsx
  - src/lib/onboarding/current-step.test.ts
  - src/lib/onboarding/current-step.ts
  - src/lib/supabase/rsc.ts
findings:
  critical: 3
  warning: 5
  info: 3
  total: 11
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-06-17T00:00:00Z
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

This phase wires `TourProvider` into the `(tabs)` layout, introduces `rsc.ts`
for request-cached RSC data access, and adds the `deriveCurrentStep` pure
function with its test suite. The onboarding logic itself is clean and
well-tested. The critical issues are concentrated in the data-access layer
(`rsc.ts`) and the `u/me` redirect, with a cluster of looser type-safety
findings across several page components.

---

## Critical Issues

### CR-01: `getOnboardingProgress` uses admin client without error-branch handling — silently returns null on any DB error, masking data

**File:** `src/lib/supabase/rsc.ts:49-54`

**Issue:** `getOnboardingProgress` calls `createAdminClient()` and destructures
only `{ data }`, discarding the `error` return. When Postgres is unavailable, a
column is missing, or RLS is misconfigured, `data` is `null` and `error` is
non-null — but the function silently returns `null`. The layout then calls
`defaultProgress()`, resetting the user's in-memory tour state to step 1 on
every hard reload even if they had already completed half the tour. The
best-effort `dismiss` and `advance` calls are then made against a stale
baseline. More critically, `getViewerProfile` (same pattern, line 29) does
the same for the profile read. A transient DB hiccup causes the layout to
redirect to `/login` instead of rendering — this is the correct fallback for
a missing profile, but the root cause (a DB error vs. a genuinely missing row)
is undetectable.

For `getOnboardingProgress` specifically, silently returning `null` on an error
produces user-visible state regression (tour restarts) that no log captures.

**Fix:**
```typescript
export const getOnboardingProgress = cache(async (): Promise<ProgressRow | null> => {
  const user = await getAuthUser();
  if (!user) return null;
  const { data, error } = await createAdminClient()
    .from("onboarding_progress")
    .select("mandatory_done, tour_version, last_step_id, completed_steps, dismissed, completed_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) {
    console.error("[getOnboardingProgress] db error", error.message);
    return null; // explicit: keeps the silent-null intent but logs the cause
  }
  return data ?? null;
});
```

Apply the same pattern to `getViewerProfile` (line 29).

---

### CR-02: `u/me/page.tsx` redirects to `/u/null` when username is null

**File:** `src/app/(tabs)/u/me/page.tsx:9`

**Issue:** `redirect(\`/u/${profile.username}\`)` is called without checking
whether `profile.username` is null. The layout gate (`isAutoUsername`) only
catches the `user_[hex8]` pattern; a null username passes `isAutoUsername`
(line 12-13 in `layout.tsx` returns `true` for null — actually `!u` is the
first clause, so null IS caught there). However, `getViewerProfile` in `rsc.ts`
joins to the `profiles` table and `username` is typed as `string | null` in
the returned row. If a user whose username is null somehow reaches this page
(edge case: layout cookie freshness race or direct navigation to `/u/me`
before the layout gate fires in a parallel RSC render), the app navigates to
the literal URL `/u/null`, which triggers the `[username]` page with the
string `"null"` and returns a 404 rather than a login redirect.

**Fix:**
```typescript
export default async function MyProfileRedirect() {
  const profile = await getViewerProfile();
  if (!profile) redirect("/login");
  if (!profile.username) redirect("/onboarding/username");
  redirect(`/u/${profile.username}`);
}
```

---

### CR-03: `TourProvider` `advance()` fires a fire-and-forget fetch without guarding against `dismissed` state — dismissed tour can silently re-open

**File:** `src/components/tour-provider.tsx:66-79`

**Issue:** `advance(stepId)` appends to `completed_steps` and PATCHes the
server regardless of whether `progress.dismissed` is `true`. If a race occurs
where `dismiss()` is called optimistically (sets `dismissed: true` locally) and
then `advance()` is called on the same render cycle (e.g., an unmounting step
component fires its completion callback), `advance()` will:

1. Optimistically set `completed_steps` but NOT touch `dismissed` — so local
   state still has `dismissed: true` (correct).
2. PATCH `{ complete_step: stepId, last_step_id: stepId }` to the server, which
   calls `mergeProgress`. Because `dismissed` is not in the PATCH body, the
   server-side `mergeProgress` preserves `dismissed: true` (correct server-side).

So far so good — BUT the call to `advance()` also triggers a `setProgress`
optimistic update that reconstructs progress from spread: `{ ...p,
completed_steps: [...], last_step_id: stepId }`. That spread keeps
`p.dismissed` intact so `currentStepId` stays `null` (because `dismissed` is
checked first in `deriveCurrentStep`).

On closer inspection, this race is actually safe in the current code. However,
there is a subtler real bug: `advance(stepId)` appends `stepId` to
`completed_steps` even if `stepId` is an arbitrary string (no validation
against the `STEPS` registry). A consumer calling `useTour().advance("injected_step")`
could silently pollute `completed_steps` with an unrecognised key. The server
correctly enforces `STEP_KEY_REGEX` via `PatchBody`, but the client-side
optimistic state has no guard. A typo at a call-site would cause a permanent
phantom entry in the local array that the server would reject (400), leaving
client and server out of sync until the next hard reload.

**Fix:**
```typescript
import { STEPS } from "@/lib/onboarding/steps";
const VALID_IDS = new Set(STEPS.map((s) => s.id));

async function advance(stepId: string) {
  if (!VALID_IDS.has(stepId)) {
    console.error("[TourProvider] advance() called with unknown stepId:", stepId);
    return;
  }
  setProgress((p) => ({
    ...p,
    completed_steps: p.completed_steps.includes(stepId)
      ? p.completed_steps
      : [...p.completed_steps, stepId],
    last_step_id: stepId,
  }));
  await fetch("/api/onboarding-progress", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ complete_step: stepId, last_step_id: stepId }),
  }).catch(() => {});
}
```

---

## Warnings

### WR-01: `dashboard/page.tsx` uses `(profile as any)` to access `weekly_goal` and `rest_days`

**File:** `src/app/(tabs)/dashboard/page.tsx:33-36`

**Issue:** `weekly_goal` and `rest_days` are cast via `(profile as any)` on
three lines. `getViewerProfile` selects both columns (line 32 of `rsc.ts`), so
they exist at runtime, but TypeScript's strict mode cannot verify this because
the return type of `getViewerProfile` is inferred from the Supabase `select()`
call at runtime (the Supabase client's type inference depends on the generated
types file). Using `as any` here bypasses type checking for the downstream
calculations — if `weekly_goal` were ever removed from the select string in
`rsc.ts`, this page would silently fall back to `4` and no TypeScript error
would surface.

**Fix:** Either type-assert the profile return type explicitly or, better,
access the columns without a cast by ensuring the generated types for the
`profiles` table include `weekly_goal: number | null` and `rest_days:
number[] | null`.

```typescript
// If the Supabase generated types cover weekly_goal / rest_days:
const weeklyGoal: number = profile.weekly_goal ?? 4;
const restDays: number[] = Array.isArray(profile.rest_days) ? profile.rest_days : [];
```

---

### WR-02: `groups/page.tsx` iterates obligation amounts without `Number()` coercion — potential NaN accumulation

**File:** `src/app/(tabs)/groups/page.tsx:102`

**Issue:** `inner.set(pairKey, (inner.get(pairKey) ?? 0) + obl.amount_cents)`
adds `obl.amount_cents` directly. `obl` is cast `as any[]`, so `amount_cents`
could be a string (Supabase returns `numeric`/`bigint` columns as strings in
some driver versions). The `groups/[id]/page.tsx` comparison at line 196
(`obligation.amount_cents`) suffers from the same pattern. If any value is a
string, the `+` operator concatenates rather than adds, producing malformed
strings like `"050"` instead of `50`. Downstream this reaches `formatCents`,
which likely calls `Number()` and may or may not recover cleanly.

`dashboard/page.tsx` correctly applies `Number(o.amount_cents ?? 0)` (lines
96-101) — the groups page should do the same.

**Fix:**
```typescript
inner.set(pairKey, (inner.get(pairKey) ?? 0) + Number(obl.amount_cents));
```

Apply the same coercion in `groups/[id]/page.tsx` line 196:
```typescript
entry.total_cents += Number(obligation.amount_cents);
// and initial set:
aggregatedMap.set(key, { ..., total_cents: Number(obligation.amount_cents), ... });
```

---

### WR-03: `rsc.ts` imports `createAdminClient` which is "server-only" but the module has no `import "server-only"` guard

**File:** `src/lib/supabase/rsc.ts:1-4`

**Issue:** `rsc.ts` is explicitly documented as "only be imported from Server
Components" (line 11). It calls `createAdminClient()` which uses
`SUPABASE_SERVICE_ROLE_KEY` — a secret that must never reach the browser bundle.
However, neither `rsc.ts` nor `admin.ts` imports `"server-only"` (the Next.js
package that throws a build-time error if the module is included in a Client
Component bundle). A developer who accidentally `import`s `getOnboardingProgress`
or `getViewerProfile` from a `"use client"` component would silently expose
the service-role key to the client bundle in development; in production the key
would be `undefined` (it's not `NEXT_PUBLIC_`), causing silent auth failures.

**Fix:** Add `import "server-only";` as the first line of `src/lib/supabase/rsc.ts`
and `src/lib/supabase/admin.ts`. This turns accidental client imports into a
hard build error.

```typescript
// src/lib/supabase/rsc.ts — first line:
import "server-only";
```

---

### WR-04: `deriveCurrentStep` probe parameter passes `completedSteps` redundantly, creating a subtle divergence risk

**File:** `src/components/tour-provider.tsx:50-58`

**Issue:** `deriveCurrentStep` is called with:
```typescript
deriveCurrentStep(progress.completed_steps, progress.dismissed, {
  gymCount: 0,
  restDays: [],
  completedSteps: progress.completed_steps,  // same array passed twice
})
```

`probe.completedSteps` and the first `completedSteps` argument are identical
here, but `isShortcutDone(probe.completedSteps)` checks for `"shortcut_viewed"`
in the probe array, while `completedSteps.includes(step.id)` checks the first
argument. If a future caller ever passes different arrays (e.g., a stale probe),
`shortcut_viewed` could be in `completed_steps` (marking it "done") but absent
from `probe.completedSteps`, causing `isShortcutDone` to return `false` and
the step to be treated as pending even though it is complete. The function
signature invites this mistake because the two arrays look independent.

This is currently safe but fragile. The `shortcut_viewed` step is the only one
where completion and probe use the same underlying data source, which makes the
double-pass invisible.

**Fix:** Document the constraint in `deriveCurrentStep`'s JSDoc, or restructure
the probe so `completedSteps` is not duplicated:

```typescript
// Option: derive shortcut done from completedSteps directly inside the function
// (remove probe.completedSteps entirely)
if (step.probe === "shortcut" && isShortcutDone(completedSteps)) continue;
```

This change would require removing `completedSteps` from `ProbeId` type and the
probe object, simplifying both the call site and the function.

---

### WR-05: `u/[username]/page.tsx` uses non-null assertion on `profile.username` in two places without null guard

**File:** `src/app/(tabs)/u/[username]/page.tsx:156, 203, 229`

**Issue:** `profile.username!` is used three times. `username` is typed as
`string | null` in the profile select (line 37). The page verifies `profile`
is not null (via `notFound()`) but not that `username` is not null. For the
`UsernameEditor` (line 156) this is only rendered when `isOwner` is true, and
an owner's username would have been caught by the layout gate — but only when
the layout gate is in the same request. For the `ChallengeButton` uses (lines
203, 229), a user with a null username would cause a runtime null-dereference
passed as `targetUsername: null!`, which the `ChallengeButton` component likely
uses in a redirect URL.

**Fix:**
```typescript
// Before each use site, add a null guard:
if (!profile.username) notFound(); // or redirect to onboarding

// Or narrow the type after the existence check:
const username = profile.username ?? "";
```

---

## Info

### IN-01: Duplicated `isAutoUsername` function between two files

**File:** `src/app/(tabs)/layout.tsx:12-14` and `src/app/onboarding/username/page.tsx:11-13`

**Issue:** The comment on line 10 of `layout.tsx` acknowledges the copy: "Copied
from src/app/onboarding/username/page.tsx — one definition, one regex." Despite
the comment, a future regex change still requires two edits. The `STEP_KEY_REGEX`
pattern in `onboarding-progress.ts` demonstrates the project's pattern for
sharing such constants via a lib module.

**Fix:** Extract to `src/lib/username.ts`:
```typescript
export const AUTO_USERNAME_RE = /^user_[a-f0-9]{8}$/;
export function isAutoUsername(u: string | null): boolean {
  return !u || AUTO_USERNAME_RE.test(u);
}
```
Then import it in both pages.

---

### IN-02: `console.error` in page components contradicts project logging conventions

**File:** `src/app/(tabs)/cycle/page.tsx:63`, `src/app/(tabs)/dashboard/page.tsx:247`

**Issue:** Both pages catch render errors and call `console.error(...)`. The
project's CLAUDE.md logging convention states: "Error states logged implicitly
through response status codes, not console.log." Using `console.error` in
Server Components is less of a bug and more a convention violation — the log
appears server-side only, but may leak internal error details in log aggregators.

**Fix:** Use a structured server logger abstraction, or at minimum filter the
error object before logging (avoid logging the full `error` object which may
contain DB query details or stack traces with file paths).

---

### IN-03: Test file uses `Object.freeze` cast via `as unknown as` — unnecessary double cast

**File:** `src/lib/onboarding/current-step.test.ts:107-108`

**Issue:**
```typescript
restDays: Object.freeze([0]) as unknown as number[],
completedSteps: Object.freeze(["shortcut_viewed"]) as unknown as string[],
```
`Object.freeze([0])` returns `readonly number[]`, which TypeScript allows to be
passed to a `number[]` parameter with a direct cast. The `as unknown as` double
cast pattern is only needed when the types are structurally incompatible. Here
a single `as number[]` suffices. The double cast suggests uncertainty about the
type rather than intentional unsafety.

**Fix:**
```typescript
restDays: Object.freeze([0]) as number[],
completedSteps: Object.freeze(["shortcut_viewed"]) as string[],
```

---

_Reviewed: 2026-06-17T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
