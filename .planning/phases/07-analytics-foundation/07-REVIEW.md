---
phase: 07-analytics-foundation
reviewed: 2026-06-27T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - src/lib/analytics/events.ts
  - src/lib/analytics/events.test.ts
  - src/components/posthog-provider.tsx
  - src/components/posthog-pageview.tsx
  - src/components/posthog-identity.tsx
  - next.config.mjs
  - src/middleware.ts
  - public/sw.js
  - src/app/layout.tsx
findings:
  critical: 1
  warning: 5
  info: 3
  total: 9
status: issues_found
---

# Phase 07: Code Review Report

**Reviewed:** 2026-06-27T00:00:00Z
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

This phase introduces PostHog analytics: a typed event catalog, a provider that initializes the SDK, a pageview tracker, an identity component, Next.js rewrite rules to proxy the ingest endpoint, and a service worker pass-through. The event catalog and rewrite configuration are sound. However, there is one critical logic error that will silently break user-identity attribution for the vast majority of sessions (returning authenticated users), a structural React effect-ordering defect that drops every session's initial pageview, and several inconsistencies in how the PostHog initialization state is guarded across the three components.

---

## Critical Issues

### CR-01: `PostHogIdentity` never identifies already-authenticated users on page load

**File:** `src/components/posthog-identity.tsx:16`

**Issue:** Supabase's `onAuthStateChange` fires `INITIAL_SESSION` (not `SIGNED_IN`) when the page loads and the user is already authenticated. The handler only branches on `"SIGNED_IN"` and `"SIGNED_OUT"`, so `posthog.identify()` is never called for any user who is logged in when they navigate to or refresh the app. Every analytics event captured in those sessions is attributed to an anonymous PostHog distinct ID rather than the known user UUID. Because `SIGNED_IN` fires only during an active sign-in flow, the only users who are ever identified are those who go through login during that specific browser tab's lifetime. All returning users, all session restores after token refresh, and all page reloads for authenticated users are invisible to the identity layer — defeating the entire purpose of `PostHogIdentity`.

**Fix:**
```typescript
supabase.auth.onAuthStateChange((event, session) => {
  if (
    (event === "SIGNED_IN" || event === "INITIAL_SESSION") &&
    session?.user
  ) {
    posthog.identify(session.user.id);
  } else if (event === "SIGNED_OUT") {
    posthog.reset();
  }
});
```

---

## Warnings

### WR-01: Initial pageview silently dropped on every session

**File:** `src/components/posthog-pageview.tsx:13-15`

**Issue:** React fires child `useEffect` hooks before parent `useEffect` hooks. In the component tree, `PostHogPageview` is a child of `PostHogProvider`. This means `PostHogPageview.useEffect` (which checks `posthog.__loaded` and fires `$pageview`) runs before `PostHogProvider.useEffect` (which calls `posthog.init()`). On the initial mount, `posthog.__loaded` is always `false` when `PostHogPageview` runs, so the effect returns early. The entry page of every session is silently missing from analytics. Subsequent route changes within the SPA work correctly because posthog is already initialized by then. Only the first pageview of each session is affected, but that is precisely the most analytically significant event (landing page, referrer, entry path).

**Fix:** There are two viable approaches:

Option A — move init to module scope so it runs before any effect:
```typescript
// posthog-provider.tsx — initialize at module evaluation time, not in useEffect
if (typeof window !== "undefined" && !posthog.__loaded) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "/ingest",
    capture_pageview: false,
    autocapture: false,
    person_profiles: "identified_only",
    defaults: "2026-01-30",
  });
}
```

Option B — remove the `__loaded` guard in `PostHogPageview` and rely on PostHog's built-in call queue (which handles pre-init `capture()` calls by replaying them after init):
```typescript
// posthog-pageview.tsx — remove the guard; PostHog queues calls made before init
useEffect(() => {
  let url = window.origin + pathname;
  const qs = searchParams?.toString();
  if (qs) url += "?" + qs;
  posthog.capture("$pageview", { $current_url: url });
}, [pathname, searchParams]);
```

### WR-02: `posthog.__loaded` relies on an internal, undocumented SDK property

**File:** `src/components/posthog-provider.tsx:10`, `src/components/posthog-pageview.tsx:15`

**Issue:** The double-underscore prefix is a convention for internal/private properties in posthog-js. `__loaded` does not appear in the public API surface or the posthog-js TypeScript types. Any minor or patch release of posthog-js can rename, remove, or change the semantics of this property without it being considered a breaking change. Both the init guard in `PostHogProvider` and the pre-capture guard in `PostHogPageview` depend on it. If `__loaded` disappears in a version update, the init guard in `PostHogProvider` will stop preventing double-init (causing duplicate events), and the guard in `PostHogPageview` will always evaluate as falsy (causing all pageviews to drop).

**Fix:** Use the documented `posthog.isFeatureEnabled` or check `posthog._isInitialized` if exposed, or restructure to avoid the need for a loaded check entirely (see WR-01 Option A or B above). For the double-init guard specifically, a module-level boolean is more stable:
```typescript
// posthog-provider.tsx
let initialized = false;

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (initialized) return;
    initialized = true;
    posthog.init(...);
  }, []);
  ...
}
```

