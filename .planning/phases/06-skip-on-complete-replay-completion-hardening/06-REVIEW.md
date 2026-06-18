---
phase: "06"
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
  critical: 1
  warning: 3
  info: 2
  total: 6
status: issues_found
---

# Code Review: Phase 06

**Reviewed:** 2026-06-19T00:00:00Z
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

Reviewed 12 files covering skip-on-complete probe wiring, the `replay` signal,
replay-from-settings, and the "Pact is live" one-shot overlay. The domain logic
(`onboarding-progress.ts`, `current-step.ts`, `completion.ts`, `pact-live.ts`) is
clean and well-tested; the Zod schema is correctly strict. One critical bug found:
`ReplayTourButton.replay()` permanently locks the button in a disabled state on any
network error because `setBusy(false)` is never reached when `fetch()` throws.
Three warnings cover a timer leak in the password-change dialog, a post-dismiss
rendering inconsistency in `PactLiveOverlay`, and a silently swallowed Supabase
error that degrades the skip-on-complete experience. Two info items call out a
duplicated `isAutoUsername` function and a missing test for a documented
`replay`+`dismissed` precedence edge case.

---

## Critical Issues

### CR-001: `ReplayTourButton.replay()` permanently locks busy state on network error

**Severity:** Critical
**File:** `src/app/(tabs)/settings/client.tsx:164-180`

**Issue:** `setBusy(true)` is set at line 167 before the bare `await fetch(...)` at
line 168. If `fetch()` throws (network down, DNS failure, connection refused),
execution jumps out of the function without ever reaching `setBusy(false)` at line
173. The Replay Tour button is permanently stuck `disabled` for the rest of the
session. The only recovery is a full page reload.

The `NotifyToggle` and `PeriodReminderToggle` functions in the same file handle
this correctly via optimistic revert on `!res.ok` but also lack try/catch —
however those functions would equally lock `busy` on a throw. The `ReplayTourButton`
is the most user-visible instance because the error state from the throw is also
not surfaced to the user (no `setErr` call in the throw path).

**Fix:** Wrap the fetch in try/finally to guarantee `setBusy` is always cleared:

```ts
async function replay() {
  if (busy) return;
  setErr(null);
  setBusy(true);
  try {
    const res = await fetch("/api/onboarding-progress", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ replay: true }),
    });
    if (!res.ok) {
      setErr("Couldn't restart the tour. Try again.");
      return;
    }
    startTransition(() => router.refresh());
  } catch {
    setErr("Couldn't restart the tour. Try again.");
  } finally {
    setBusy(false);
  }
}
```

---

## Warnings

### WR-001: `ChangePasswordButton` timer not cancelled on unmount — state update after unmount

**Severity:** Warning
**File:** `src/app/(tabs)/settings/client.tsx:254`

**Issue:** After a successful password update, `window.setTimeout(close, 2000)` is
scheduled with no cleanup. If the user navigates away from Settings within those
2 seconds the timer fires against an unmounted component, calling `setOpen`,
`setNewPassword`, `setConfirm`, `setErr`, `setSuccess`, and `setBusy` on stale
state. React 18 no longer throws on unmounted updates, but it produces dev-mode
warnings and is a real resource leak. Additionally, using `window.setTimeout` when
`setTimeout` (the global, available in both Node.js and browsers) is sufficient is
unnecessary.

**Fix:**

```ts
// Add inside ChangePasswordButton:
const autoCloseRef = useRef<ReturnType<typeof setTimeout> | null>(null);

useEffect(() => {
  return () => {
    if (autoCloseRef.current !== null) clearTimeout(autoCloseRef.current);
  };
}, []);

// In close() / reset(), cancel the timer:
function reset() {
  if (autoCloseRef.current !== null) {
    clearTimeout(autoCloseRef.current);
    autoCloseRef.current = null;
  }
  setNewPassword("");
  setConfirm("");
  setErr(null);
  setSuccess(false);
  setBusy(false);
}

// In submit(), replace window.setTimeout:
autoCloseRef.current = setTimeout(close, 2000);
```

---

### WR-002: `PactLiveOverlay` post-dismiss rendering inconsistency — Dialog remains in tree with `open=false` indefinitely

**Severity:** Warning
**File:** `src/components/pact-live-overlay.tsx:39-68`

