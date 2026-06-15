---
phase: 02-step-logic-shared-setup-surfaces
reviewed: 2026-06-15T00:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - src/lib/onboarding/steps.ts
  - src/lib/onboarding/steps.test.ts
  - src/lib/onboarding/completion.ts
  - src/lib/onboarding/completion.test.ts
  - src/components/onboarding/gym-surface.tsx
  - src/components/onboarding/schedule-surface.tsx
  - src/components/onboarding/shortcut-surface.tsx
  - src/app/onboarding/gym/client.tsx
  - src/app/onboarding/schedule/client.tsx
  - src/app/onboarding/shortcut/client.tsx
findings:
  critical: 0
  warning: 6
  info: 2
  total: 8
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-06-15T00:00:00Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Ten files reviewed covering the onboarding step registry (`steps.ts`), completion probes (`completion.ts`), three shared setup surfaces (`gym-surface.tsx`, `schedule-surface.tsx`, `shortcut-surface.tsx`), and three legacy linear-wizard client shells. The domain logic layer (`steps.ts`, `completion.ts`) and their tests are sound. The problems concentrate in the three surface components: all three have `busy` state that can be permanently stuck when a network request throws, and `gym-surface.tsx` has two additional issues — a missing `detailsRes.ok` guard and a `searching` spinner that never resets on early exit from the cleanup path. The `isScheduleDone` probe in `completion.ts` carries a semantic false-negative for a valid user configuration (all 7 days active). The legacy navigation shells are thin and largely correct, but the shortcut shell silently drops a `fetch` error with no user feedback path.

## Warnings

### WR-01: `ScheduleSurface.save` leaves `busy=true` permanently on network failure

