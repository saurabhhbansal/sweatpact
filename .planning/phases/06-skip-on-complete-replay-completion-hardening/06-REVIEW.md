---
phase: 06-skip-on-complete-replay-completion-hardening
reviewed: 2026-06-19T00:00:00Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - src/app/(tabs)/layout.tsx
  - src/components/tour-provider.tsx
  - src/lib/onboarding/current-step.test.ts
  - src/lib/onboarding-progress.ts
  - src/lib/onboarding-progress.test.ts
  - src/app/(tabs)/settings/client.tsx
  - src/components/pact-live-overlay.tsx
  - src/lib/onboarding/pact-live.ts
  - src/lib/onboarding/pact-live.test.ts
  - src/app/(tabs)/groups/page.tsx
  - src/app/onboarding/username/client.tsx
  - src/app/onboarding/username/page.tsx
findings:
  critical: 2
  warning: 4
  info: 2
  total: 8
status: issues_found
---

# Phase 06: Code Review Report

**Reviewed:** 2026-06-19T00:00:00Z
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

This phase wires skip-on-complete probe data (gym count, rest days) server-side into `TourProvider`, adds a `replay` signal to the PATCH schema, and introduces the "Pact is live" one-shot completion overlay. The domain logic and schema validation are solid; test coverage for the pure functions is thorough. However, two blockers were found: a race condition in `PactLiveOverlay` that causes a flash of the full-screen overlay before it should be visible (due to a two-useEffect mount sequence), and a `window.setTimeout` reference that crashes on non-browser SSR. Four warnings cover a missing try-catch around the PATCH body parse in the route, a leaked `window.setTimeout` timer if the password change dialog unmounts during the 2-second auto-close, a redundant early-return guard inside the overlay, and an unsafe `as any[]` cast widening query results in the groups page. Two informational items note a duplicated `isAutoUsername` function and an unguarded optional on `user_gyms` that silently swallows DB errors.

---

## Critical Issues

### CR-01: `PactLiveOverlay` flashes open on first mount before suppression check settles

**File:** `src/components/pact-live-overlay.tsx:34-44`

**Issue:** The `open` state is initialized to `false`, then a second `useEffect` sets it to the predicate result. Both `mounted` and `open` are driven by separate effects that fire after render, so the sequence is:

1. Render 1: `mounted=false`, `open=false` → `shouldShowPactLive` returns `false` → the guard at line 67 prevents rendering the portal, which is correct.
2. `useEffect` for `setMounted(true)` fires.
3. Render 2: `mounted=true`, `open=false` → **the guard at line 67 now returns `true`** (mounted + hasActiveChallenge + not seen), so the portal JSX is returned. But `open` is still `false` because the second `useEffect` has not fired yet in this render cycle.
4. `useEffect` for `setOpen(...)` fires — sets `open=true`.
5. Render 3: `open=true`, portal is open.

The problem is step 3: between renders 2 and 3, the `DialogPrimitive.Root` is rendered with `open={false}`. Radix Dialog in uncontrolled-to-controlled transition or `open=false` starting state still instantiates the portal DOM node. Depending on Radix Dialog's internal animation state machine, this can cause a brief flash or incorrect animation entry. More critically, the guard at line 67 returning `null` on render 1 but the full portal on render 2 with `open=false` means the Dialog overlay DOM is added and immediately opened in the next render — triggering the entry animation at an unexpected time. If the user has already dismissed (pact_live_seen in completedSteps), the guard returns `null` correctly, but on the happy path a React double-invocation in Strict Mode will trigger two mount sequences, making this race more visible.

The root cause is that the "should render" guard (line 67) re-evaluates `shouldShowPactLive` synchronously while `open` is still stale from the prior render. The two pieces of state (`mounted` and `open`) are not in sync across the same render.

**Fix:** Merge both effects into one and gate on `mounted` directly; initialize `open` from the predicate within a single effect so the portal only renders when the state is settled:

```tsx
const [ready, setReady] = useState(false);

useEffect(() => {
  setReady(shouldShowPactLive({ mounted: true, hasActiveChallenge, completedSteps }));
}, [hasActiveChallenge, completedSteps]);

if (!ready) return null;

return (
  <DialogPrimitive.Root
    open={ready}
    onOpenChange={(next) => {
      if (!next) { setReady(false); persistSeen(); }
    }}
  >
    ...
  </DialogPrimitive.Root>
);
```