**Issue:** After `dismiss()` calls `setOpen(false)` and fires the fetch, the
early-return guard at line 67 re-evaluates `shouldShowPactLive(...)`. Because the
server-side `completedSteps` prop has not been updated (the fetch is fire-and-forget
with no `router.refresh()`), `shouldShowPactLive` still returns `true`. The
component does NOT return `null` — the `DialogPrimitive.Root` stays in the React
tree with `open={false}`.

Practical consequence: Radix Dialog continues listening for keyboard events
(Escape) and calling `onOpenChange(false)` → `dismiss()` → `persistedRef` guards
the double-write, but the state calls (`setOpen(false)`) run again unnecessarily.
If the parent ever re-renders with the same props (e.g. from `RefreshOnFocus`),
the `useEffect` at line 40-44 will re-evaluate and set `open=true` again, briefly
re-opening the already-dismissed overlay because `completedSteps` still does not
contain `pact_live_seen`.

**Fix:** Introduce a local `seenLocally` flag that gates both the effect and the
guard immediately on dismiss, without waiting for a server round trip:

```tsx
const [seenLocally, setSeenLocally] = useState(false);

function dismiss() {
  setOpen(false);
  setSeenLocally(true);
  persistSeen();
}

useEffect(() => {
  if (seenLocally) return;
  setOpen(shouldShowPactLive({ mounted, hasActiveChallenge, completedSteps }));
}, [mounted, hasActiveChallenge, completedSteps, seenLocally]);

// Guard:
if (seenLocally || !shouldShowPactLive({ mounted, hasActiveChallenge, completedSteps })) {
  return null;
}
```

---

### WR-003: Supabase `user_gyms` error silently swallowed — DB failure degrades skip-on-complete with no log

**Severity:** Warning
**File:** `src/app/(tabs)/layout.tsx:76-80`

**Issue:** The `user_gyms` count query destructures only `{ data: gyms }` and drops
the `error` field. If the query fails, `gyms` is `null`, `gymCount` becomes `0`,
and `isGymDone` returns `false`. The gym step is NOT auto-skipped for a user who
has already set up a gym — the tour incorrectly opens on the gym step and prompts
the user to add a gym they already added. There is no server log for the failure,
making this invisible to operators.

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

The graceful fallback (`gymCount=0`) is preserved; the error is now observable.

---

## Info

### IN-001: `isAutoUsername` duplicated across two files — one edit, one miss

**Severity:** Info
**File:** `src/app/(tabs)/layout.tsx:13-15` and `src/app/onboarding/username/page.tsx:10-12`

**Issue:** `isAutoUsername` and its regex `/^user_[a-f0-9]{8}$/` are defined
identically in both files. The comment in `layout.tsx` line 11 acknowledges this
is a copy and states "one definition, one regex" as the goal — but two definitions
exist. If the auto-username format changes (e.g., longer hex, different prefix),
one copy will be missed, causing the layout gate and the page gate to disagree:
the layout could admit a still-auto user while the page-level check catches them
(or vice versa), breaking the single-gate invariant described in the D-01/D-03
comments.

**Fix:** Extract to a shared module:

```ts
// src/lib/onboarding/username.ts
export const AUTO_USERNAME_RE = /^user_[a-f0-9]{8}$/;
export function isAutoUsername(u: string | null): boolean {
  return !u || AUTO_USERNAME_RE.test(u);
}
```

Import from both `layout.tsx` and `username/page.tsx`.

---

### IN-002: No test for `replay: true` + `dismissed: true` combination in the same patch

**Severity:** Info
**File:** `src/lib/onboarding-progress.test.ts` (gap) / `src/lib/onboarding-progress.ts:90-94`

**Issue:** `mergeProgress` documents that `replay` takes precedence over an explicit
`dismissed` field in the same patch ("Replay takes precedence over an explicit
`dismissed` in the same patch"). The `PatchBody` schema permits `{ replay: true,
dismissed: true }` (the test at line 100 covers `{ replay: true, complete_step }`,
not `{ replay: true, dismissed: true }`). The precedence rule is therefore
implemented but not tested — a future refactor of the ternary at lines 90-94 could
silently break the contract.

**Fix:** Add one test case to `onboarding-progress.test.ts`:

```ts
it("replay wins over explicit dismissed:true in the same patch (D-04)", () => {
  const merged = mergeProgress(
    blankRow({ dismissed: false }),
    { replay: true, dismissed: true }
  );
  // replay forces false; explicit dismissed:true is ignored
  expect(merged.dismissed).toBe(false);
});
```

---

_Reviewed: 2026-06-19T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