### WR-03: No runtime guard on `NEXT_PUBLIC_POSTHOG_KEY` — SDK silently receives `undefined`

**File:** `src/components/posthog-provider.tsx:12`

**Issue:** `process.env.NEXT_PUBLIC_POSTHOG_KEY!` uses a TypeScript non-null assertion, which erases the type-level `undefined` at compile time but provides no runtime protection. If this variable is not set in a deployment environment (e.g., a new preview environment or a developer's local setup missing `.env.local`), `undefined` is passed directly to `posthog.init()`. PostHog will either silently fail to authenticate, throw a runtime error in the SDK, or start queuing events that will never be flushed — all without any actionable error message.

**Fix:**
```typescript
const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
if (!posthogKey) {
  // Analytics is opt-in in environments where the key is absent.
  // Log a warning in development; skip init silently in production.
  if (process.env.NODE_ENV === "development") {
    console.warn("[PostHog] NEXT_PUBLIC_POSTHOG_KEY is not set — analytics disabled.");
  }
  return;
}
posthog.init(posthogKey, { ... });
```

### WR-04: `PostHogIdentity` calls `posthog.identify()` / `posthog.reset()` without checking init state

**File:** `src/components/posthog-identity.tsx:18-20`

**Issue:** Unlike `PostHogPageview` (which guards on `posthog.__loaded`), `PostHogIdentity` calls `posthog.identify()` and `posthog.reset()` with no initialization check. Because child effects fire before parent effects (see WR-01), the auth subscription is established and may fire its callback before `posthog.init()` has been called. PostHog's JS SDK does internally queue pre-init calls for some methods, but this is not a documented guarantee for `identify()` and `reset()`. This is also inconsistent with the defensive pattern used in the sibling component.

**Fix:** Either add the same guard used in `PostHogPageview`, or — better — address this architecturally by moving posthog init to module scope (WR-01 Option A), which eliminates the race for all three components simultaneously.

```typescript
// Quick fix — add guard consistent with PostHogPageview
if (event === "SIGNED_IN" && session?.user) {
  if (posthog.__loaded) posthog.identify(session.user.id);
} else if (event === "SIGNED_OUT") {
  if (posthog.__loaded) posthog.reset();
}
```

### WR-05: `client.focus()` rejection bypasses `openWindow` fallback in service worker

**File:** `public/sw.js:54-59`

**Issue:** In the `notificationclick` handler, `client.focus()` is called inside the `for` loop but outside the `try/catch` block that wraps `new URL(client.url)`. If `client.focus()` rejects (which can happen if the client is already being closed, or if the browser denies the focus request), the promise returned from the `.then()` chain rejects. This rejection is passed back through `event.waitUntil()`, and the `return self.clients.openWindow(target)` line on line 65 is never reached. The result is that the user's notification click closes the notification banner but navigates nowhere.

**Fix:**
```javascript
for (const client of clientList) {
  try {
    const url = new URL(client.url);
    if (url.origin === self.location.origin) {
      return client.focus().then((focused) => {
        if ("navigate" in focused) {
          return focused.navigate(target);
        }
        return focused;
      }).catch(() => self.clients.openWindow(target)); // fallback on focus failure
    }
  } catch (e) {
    // ignore URL parse errors
  }
}
return self.clients.openWindow(target);
```

---

## Info

### IN-01: Brittle event count assertion creates maintenance friction

**File:** `src/lib/analytics/events.test.ts:34`

**Issue:** `expect(Object.keys(EVENT).length).toBe(14)` will fail every time a new event is added to `events.ts`. The uniqueness test on line 13 (`unique.size === values.length`) already catches the only real invariant this count test is trying to protect against (duplicate values). The count test adds no safety not already covered and creates a manual update burden.

**Fix:** Remove the count assertion. The uniqueness and format tests are sufficient:
```typescript
// Remove this test block entirely:
// it("EVENT has exactly 14 entries", () => {
//   expect(Object.keys(EVENT).length).toBe(14);
// });
```

### IN-02: Test regex permits leading/trailing underscores in event name segments

**File:** `src/lib/analytics/events.test.ts:9`

**Issue:** The regex `/^[a-z_]+:[a-z_]+$/` validates the event name format but accepts values like `"_:_"`, `"_foo:bar"`, or `"foo:bar_"`. The naming convention says "lowercase, underscores between words," which implies each segment must start and end with a letter.

**Fix:**
```typescript
// Tighter regex: each segment starts and ends with a letter; underscores only between letters
expect(value).toMatch(/^[a-z][a-z_]*[a-z]:[a-z][a-z_]*[a-z]$|^[a-z]:[a-z]$/);
// Or simpler: require no leading/trailing underscores
expect(value).toMatch(/^[a-z][a-z_]*:[a-z][a-z_]*$/);
```

### IN-03: `window.origin` used instead of canonical `window.location.origin`

**File:** `src/components/posthog-pageview.tsx:17`

**Issue:** `window.origin` and `window.location.origin` are equivalent in the browser `Window` context. However, `window.location.origin` is the canonical property for the current document's origin and is what PostHog's own documentation examples use. `window.origin` inherits through the global scope and is less immediately self-documenting.

**Fix:**
```typescript
let url = window.location.origin + pathname;
```

---

_Reviewed: 2026-06-27T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
