---
phase: 05-cross-route-walkthrough-teaching-content
reviewed: 2026-06-18T00:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - src/app/(tabs)/dashboard/page.tsx
  - src/app/(tabs)/groups/page.tsx
  - src/app/(tabs)/notifications/client.tsx
  - src/app/(tabs)/shortcut/page.tsx
  - src/components/tour/coachmark-card.tsx
  - src/components/tour/coachmark-renderer.tsx
  - src/components/tour/empty-state-pact-cta.tsx
  - src/components/tour/getting-started-checklist.tsx
  - src/lib/onboarding/steps.test.ts
  - src/lib/onboarding/steps.ts
findings:
  critical: 1
  warning: 4
  info: 2
  total: 7
status: issues_found
---

# Phase 05: Code Review Report

**Reviewed:** 2026-06-18
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

The ten files reviewed implement the cross-route coachmark walkthrough and its teaching content for Phase 5. The financial-safety guarantee for `PracticeCheckIn` is sound — confirmed zero network calls, no `/api/checkin` reference in executable code paths, and no geolocation access. The data-attribute anchors (`data-tour="*"`) are correctly placed across all four route files. The `GettingStartedChecklist` and `EmptyStatePactCTA` components are structurally correct.

One critical navigation bug was found: the invited-user path for the `challenge` step creates an infinite router loop between `/notifications` and `/groups`. Four warnings cover a `setTimeout` leak, a React component-in-hook anti-pattern that causes form state loss, the `clearAll` error-recovery mismatch, and the `TEACHING_KEYS` runtime mutability gap. Two info items cover the duplicate `today` history entry and a test coverage gap.

---

## Critical Issues

### CR-01: Infinite navigation loop on the invited-user challenge step

**File:** `src/components/tour/coachmark-renderer.tsx:246-252`

**Issue:** When the tour reaches the `challenge` step and the user has a pending invitation (`pendingCount > 0`), `effectiveRoute("challenge")` reads `data-pending-count` from the DOM and returns `/notifications`. The navigation effect runs, `router.push("/notifications")` fires, and `pathname` changes. The effect dependency `[isActive, currentStepId, pathname, router]` then re-triggers on the new pathname. On `/notifications`, `data-pending-count` is absent (it is only rendered by `/groups/page.tsx`), so `readPendingCount()` returns `0`. `effectiveRoute("challenge")` now returns the registry default `/groups`. Since `/groups !== /notifications`, `router.push("/groups")` fires. The user lands back on `/groups`, `data-pending-count` is present again, `readPendingCount()` returns `> 0`, and the loop repeats indefinitely.

The `notifications/page.tsx` has no `data-pending-count` attribute and no mechanism to break this cycle.

**Fix:** Capture the effective route **once** at the moment the step becomes active and do not re-evaluate it when `pathname` changes. Use a `useRef` or a derived state that is set only when `currentStepId` changes, not when `pathname` changes:

```tsx
// Capture effective route when step changes, not on every pathname change.
const lockedRouteRef = useRef<string | null>(null);
useEffect(() => {
  if (!isActive || !currentStepId) {
    lockedRouteRef.current = null;
    return;
  }
  // Read DOM-dependent route ONCE when the step is first activated.
  lockedRouteRef.current = effectiveRoute(currentStepId);
}, [isActive, currentStepId]); // NOTE: pathname intentionally omitted

useEffect(() => {
  if (!isActive || !currentStepId) return;
  const target = lockedRouteRef.current;
  if (target && target !== pathname) {
    router.push(target);
  }
}, [isActive, currentStepId, pathname, router]);
```

Alternatively, remove `pathname` from the deps of the combined effect and add a ref-based guard that marks the push as already-issued for the current step:

```tsx
const pushedForStep = useRef<string | null>(null);
useEffect(() => {
  if (!isActive || !currentStepId) { pushedForStep.current = null; return; }
  if (pushedForStep.current === currentStepId) return; // already pushed
  const target = effectiveRoute(currentStepId);
  if (target && target !== pathname) {
    pushedForStep.current = currentStepId;
    router.push(target);
  }
}, [isActive, currentStepId, pathname, router]);
```

---

## Warnings