**File:** `src/components/onboarding/schedule-surface.tsx:44-49`
**Issue:** `fetch("/api/profile", ...)` is called with no try/catch or finally block. If the request throws (network offline, DNS failure, etc.), execution never reaches `setBusy(false)` on line 49. The form becomes permanently disabled — the user cannot retry without a full page reload.
**Fix:**
```typescript
async function save(goNext: boolean) {
  if (goNext && tooMany) {
    setErr(`Rest days + goal can't exceed 7.`);
    return;
  }
  setBusy(true);
  setErr(null);
  try {
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ weekly_goal: goal, rest_days: restDays }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErr(data.error ?? "Failed");
      return;
    }
    onComplete();
  } catch {
    setErr("Network error. Please try again.");
  } finally {
    setBusy(false);
  }
}
```

---

### WR-02: `ShortcutSurface.finish` leaves `busy=true` permanently on network failure

**File:** `src/components/onboarding/shortcut-surface.tsx:15-23`
**Issue:** The `fetch("/api/onboarding-progress", ...)` call has no try/catch or finally. If the fetch throws, `setBusy(false)` on line 22 is never reached and `onComplete()` is never called. The user is stuck with both buttons disabled and no error message. The code comment says "best-effort" but best-effort must still recover the UI state.
**Fix:**
```typescript
async function finish() {
  setBusy(true);
  try {
    const res = await fetch("/api/onboarding-progress", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ complete_step: "shortcut_viewed" }),
    });
    await res.json().catch(() => ({}));
  } catch {
    // best-effort: swallow, still proceed
  } finally {
    setBusy(false);
  }
  onComplete();
}
```

---

### WR-03: `GymSurface.useCurrentLocation` success-callback fetch can throw without resetting `busy`

**File:** `src/components/onboarding/gym-surface.tsx:98-115`
**Issue:** Inside the `getCurrentPosition` success callback, `fetch("/api/gyms", ...)` is awaited without a try/catch or finally. If that fetch throws, `setBusy(false)` on line 110 is skipped. The error callback (line 117-120) only covers geolocation errors, not the subsequent network request. The user is left with every interactive element disabled.
**Fix:** Wrap the fetch inside the success callback with try/finally:
```typescript
async (pos) => {
  try {
    const addRes = await fetch("/api/gyms", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "My gym",
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        radius_m: 150,
      }),
    });
    const data = await addRes.json().catch(() => ({}));
    if (!addRes.ok) {
      setErr(data.error ?? "Failed to add gym.");
      return;
    }
    setCount((c) => c + 1);
  } catch {
    setErr("Network error. Try again.");
  } finally {
    setBusy(false);
  }
},
```

---

### WR-04: `GymSurface.pick` proceeds with invalid details when `/api/places/details` returns non-OK

**File:** `src/components/onboarding/gym-surface.tsx:68-75`
**Issue:** The response from `/api/places/details` is parsed unconditionally on line 69 (`const details = await detailsRes.json()`). If `detailsRes.ok` is false, `details` may contain an error payload rather than a place object. The code then falls back to `p.main_text` for `name` and `p.secondary_text` for `address`, which is the right display fallback, but `details.lat` and `details.lng` will be `undefined`. These undefined values are JSON-serialized as absent keys, causing the POST to `/api/gyms` to receive a body with no coordinates — the gym is added without location data, defeating the purpose of geo-verification. The `!addRes.ok` check on line 78 may or may not catch this depending on whether the gyms API validates lat/lng.
**Fix:**
```typescript
const detailsRes = await fetch(`/api/places/details?place_id=${p.place_id}`);
const details = detailsRes.ok ? await detailsRes.json() : {};
```
This safely degrades: `details.lat`, `details.lng`, `details.name`, and `details.address` all resolve to `undefined`, and the fallbacks to `p.main_text`/`p.secondary_text` apply. The gyms API will reject the missing-coordinates body and surface a real error rather than silently creating an unverifiable gym.

---

### WR-05: `GymSurface` debounce effect leaves `searching=true` when query is cleared mid-flight

**File:** `src/components/onboarding/gym-surface.tsx:29-62`
**Issue:** When the user types 2+ characters (the effect sets `searching=true` and schedules a timer), then clears the input before the 250 ms timer fires, the cleanup function cancels the timer via `clearTimeout`. However, `setSearching(false)` is only called inside the timeout callback (line 58), which is never executed. The result: `searching` remains `true` indefinitely, and the UI shows "Searching…" even after the input is empty.

The early-exit branch (lines 31-35) for `q.length < 2` resets `results` and `searchErr` but does NOT reset `searching`, so this case is reachable:
1. User types 3 chars → `searching=true`, timer scheduled
2. User deletes all 3 chars within 250 ms → cleanup fires, timer cancelled, `searching` stays `true`
3. "Searching…" indicator persists until the next `query` change that reaches the settled path

**Fix:** Reset `searching` in the short-circuit branch:
```typescript
if (q.length < 2) {
  setResults([]);
  setSearchErr(null);
  setSearching(false); // add this line
  return;
}
```

---

### WR-06: `isScheduleDone` returns false for a valid "no rest days" configuration

**File:** `src/lib/onboarding/completion.ts:28-30`
**Issue:** `isScheduleDone` checks `restDays.length > 0` and returns `false` for an empty array. The design comment explains the rationale: `weekly_goal` defaults to 4 so it cannot be used as a "user edited this" signal, while a fresh profile has empty `rest_days`. However, the same probe is also `false` for a user who deliberately chose zero rest days (training 7 days/week). Such a user has made a real configuration choice but will be treated as "setup not done" — the auto-skip logic would re-present the schedule step on every walkthrough replay, and the step would never be auto-skipped.

This is an inherent ambiguity in the chosen signal. The comment acknowledges this is a design decision, but it produces a genuine false-negative case: a 7-day-a-week trainer who visits the onboarding walkthrough will always see the schedule step even after explicitly confirming zero rest days.

**Fix (if a clean DB migration is acceptable):** Add a boolean `schedule_configured` column that is set to `true` on any explicit PATCH to `/api/profile` for schedule fields. This eliminates the ambiguity.

**Fix (no migration):** Alternatively, store a sentinel rest-day value (e.g., `-1`) in the array to mean "deliberately no rest days" and treat a non-empty array as configured. Update `ScheduleSurface` to inject the sentinel when the user saves with zero rest days selected. This avoids a migration at the cost of a minor encoding convention.

---

## Info

### IN-01: `searching` spinner has no timeout cap

**File:** `src/components/onboarding/gym-surface.tsx:36-60`
**Issue:** If the `/api/places/search` request hangs indefinitely (no network timeout configured on the fetch), `searching` stays `true` forever. There is no `AbortController` or `signal` with a timeout. The user sees "Searching…" with no recourse except clearing the input. This is a robustness gap rather than a strict bug, since browsers do eventually cancel stalled requests, but the UX degrades significantly on slow connections.
**Fix:** Add an `AbortController` with a timeout in the effect:
```typescript
const controller = new AbortController();
const timer = setTimeout(async () => {
  try {
    const res = await fetch(
      `/api/places/search?q=${encodeURIComponent(q)}`,
      { signal: controller.signal }
    );
    // ...
  } catch (e) {
    if ((e as { name?: string }).name === "AbortError") return;
    // ...
  }
}, 250);
return () => {
  clearTimeout(timer);
  controller.abort();
};
```

---

### IN-02: `GymOnboarding` (`gym/client.tsx`) skips the `challenge` and `money` steps in the legacy wizard

**File:** `src/app/onboarding/gym/client.tsx:11`
**Issue:** The legacy linear wizard navigates `schedule → gym → shortcut`, bypassing `/onboarding/challenge` and `/onboarding/money`. The `STEPS` registry lists `challenge` and `money` as teaching steps between `gym` and `shortcut_viewed`. If those pages exist (or are planned), the legacy flow silently skips them and a user completing onboarding through the legacy wizard will never see them, leaving `challenge` and `money` absent from `completed_steps`. `isTourComplete` would then return `false` for these users since both are in `TEACHING_KEYS`.

This may be intentional if the walkthrough covers those teaching steps and the legacy wizard is a parallel path, but it is worth confirming that `isTourComplete` is not the gate used for legacy-wizard completion — `onboarding_complete` (the profile boolean) is used instead. If that is the intended split, documenting it explicitly in the client file would prevent future regressions.
**Fix:** Add a comment clarifying that `challenge`/`money` are walkthrough-only teaching steps and are not presented in the legacy wizard flow, and that `isTourComplete` is not the gate for legacy-wizard exit.

---

_Reviewed: 2026-06-15T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