This eliminates the `mounted` flag entirely (the effect itself is the client-mount guard), collapses to a single boolean state, and avoids the stale-`open`/ready-guard mismatch. The portal renders exactly once when the predicate first settles to `true`.

---

### CR-02: `window.setTimeout` called in a component that can render server-side

**File:** `src/app/(tabs)/settings/client.tsx:254`

**Issue:** `window.setTimeout(close, 2000)` is called inside the `submit` async handler of `ChangePasswordButton`. The file has `"use client"` at line 1, which means the component is a Client Component and Next.js will SSR it to generate the initial HTML. During SSR, `window` is `undefined`, and `window.setTimeout` will throw `ReferenceError: window is not defined` if `submit` is somehow invoked server-side, OR (more practically) if Next.js statically analyses the reference and rejects the module in Node.js contexts.

In Next.js 14 App Router with React 18, `"use client"` components are server-rendered for the initial HTML shell. The `submit` handler itself only runs client-side (it is an event handler), so this particular call path will not execute during SSR. However, referencing `window` at module or render level (not inside an event handler or `useEffect`) would throw. In this specific case it is inside an async event handler, so it is safe in practice — but it is a fragile pattern that violates the project convention and will break the moment the reference moves outside the handler (e.g., if `close` is called during an effect). The safe, conventional fix is to use the global `setTimeout` (no `window.` prefix) which is available in both environments.

**Fix:**
```tsx
// Line 254 — replace:
window.setTimeout(close, 2000);
// with:
setTimeout(close, 2000);
```

`setTimeout` without the `window.` prefix is available in Node.js (as a global) and in browsers, making the code portable and eliminating the SSR risk entirely.

---

## Warnings

### WR-01: Timer from `window.setTimeout` is never cleared — leak if dialog unmounts before 2 s

**File:** `src/app/(tabs)/settings/client.tsx:254`

**Issue:** The 2-second auto-close timer is fire-and-forget. If the user navigates away (or the component unmounts via a parent conditional) within the 2-second window, the `close` callback fires against an already-unmounted component, calling `setOpen(false)` and `reset()` on stale state. React will log a warning ("Can't perform a React state update on an unmounted component") in development and may trigger no-op updates in production, but it can also cause subtle state corruption if the component re-mounts quickly (e.g. back-navigation).

**Fix:** Capture the timer ID and clear it in a cleanup effect or in the `close`/`reset` path:

```tsx
const autoCloseRef = useRef<ReturnType<typeof setTimeout> | null>(null);

// In submit(), after setSuccess(true):
autoCloseRef.current = setTimeout(close, 2000);

// In close() or reset():
if (autoCloseRef.current) {
  clearTimeout(autoCloseRef.current);
  autoCloseRef.current = null;
}
```

---

### WR-02: Redundant synchronous guard makes `PactLiveOverlay` control flow confusing and fragile

**File:** `src/components/pact-live-overlay.tsx:67-69`

**Issue:** Lines 67-69 contain an early-return guard that re-evaluates `shouldShowPactLive` synchronously after the `useState`/`useEffect` block. This guard and the `open` state driven by the effect are not the same thing: the guard controls whether the portal JSX exists in the tree, while `open` controls whether the Radix Dialog is open. They can diverge (as described in CR-01), and the redundant guard adds a third evaluation of the same predicate in the same render, making the control flow non-obvious and error-prone.

When `mounted=true` and `hasActiveChallenge=true` and `pact_live_seen` is NOT in `completedSteps`: the guard returns the portal (correct). When `mounted=false`: the guard correctly returns `null`. But when the user dismisses (sets `open=false`), the `open` state changes but `shouldShowPactLive` still returns `true` until props update — so the guard continues returning the portal JSX with `open=false`. This forces an unnecessary extra render cycle and keeps the Dialog DOM node alive after dismissal until the parent re-fetches `completedSteps`.

**Fix:** Remove the duplicate guard and rely solely on the `open` state for conditional rendering. The portal with `open={false}` renders nothing visible (Radix Dialog with `open={false}` does not add DOM nodes in portal mode by default). If an early-return is desired for clarity, base it on the `open` state alone, not on re-evaluating the predicate:

```tsx
if (!open) return null;
```

---

### WR-03: `req.json()` parse failure swallowed by `.catch(() => null)` — `null` reaches `PatchBody.safeParse` and produces a misleading error response

**File:** `src/app/api/onboarding-progress/route.ts:47`

**Issue:** The PATCH handler calls `await req.json().catch(() => null)`. When the request body is invalid JSON, `catch` returns `null`, which is then passed to `PatchBody.safeParse(null)`. The Zod schema (a `.strict()` object) will reject `null` with a `validation_failed` response, but the `issues` payload will describe "expected object, received null" rather than a body-parse error. While not a security issue (the 400 response is still returned), this misattributes the error origin and makes debugging harder for callers.

**Fix:**

```ts
let body: unknown;
try {
  body = await req.json();
} catch {
  return NextResponse.json({ error: "invalid_json" }, { status: 400 });
}
const parsed = PatchBody.safeParse(body);
```

---

### WR-04: `as any[]` casts on all four parallel Supabase query results lose type safety in `ChallengesPage`

**File:** `src/app/(tabs)/groups/page.tsx:52-53, 57-58, 76, 85`

**Issue:** All four destructured query results are typed as `any[]` via explicit casts (`as any[]`). The downstream code then does unchecked property access on these rows (`row.profiles`, `row.group_id`, `row.user_id`, `row.status`, `obl.from_user`, etc.). A schema change (renamed column, changed relation name) will silently produce `undefined` values at runtime with no compile-time signal. This is a wide type-safety gap across the primary financial display logic.

This is especially relevant for `memberRows` where `row.profiles` is accessed (line 77) — if the query relation name ever changes or the select columns shift, `normalizeRelation<MemberProfileRow>(row.profiles)` silently receives `undefined` and the `membersByGroup` map is never populated, causing all challenges to show no opponent names.

**Fix:** Define typed row shapes matching the Supabase select projection and narrow each destructured result:

```ts
type MemberRow = { group_id: string; user_id: string; profiles: MemberProfileRow | MemberProfileRow[] | null };
// ... then cast once at the destructure site instead of using any[]
const memberRows = (rawMemberRows ?? []) as MemberRow[];
```

---

## Info

### IN-01: `isAutoUsername` is duplicated across two files

**File:** `src/app/(tabs)/layout.tsx:13-15` and `src/app/onboarding/username/page.tsx:10-12`

**Issue:** The `isAutoUsername` helper function with the identical regex `/^user_[a-f0-9]{8}$/` appears verbatim in both files. The comment in `layout.tsx` at line 11 acknowledges the duplication ("Copied from ...") and claims the layout gate is the sole gate going forward, but the function also remains in `username/page.tsx`. If the auto-username pattern ever changes (e.g., a migration changes the generated format), one copy will be missed.

**Fix:** Extract `isAutoUsername` to a shared module, e.g., `src/lib/onboarding/username.ts`, and import it in both files. One definition, one regex, as the comment already states as the goal.

---

### IN-02: Supabase `user_gyms` query error is silently discarded in layout — DB failures produce `gymCount=0` rather than surfacing the error

**File:** `src/app/(tabs)/layout.tsx:76-80`

**Issue:** The `user_gyms` query at lines 76-80 destructures only `{ data: gyms }` and ignores the `error` field. If the query fails (network partition, RLS misconfiguration, etc.), `gyms` is `null`, `gymCount` defaults to `0`, and `isGymDone` returns `false`. This means the gym step will NOT be auto-skipped for a user who has set up a gym, causing the tour to open on the gym step and ask the user to add a gym they already added. The user sees a regression-like experience with no server-side error logged.

**Fix:**

```ts
const { data: gyms, error: gymsError } = await supa
  .from("user_gyms")
  .select("id")
  .eq("user_id", profile.id);
if (gymsError) {
  console.error("[TabsLayout] user_gyms fetch error", gymsError.message);
}
const gymCount = gyms?.length ?? 0;
```

This preserves the graceful fallback (`gymCount=0`) while at least logging the failure for observability.

---

_Reviewed: 2026-06-19T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