### WR-01: `window.setTimeout` not cancelled on unmount — spurious `onComplete` after step change

**File:** `src/components/tour/coachmark-renderer.tsx:133-149`

**Issue:** `PracticeCheckIn.runPractice()` calls `window.setTimeout(() => { onComplete(); }, 400)` but does not capture the timer ID. The `useEffect` cleanup at line 133–135 calls `setSimulating(false)`, which resets the visual state but **does not prevent the pending timer from firing**. If the step advances (the component unmounts) before the 400ms elapses, the old `onComplete` closure fires on the already-advanced `currentStepId`. Although `TourProvider.advance()` deduplicates the completed-step write, the spurious call still executes `handleAdvance()` which calls `advance(OLD_STEP_ID)`, producing an unexpected optimistic state update cycle. The comment at line 131-132 claims this guard works, which is misleading.

**Fix:** Store the timer ID and clear it on unmount:

```tsx
useEffect(() => {
  let timerId: ReturnType<typeof window.setTimeout> | null = null;

  // expose a setter for runPractice to populate
  (runPracticeRef as any).current = (id: ReturnType<typeof window.setTimeout>) => {
    timerId = id;
  };

  return () => {
    if (timerId !== null) window.clearTimeout(timerId);
  };
}, []);
```

Simpler approach using a ref to hold the timer ID:

```tsx
const timerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);

useEffect(() => {
  return () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
  };
}, []);

function runPractice() {
  if (simulating) return;
  if (reducedMotion) { onComplete(); return; }
  setSimulating(true);
  timerRef.current = window.setTimeout(() => {
    timerRef.current = null;
    onComplete();
  }, 400);
}
```

---

### WR-02: `TooltipAdapter` defined inside `useCallback` — causes tooltip remount and form state loss

**File:** `src/components/tour/coachmark-renderer.tsx:391-414`

**Issue:** `TooltipAdapter` is created with `useCallback` inside `CoachmarkRenderer`. React-joyride receives this as a component type reference via `tooltipComponent`. Every time the `useCallback` deps change (`currentStepId`, `stepTitle`, `stepBody`, `surfaceNode`, `handleAdvance`, `handleDismiss`), a new function reference is produced. Because React identifies component types by reference identity, when joyride calls `React.createElement(tooltipComponent, ...)` with the new reference, React **unmounts the old tooltip tree and mounts a new one**. For surface-bearing steps (`schedule`, `gym`), `ScheduleSurface` and `GymSurface` are embedded inside the tooltip tree — they will lose all form state (selected goal, picked gym) every time any dep changes, including on each keystroke or dialog open/close that triggers a re-render.

**Fix:** Move `TooltipAdapter` outside the component function (at module scope), convert it to a forwardRef or accept all required values via a context or a stable props object:

```tsx
// At module level — stable reference, never re-created.
const TooltipAdapter = React.memo(function TooltipAdapter(
  _props: TooltipRenderProps & { card: React.ReactNode }
) {
  return (
    <div style={{ paddingTop: "max(16px, env(safe-area-inset-top))", ... }}>
      {_props.card}
    </div>
  );
});
```

Then pass the fully-composed `<CoachmarkCard .../>` as a stable prop or via a small context. Alternatively, if joyride supports `tooltipComponent` as a stable wrapper that receives its own props, keep all dynamic values in those props rather than in the component reference closure.

---

### WR-03: `clearAll` error-recovery message claims restoration before router.refresh() completes

**File:** `src/app/(tabs)/notifications/client.tsx:147-159`

**Issue:** `clearAll()` sets `setItems([])` optimistically (line 149) and on failure sets the error message `"Couldn't clear notifications. They've been restored."` (line 156) and then calls `router.refresh()` (line 158). The `setItems([])` optimistic wipe is NOT reversed in the error branch — items are only restored once `router.refresh()` completes and the server component re-renders. During the window between the error message appearing and the refresh completing, the UI shows an empty list alongside "They've been restored." — a factually incorrect UI state that may confuse users into thinking items are visible when they are not.

Compare `dismiss()` (line 133-145), which also doesn't restore state locally but does not display "restored" in the error message — it says "Couldn't dismiss... It's been restored." after calling `router.refresh()`.

**Fix:** Either restore the items immediately in the error branch before calling `router.refresh()`:

```tsx
if (!res.ok) {
  setItems(prev => prev.length === 0 ? /* cannot restore, items gone */ prev : prev);
  setErr("Couldn't clear notifications.");
  startTransition(() => router.refresh());
  return;
}
```

Or, keep a snapshot before clearing and restore it on failure:

```tsx
async function clearAll() {
  setErr(null);
  const snapshot = items; // capture before wipe
  setItems([]);
  const res = await fetch(/* ... */);
  if (!res.ok) {
    setItems(snapshot); // restore immediately
    setErr("Couldn't clear notifications.");
  }
  startTransition(() => router.refresh());
}
```

---

### WR-04: `TEACHING_KEYS` is not runtime-frozen — TypeScript `readonly` only

**File:** `src/lib/onboarding/steps.ts:76`

**Issue:** `TEACHING_KEYS` is declared as `readonly string[]` which is a TypeScript-only constraint. Unlike `STEPS` (which is `Object.freeze()`'d at line 62), `TEACHING_KEYS` can be mutated at runtime by any code that casts to `any` or arrives through non-TS paths. The test suite verifies `Object.isFrozen(STEPS)` (steps.test.ts:56) but has no corresponding assertion for `TEACHING_KEYS`. The `GettingStartedChecklist` and `completion.ts` consumers of `TEACHING_KEYS` would silently produce incorrect "tour complete" determinations if the array were mutated.

**Fix:**

```ts
// steps.ts:76
export const TEACHING_KEYS: readonly string[] = Object.freeze(
  ["gym", "challenge", "money", "shortcut_viewed"]
);
```

And add to `steps.test.ts`:

```ts
it("cannot be mutated by callers (TEACHING_KEYS is frozen)", () => {
  expect(Object.isFrozen(TEACHING_KEYS)).toBe(true);
  expect(() => {
    (TEACHING_KEYS as string[]).push("intruder");
  }).toThrow();
});
```

---

## Info

### IN-01: Duplicate `today` entry appended to `CheckinStrip` history

**File:** `src/app/(tabs)/dashboard/page.tsx:159`

**Issue:** The `history` prop passed to `CheckinStrip` is `[...(dailyHistory ?? []), { local_day: today, status: todayStatus }]`. The `dailyHistory` query (line 69-74) uses `.gte("local_day", joinedDay)` with no upper-bound, so it includes today's row from `daily_status`. The manually appended `{ local_day: today, status: todayStatus }` duplicates the today entry. `CheckinStrip` deduplicates via `Map.set` (overwrite semantics), so the last value — the manually appended `todayStatus` — wins. The behavior is intentional (force today's derived status) but the duplication is implicit and relies on a secondary guarantee in `CheckinStrip`. The intent would be clearer and the duplication avoided by filtering before appending:

```tsx
history={[
  ...(dailyHistory ?? []).filter((r) => r.local_day !== today),
  { local_day: today, status: todayStatus },
]}
```

---

### IN-02: `steps.test.ts` does not assert that `STEPS` inner objects are frozen

**File:** `src/lib/onboarding/steps.test.ts:55-59`

**Issue:** The test at line 55 asserts `Object.isFrozen(STEPS)` (the outer array) is `true` and verifies that `.push()` throws. However, `Object.freeze` on an array only prevents adding/removing entries — the individual step objects (`STEPS[0]`, etc.) are **not deeply frozen**. Runtime code could mutate `STEPS[0].route = "/malicious"` without throwing. The test does not cover this and the comment at line 62 in `steps.ts` references only the T-02-01 threat ("downstream caller cannot corrupt the shared array"), which is only partially mitigated.

**Fix:** Either use a deep-freeze utility or add assertions against property mutation:

```ts
it("step objects inside STEPS cannot be mutated (shallow freeze not enough)", () => {
  expect(() => {
    (STEPS[0] as any).route = "/injected";
  }).toThrow();
});
```

Or in `steps.ts`, deep-freeze each entry:

```ts
export const STEPS: readonly OnboardingStep[] = Object.freeze(
  ([...]) .map((step) => Object.freeze(step))
);
```

---

_Reviewed: 2026-06-18_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
