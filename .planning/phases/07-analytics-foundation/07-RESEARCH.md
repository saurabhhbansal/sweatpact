# Phase 7: Analytics Foundation - Research

**Researched:** 2026-06-20
**Domain:** PostHog SDK integration, Next.js App Router instrumentation, reverse proxy, Node.js runtime upgrade
**Confidence:** MEDIUM

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
All implementation choices are at Claude's discretion — pure infrastructure/setup phase. Use REQUIREMENTS.md FOUND-01 through FOUND-05 as the authoritative spec. All file paths, naming conventions, and configuration details are already specified there.

Key decisions deferred to planner:
- Where exactly `identify()` is called (client-side auth state listener vs server-confirmed login path)
- Dev/test mode handling (whether to disable PostHog in non-production)
- Node 20.20+ upgrade mechanism (`.nvmrc`, `package.json` engines, `vercel.json`)
- Service worker bypass implementation for `/ingest` path in PWA manifest or sw.js

### Claude's Discretion
Everything — this is a pure infrastructure phase with no user-driven tradeoffs.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FOUND-01 | PostHog JS SDK initialized in `instrumentation-client.ts` with `capture_pageview: false` and autocapture off; manual `$pageview` fired on route change from a `PostHogPageview` client component in root layout | PostHog Next.js docs: `instrumentation-client.ts` init pattern; `PostHogPageview` with `usePathname` + `useEffect` |
| FOUND-02 | `identify()` called on login with Supabase user ID so all subsequent events are attributed to the correct user | `posthog.identify(userId)` called in client component; Supabase `onAuthStateChange` or after confirmed login |
| FOUND-03 | Typed event catalog in `src/lib/analytics/events.ts` defines all event names as constants with `category:object_action` naming convention before any events are written | TypeScript const object pattern; no external library needed |
| FOUND-04 | PostHog ingestion reverse-proxied through `/ingest` rewrites in `next.config.mjs`; `/ingest` excluded from middleware matcher; PWA service worker bypasses the proxy path | Next.js `async rewrites()` with ordered rules; middleware matcher regex update; SW fetch event passthrough |
| FOUND-05 | Vercel Node.js runtime upgraded to 20.20+ to satisfy `posthog-node@5` peer dependency | `package.json` `engines.node: "20.x"` — Vercel auto-maintains latest 20.x patch |
</phase_requirements>

---

## Summary

Phase 7 wires PostHog into the SweatPact Next.js 14 App Router app. The five requirements are all configuration/infrastructure: SDK init, user attribution, a typed event catalog, a first-party reverse proxy, and a Node.js runtime bump for the server-side SDK.

The client-side SDK (`posthog-js@1.391.2`) is initialized in a `PostHogProvider` client component (`src/components/posthog-provider.tsx`) using `useEffect` — NOT via `instrumentation-client.ts`, which is a Next.js 15.3+ feature unavailable in this project's Next.js 14.2.35 [CITED: nextjs.org/blog/next-15-3]. The CONTEXT.md references `instrumentation-client.ts` by name (following PostHog docs language), but the correct substitute for Next.js 14 is the `providers.tsx` pattern. Init options: `capture_pageview: false`, `autocapture: false`, `person_profiles: "identified_only"`. A dedicated `PostHogPageview` client component fires `$pageview` manually on every route change using `usePathname` + `useEffect`. This component must be wrapped in a `<Suspense>` boundary because `useSearchParams()` (used to append query strings to the `$current_url` property) causes static-generation bailout in Next.js App Router if unwrapped.

The server-side SDK (`posthog-node@5.38.2`) is used in Phase 8 API routes. Its peer dependency `^20.20.0 || >=22.22.0` is satisfied by adding `"engines": { "node": "20.x" }` to `package.json` — Vercel maintains the latest 20.x patch release automatically, and as of 2026 that is comfortably above 20.20.

The `/ingest` reverse proxy is three ordered rewrites in `next.config.mjs`: a `static` rule, an `array` rule, and a catch-all — all pointing at `https://us.i.posthog.com` (or `eu` for EU instances). The middleware matcher already excludes `api/checkin` and `api/cron`; adding `/ingest` to the exclusion pattern prevents the session-cookie refresh from running on proxy requests. The existing service worker (`public/sw.js`) handles only push notifications with no fetch interception; a `fetch` event listener guarding the `/ingest` prefix must be added to let those requests flow directly to the network.

**Primary recommendation:** Follow the three-file split: `instrumentation-client.ts` (SDK init), `src/components/posthog-pageview.tsx` (route-change capture), `src/lib/analytics/events.ts` (typed catalog). Wire them into the root layout with a `<Suspense>` boundary around the pageview component.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| SDK init (posthog-js) | Browser / Client | — | `instrumentation-client.ts` runs in browser context; PostHog is a client-side singleton |
| Manual `$pageview` capture | Browser / Client | — | Requires `usePathname`/`useEffect` — client-only hooks |
| User identify() | Browser / Client | — | Called after auth state confirmed on client; Supabase `onAuthStateChange` is browser API |
| Typed event catalog | N/A (pure TypeScript) | — | `src/lib/analytics/events.ts` is a zero-runtime module; constants used everywhere |
| `/ingest` reverse proxy | Frontend Server (SSR) | CDN / Static | Next.js rewrites evaluated at the edge/server before hitting the browser |
| Middleware exclusion | Frontend Server (SSR) | — | `src/middleware.ts` matcher config — server-side route evaluation |
| SW bypass for `/ingest` | Browser / Client | — | Service worker runs in browser; fetch event handler intercepts requests before they leave device |
| Node.js runtime upgrade | API / Backend | — | `posthog-node` runs in Vercel Functions (server); `package.json` engines pins version |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `posthog-js` | 1.391.2 | Client-side event capture, identify, pageview | Official PostHog browser SDK; 8M weekly downloads [VERIFIED: npm registry] |
| `posthog-node` | 5.38.2 | Server-side event capture for API routes (Phase 8 onwards) | Official PostHog Node SDK; required for `posthog-node@5` peer dep compliance (FOUND-05) [VERIFIED: npm registry] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `posthog-js/react` | (sub-path of posthog-js) | `PostHogProvider` and `usePostHog` hook | Needed only if React context-based access to posthog instance is required for child components |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `instrumentation-client.ts` init | `providers.tsx` client component with `useEffect` init | `instrumentation-client.ts` is the current PostHog-recommended approach for Next.js 15.3+; no re-render on init; values fixed for session |
| Manual `PostHogPageview` component | `posthog-js` `capture_pageview: true` | Default fires only once at SDK init — every subsequent client navigation is invisible; manual is required for App Router |
| `posthog-js/react` `PostHogProvider` | Direct import of `posthog` singleton | Provider pattern enables `usePostHog()` in child components; either works; provider adds marginal complexity for this phase |

**Installation:**
```bash
npm install posthog-js posthog-node
```

**Version verification:**
```bash
npm view posthog-js version    # 1.391.2 as of 2026-06-20
npm view posthog-node version  # 5.38.2 as of 2026-06-20
npm view posthog-node engines  # { node: '^20.20.0 || >=22.22.0' }
```

---

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `posthog-js` | npm | 6+ yrs (org, latest version published 2026-06-19) | 8,035,051/wk | github.com/PostHog/posthog-js | SUS (flagged: latest version too-new) | Approved — legitimate PostHog SDK; seam flags latest patch released 2026-06-19; org and repo confirmed |
| `posthog-node` | npm | 6+ yrs (org, latest version published 2026-06-19) | 6,611,914/wk | github.com/PostHog/posthog-js | SUS (flagged: latest version too-new) | Approved — same org as posthog-js; peer dep engine requirement confirmed via npm view |

**Packages removed due to [SLOP] verdict:** none

**Packages flagged as suspicious [SUS]:** `posthog-js`, `posthog-node` — verdict is triggered by very-recent publish date of the latest version (2026-06-19), not by any organic suspicion. Both packages have millions of weekly downloads, an established GitHub org (PostHog), and no postinstall scripts. No human-verify checkpoint needed; approve with the note above.

---

## Architecture Patterns

### System Architecture Diagram

```
Browser                    Next.js Server              PostHog Cloud
  │                              │                           │
  │  route change                │                           │
  ├─ PostHogPageview.useEffect ──┤                           │
  │  posthog.capture('$pageview')│                           │
  │                              │                           │
  │  POST /ingest/e/             │                           │
  ├──────────────────────────────┤                           │
  │  (next.config.mjs rewrite)   │  proxy to us.i.posthog   │
  │                              ├───────────────────────────►
  │                              │  200 OK                   │
  │                              ◄───────────────────────────┤
  │  200 OK                      │                           │
  ◄──────────────────────────────┤                           │
  │                              │                           │
  │  SW fetch event              │                           │
  │  url.startsWith('/ingest')   │                           │
  │  → return fetch(event.req)   │  (no SW interception)     │
  │  (bypass service worker)     │                           │
```

```
Auth flow (FOUND-02):
  Supabase onAuthStateChange
    │ SIGNED_IN event
    └─ posthog.identify(session.user.id)
         │ all subsequent events attributed to Supabase UUID
```

### Recommended Project Structure

```
src/
├── lib/
│   └── analytics/
│       └── events.ts              # Typed event constants (FOUND-03)
├── components/
│   ├── posthog-provider.tsx       # SDK init + PostHogProvider wrapper (FOUND-01)
│   └── posthog-pageview.tsx       # PostHogPageview client component (FOUND-01)
├── app/
│   └── layout.tsx                 # Add PostHogProvider + PostHogPageview + Suspense (modified)
public/
└── sw.js                          # Add /ingest fetch bypass (FOUND-04)
next.config.mjs                    # Add rewrites + skipTrailingSlashRedirect (FOUND-04)
src/middleware.ts                  # Add /ingest to exclusion matcher (FOUND-04)
package.json                       # Add engines.node: "20.x" (FOUND-05)
```

**Note:** `instrumentation-client.ts` is NOT used here because Next.js 14 does not support client-side instrumentation files. The `posthog-provider.tsx` component pattern achieves the same result. [CITED: nextjs.org/blog/next-15-3]

### Pattern 1: PostHog SDK Init — `instrumentation-client.ts` vs `providers.tsx`

**Critical version note:** `instrumentation-client.ts` (client-side instrumentation) was introduced in **Next.js 15.3**. This project uses **Next.js 14.2.35**. The file will be silently ignored on Next.js 14. [CITED: nextjs.org/blog/next-15-3, github.com/vercel/next.js/discussions/69294]

**For Next.js 14 (this project): use the `providers.tsx` client component pattern instead.**

The CONTEXT.md specifies `instrumentation-client.ts` by name (following PostHog docs language), but the underlying requirement is that PostHog is initialized before any event capture. The `providers.tsx` pattern achieves the same goal on Next.js 14.

**What:** Initialize the PostHog client once for the browser session with autocapture and automatic pageview disabled.

**When to use:** Mount `PostHogProvider` in root layout — wraps the entire tree so posthog is available everywhere.

```tsx
// Source: posthog.com/docs/libraries/next-js + reetesh.in/blog pattern (CITED)
// File: src/components/posthog-provider.tsx
"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { useEffect } from "react";

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (posthog.__loaded) return;   // idempotent — safe in StrictMode double-invoke
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "/ingest",
      capture_pageview: false,       // REQUIRED: default fires once only — unusable for SPA
      autocapture: false,            // REQUIRED: typed catalog is the correct approach
      person_profiles: "identified_only",  // no anonymous profiles until identify() is called
      defaults: "2026-01-30",
    });
  }, []);

  return <PHProvider client={posthog}>{children}</PHProvider>;
}
```

**Root layout integration:**
```tsx
// src/app/layout.tsx (modified)
import { PostHogProvider } from "@/components/posthog-provider";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <PostHogProvider>
        <body className="min-h-screen">
          <Suspense fallback={null}><PostHogPageview /></Suspense>
          <SplashScreen />
          <InstallGate>{children}</InstallGate>
          <div id="tour-root" />
        </body>
      </PostHogProvider>
    </html>
  );
}
```

**Note on file name:** The CONTEXT.md and REQUIREMENTS.md reference `instrumentation-client.ts` — this is because PostHog docs use that name for Next.js 15+. For Next.js 14, name the file `src/components/posthog-provider.tsx` and plan tasks accordingly. The planner should document this substitution clearly.

**Environment variables required:**
```
NEXT_PUBLIC_POSTHOG_KEY=phc_xxxx
NEXT_PUBLIC_POSTHOG_HOST=/ingest   # points to local reverse proxy
```

### Pattern 2: Manual `$pageview` Capture (`PostHogPageview` component)

**What:** Client component that fires `$pageview` on every route change in the App Router.

**When to use:** Mounted once in root layout. The `<Suspense>` boundary is required.

```tsx
// Source: posthog.com/docs/libraries/next-js + twenty1-media.com/blog (CITED)
// File: src/components/posthog-pageview.tsx
"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import posthog from "posthog-js";

export function PostHogPageview() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!posthog.__loaded) return;
    let url = window.origin + pathname;
    const qs = searchParams?.toString();
    if (qs) url += `?${qs}`;
    posthog.capture("$pageview", { $current_url: url });
  }, [pathname, searchParams]);

  return null;
}
```

**Root layout integration:**
```tsx
// File: src/app/layout.tsx  (modified)
import { Suspense } from "react";
import { PostHogPageview } from "@/components/posthog-pageview";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <Suspense fallback={null}>
          <PostHogPageview />
        </Suspense>
        <SplashScreen />
        <InstallGate>{children}</InstallGate>
        <div id="tour-root" />
      </body>
    </html>
  );
}
```

### Pattern 3: User Identification (`identify()`)

**What:** Attribute all events to the authenticated Supabase user ID.

**When to use:** Once per auth state change to SIGNED_IN. Best placed in a client component that subscribes to `supabase.auth.onAuthStateChange`.

```tsx
// Source: posthog.com/docs/libraries/next-js identify section (CITED)
// Pattern: inside a client component (e.g., src/components/posthog-identity.tsx)
"use client";

import { useEffect } from "react";
import posthog from "posthog-js";
import { createClient } from "@/lib/supabase/browser";

export function PostHogIdentity() {
  useEffect(() => {
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_IN" && session?.user) {
          posthog.identify(session.user.id);
        }
        if (event === "SIGNED_OUT") {
          posthog.reset();
        }
      }
    );
    return () => subscription.unsubscribe();
  }, []);
  return null;
}
```

**Alternative:** Call `posthog.identify(userId)` at the top of any "authenticated" client component when `user` is already available from a hook. The `onAuthStateChange` approach ensures identify fires even on page refresh when the session is restored from the cookie.

### Pattern 4: Typed Event Catalog (`events.ts`)

**What:** All event names as TypeScript constants. Prevents typos, enables IDE autocomplete, enforces naming convention.

**When to use:** Import from this module whenever calling `posthog.capture(EVENT.xxx)`.

```typescript
// File: src/lib/analytics/events.ts
// Source: project CLAUDE.md conventions + REQUIREMENTS.md FOUND-03 (CITED)

// Naming convention: category:object_action
// category = feature area, object = noun, action = past-tense verb

export const EVENT = {
  // Onboarding
  ONBOARDING_STEP_COMPLETED: "onboarding:step_completed",
  ONBOARDING_WALKTHROUGH_COMPLETED: "onboarding:walkthrough_completed",

  // Check-in
  CHECKIN_SUBMITTED: "checkin:submitted",
  CHECKIN_VERIFIED: "checkin:verified",
  CHECKIN_GEO_FAILED: "checkin:geo_failed",

  // Pact lifecycle
  PACT_CREATED: "pact:created",
  PACT_INVITE_ACCEPTED: "pact:invite_accepted",
  PACT_INVITE_DECLINED: "pact:invite_declined",
  PACT_MEMBER_LEFT: "pact:member_left",

  // Financial
  FINANCIAL_PENALTY_ISSUED: "financial:penalty_issued",
  FINANCIAL_SETTLEMENT_RECORDED: "financial:settlement_recorded",

  // Feature usage (client-side, Phase 8)
  FEATURE_TAB_VISITED: "feature:tab_visited",
  FEATURE_NOTIFICATION_CTR: "feature:notification_clicked",
  FEATURE_SHORTCUT_SETUP_VIEWED: "feature:shortcut_setup_viewed",
} as const;

export type EventName = (typeof EVENT)[keyof typeof EVENT];
```

### Pattern 5: `/ingest` Reverse Proxy in `next.config.mjs`

**What:** Route all PostHog requests through the Next.js server to bypass ad blockers and tracking blockers.

**When to use:** Production always. The ordering of the three rules is mandatory.

```javascript
// Source: posthog.com/docs/advanced/proxy/nextjs (CITED)
// File: next.config.mjs
const nextConfig = {
  reactStrictMode: true,
  skipTrailingSlashRedirect: true,  // PostHog API uses trailing slashes (e.g. /e/)
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/array/:path*",
        destination: "https://us-assets.i.posthog.com/array/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
    ];
  },
  async redirects() {
    return [
      { source: "/group", destination: "/groups", permanent: true },
    ];
  },
};
```

**EU region:** Replace `us.i.posthog.com` with `eu.i.posthog.com` and `us-assets.i.posthog.com` with `eu-assets.i.posthog.com`.

### Pattern 6: Middleware Exclusion for `/ingest`

**What:** Exclude the proxy path from the middleware matcher so the session-cookie refresh does not run on PostHog proxy requests.

**When to use:** Required alongside the reverse proxy.

```typescript
// File: src/middleware.ts (modified)
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/checkin|api/cron|ingest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

Note: The existing pattern omits the leading `/` for `api/checkin` — follow the same style for `ingest` (no leading slash).

### Pattern 7: Service Worker Bypass for `/ingest`

**What:** Add a fetch event handler to `public/sw.js` that passes `/ingest` requests directly to the network without SW interception.

**When to use:** Required because the SW registers for `scope: "/"` and would otherwise intercept proxy requests.

```javascript
// File: public/sw.js (modified — add before the existing push/notificationclick handlers)
// Source: MDN ServiceWorkerGlobalScope fetch event (CITED)
self.addEventListener("fetch", (event) => {
  // Pass PostHog ingest proxy requests directly to the network.
  // The SW must not cache or intercept analytics traffic.
  if (event.request.url.includes("/ingest/")) {
    event.respondWith(fetch(event.request));
  }
  // All other requests fall through to browser default (no respondWith = no interception).
});
```

**Why not a no-op fetch listener?** The existing SW has no `fetch` event listener at all, which means the browser falls through to the network by default. Adding the conditional `event.respondWith` only for `/ingest/` is the minimal safe change. Calling `event.respondWith` without a condition would intercept all requests.

### Pattern 8: Node.js Runtime Upgrade for `posthog-node@5`

**What:** Declare `engines.node` in `package.json` so Vercel deploys with Node 20.x (which includes 20.20+).

**When to use:** Required before installing `posthog-node@5` — it will fail at runtime on Node 18.

```json
// File: package.json (add to root object)
{
  "engines": {
    "node": "20.x"
  }
}
```

**How Vercel resolves this:** Vercel maps `"20.x"` to the latest available Node 20.x patch. As of 2026-06-20, Vercel's latest Node 20.x is above 20.20.0 [CITED: vercel.com/docs/functions/runtimes/node-js/node-js-versions]. Patch updates are applied automatically by Vercel when security patches are released.

**Alternative:** Use `"22.x"` or `"24.x"` — both satisfy `posthog-node@5`'s `>=22.22.0` track. However, `20.x` is the minimum required and is most conservative.

### Anti-Patterns to Avoid

- **Using `instrumentation-client.ts` on Next.js 14:** This file is only loaded by Next.js 15.3+. On Next.js 14 it is silently ignored — PostHog never initializes. Use `src/components/posthog-provider.tsx` with `useEffect`. [CITED: nextjs.org/blog/next-15-3]
- **`capture_pageview: true` (default) in App Router:** The default fires one pageview on SDK init, then stops. Every client-side navigation is invisible in PostHog. Always set `capture_pageview: false` and use the manual component. [CITED: posthog.com twenty1-media.com/blog article]
- **`useSearchParams` without `<Suspense>`:** Next.js App Router throws a build-time error if `useSearchParams()` is called outside a Suspense boundary in a statically-rendered route. The `PostHogPageview` component always needs `<Suspense fallback={null}>` in the root layout. [CITED: dev.to PostHog Suspense gotcha article]
- **`posthog.__loaded` guard omitted:** If `posthog.capture` is called before `posthog.init` completes (possible during React StrictMode double-invoke), events are silently dropped. Guard with `if (!posthog.__loaded) return;`.
- **Single PostHog node singleton across requests:** In Next.js API routes, a module-level singleton is reused across concurrent requests. Preferred pattern for Phase 8: instantiate per-request with `flushAt: 1, flushInterval: 0` and call `await posthog.shutdown()` after each route handler.
- **SW fetch listener without condition:** Adding a bare `self.addEventListener("fetch", (event) => { event.respondWith(fetch(event.request)); })` intercepts ALL requests including navigation and static assets, potentially breaking offline behavior or caching. Only intercept `/ingest/`.
- **`skipTrailingSlashRedirect` omitted:** PostHog's endpoints use trailing slashes (`/e/`, `/decide/`). Without `skipTrailingSlashRedirect: true`, Next.js strips the slash before the rewrite runs, causing 404s.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Analytics event batching | Custom queue + flush logic | `posthog-js` built-in | PostHog SDK handles retry, batching, queue persistence across tabs |
| First-party proxy | Custom Express/edge proxy | Next.js `async rewrites()` | Rewrites run at the edge with zero extra latency; no custom server needed |
| User identity stitching | Custom session table | `posthog.identify(userId)` | PostHog handles anonymous → identified person merge server-side |
| Event name validation | Runtime string checks | TypeScript `as const` object | Zero-runtime, IDE autocomplete, refactor-safe |
| Pageview deduplication | Rate limiting / guards | PostHog deduplicates by `$current_url` server-side | No client-side dedup needed |

**Key insight:** PostHog is designed to handle everything around batching, retries, identity stitching, and deduplication. The integration surface is thin: init once, identify on login, capture named events. Build nothing in the analytics layer that PostHog already provides.

---

## Common Pitfalls

### Pitfall 1: `capture_pageview: true` silences SPA navigation

**What goes wrong:** The default PostHog init fires one `$pageview` at SDK load time. Every subsequent client-side route change is invisible in PostHog — the user appears to visit only the landing page.

**Why it happens:** `capture_pageview: true` uses a one-shot init-time capture, not a history listener. App Router navigation does not trigger page reload.

**How to avoid:** Set `capture_pageview: false` in `instrumentation-client.ts` and mount `PostHogPageview` in root layout.

**Warning signs:** PostHog shows all users landing on `/` with 100% single-page session rate.

### Pitfall 2: `useSearchParams` without Suspense causes build error

**What goes wrong:** `next build` throws: `useSearchParams() should be wrapped in a suspense boundary at page "..."`.

**Why it happens:** Next.js App Router's static generation reads search params at build time; without a Suspense boundary the page can't be statically rendered.

**How to avoid:** Always wrap `<PostHogPageview />` in `<Suspense fallback={null}>` in the root layout.

**Warning signs:** Build fails in CI even though dev mode works fine.

### Pitfall 3: `skipTrailingSlashRedirect` omitted causes 404s on ingest

**What goes wrong:** `POST /ingest/e/` is received by the Next.js rewrite, but Next.js strips the trailing slash before evaluating rewrites — the request arrives at PostHog as `/e` (no slash) which returns 404.

**Why it happens:** Next.js default behavior normalizes trailing slashes. PostHog API endpoints require them.

**How to avoid:** Set `skipTrailingSlashRedirect: true` in `next.config.mjs` alongside the rewrites.

**Warning signs:** Events fail silently; PostHog receives no data; network tab shows 404 on `/ingest/e`.

### Pitfall 4: SW intercepts `/ingest` requests

**What goes wrong:** The service worker catches `/ingest` fetch requests. Without a fetch handler or with a caching handler, the request is served from SW cache (stale or empty) instead of reaching the PostHog proxy.

**Why it happens:** The SW scope is `/` — it intercepts all same-origin requests by default when a `fetch` event listener is registered.

**How to avoid:** Add `if (event.request.url.includes("/ingest/")) { event.respondWith(fetch(event.request)); }` as the first check in the SW fetch handler. The existing `public/sw.js` has no fetch listener — adding one requires the `/ingest` bypass guard.

**Warning signs:** Events are missing in PostHog for users who have the PWA installed; non-PWA browser shows events correctly.

### Pitfall 5: `posthog-node@5` fails on Node 18 (Vercel default)

**What goes wrong:** `posthog-node@5` throws at import time on Node 18 — it uses `fetch` natively (available only in Node 18+ but with caveats) and async patterns that assume the `^20.20.0` engine.

**Why it happens:** The package declares `engines: { node: "^20.20.0 || >=22.22.0" }` but npm does not enforce this at install time — it only warns. The failure happens at runtime.

**How to avoid:** Add `"engines": { "node": "20.x" }` to `package.json` before installing `posthog-node`. Vercel reads this field and deploys the correct runtime.

**Warning signs:** API routes using posthog-node throw `TypeError` or `SyntaxError` on Vercel cold start; local dev (Node 25.x) works fine.

### Pitfall 6: `identify()` never called because `onAuthStateChange` fires before SDK is loaded

**What goes wrong:** The Supabase session is restored from cookie immediately on page load. If `identify()` is called before `posthog.__loaded`, it is silently dropped.

**Why it happens:** `instrumentation-client.ts` is loaded before React hydration starts. In most cases `posthog.init` is synchronous and `posthog.__loaded` is true by the time `onAuthStateChange` fires, but race conditions exist in StrictMode double-invoke.

**How to avoid:** Guard with `if (!posthog.__loaded) return;` before calling `posthog.identify()`. Alternatively, call `posthog.identify()` from `useEffect` (deferred to after hydration) rather than from the `onAuthStateChange` callback directly.

**Warning signs:** Authenticated users show as anonymous in PostHog; `identify()` logs are absent from network tab on first load.

---

## Code Examples

### Complete `posthog-provider.tsx` (replaces `instrumentation-client.ts` for Next.js 14)

```tsx
// Source: posthog.com/docs/libraries/next-js + reetesh.in pattern (CITED)
// instrumentation-client.ts is Next.js 15.3+ only; this project uses Next.js 14.2.35
"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { useEffect } from "react";

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (posthog.__loaded) return;
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "/ingest",
      capture_pageview: false,
      autocapture: false,
      person_profiles: "identified_only",
      defaults: "2026-01-30",
    });
  }, []);

  return <PHProvider client={posthog}>{children}</PHProvider>;
}
```

### Complete `PostHogPageview` client component

```tsx
// Source: posthog.com/docs/libraries/next-js + twenty1-media.com (CITED)
"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import posthog from "posthog-js";

export function PostHogPageview() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!posthog.__loaded) return;
    let url = window.origin + pathname;
    const qs = searchParams?.toString();
    if (qs) url += `?${qs}`;
    posthog.capture("$pageview", { $current_url: url });
  }, [pathname, searchParams]);

  return null;
}
```

### Root layout addition

```tsx
// Modified src/app/layout.tsx
import { Suspense } from "react";
import { PostHogPageview } from "@/components/posthog-pageview";
import { PostHogIdentity } from "@/components/posthog-identity";

// Inside <body>:
// <Suspense fallback={null}><PostHogPageview /></Suspense>
// <PostHogIdentity />
```

### Service worker `/ingest` bypass

```javascript
// public/sw.js addition (prepend to existing event handlers)
self.addEventListener("fetch", (event) => {
  if (event.request.url.includes("/ingest/")) {
    event.respondWith(fetch(event.request));
  }
});
```

### posthog-node per-request pattern (for Phase 8 API routes)

```typescript
// Source: posthog.com/docs/libraries/node + posthog.com/docs/libraries/vercel (CITED)
import { PostHog } from "posthog-node";

export function createPostHogClient() {
  return new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    flushAt: 1,
    flushInterval: 0,
  });
}

// Usage in API route:
// const posthog = createPostHogClient();
// posthog.capture({ distinctId: userId, event: EVENT.CHECKIN_SUBMITTED, properties: { ... } });
// await posthog.shutdown();
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `providers.tsx` with `useEffect` init | `instrumentation-client.ts` | Next.js 15.3+ | Cleaner separation — init runs outside React tree; init values fixed for session |
| `capture_pageview: true` with history listeners | `capture_pageview: false` + manual `PostHogPageview` | App Router era | Required for SPA — automatic pageview fires only once at init |
| posthog-node singleton per module | Per-request instantiation with `flushAt: 1` | posthog-node v3+ | Serverless safety — module-level singleton can fail to flush between concurrent requests |
| `posthog.flush()` | `await posthog.shutdown()` / `captureImmediate()` | posthog-node v4+ | `shutdown()` is the reliable teardown path; `flush()` alone does not await queue drain in all versions |

**Deprecated/outdated:**
- `posthog-react` (npm package): Outdated wrapper; the correct import is `posthog-js/react` (subpath of official SDK).
- `vercel.json` `functions.runtime` for Node version: Vercel now reads `package.json` `engines.node` and Project Settings; `functions.runtime` for Node is legacy.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Vercel's latest Node 20.x patch is above 20.20.0 | Pattern 8, Standard Stack | posthog-node@5 fails at runtime on Vercel; fix: bump engines to "22.x" |
| A2 | RESOLVED: `instrumentation-client.ts` is NOT supported in Next.js 14.x — it was introduced in Next.js 15.3 [CITED: nextjs.org/blog/next-15-3] | Pattern 1, Architecture | Use `posthog-provider.tsx` client component with `useEffect` guard — this is the correct approach for Next.js 14 |
| A3 | `posthog.__loaded` is a stable public property in posthog-js@1.x | Patterns 2, 6 | Race-condition guard may not work; alternative: React state flag set in `useEffect` after init |
| A4 | `/ingest` path does not conflict with any existing Next.js routes | FOUND-04 | Route collision would send analytics to a page handler; check `src/app/ingest/` does not exist |

---

## Open Questions

1. **PostHog region (US vs EU)**
   - What we know: The proxy destination differs (`us.i.posthog.com` vs `eu.i.posthog.com`)
   - What's unclear: Which region the team's PostHog account is on
   - Recommendation: Default to US (`us.i.posthog.com`) — can be changed via env var `NEXT_PUBLIC_POSTHOG_HOST` without code change

2. **`instrumentation-client.ts` in Next.js 14 — RESOLVED**
   - Decision: `instrumentation-client.ts` is NOT available in Next.js 14.2.x (introduced in Next.js 15.3). Use `src/components/posthog-provider.tsx` with `useEffect` init. The planner should note this substitution when creating PLAN.md — the file created is `posthog-provider.tsx`, not `instrumentation-client.ts`.

3. **`posthog-js/react` PostHogProvider — required or optional?**
   - What we know: Direct `import posthog from 'posthog-js'` works without a Provider
   - What's unclear: Whether Phase 8/9 components will need `usePostHog()` hook (requires Provider)
   - Recommendation: Skip PostHogProvider for Phase 7; add it only if Phase 8 needs `usePostHog()` in deep components

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | `posthog-node@5` peer dep | ✓ | 25.1.0 (local) | — (local exceeds requirement) |
| npm | Package install | ✓ | (package-lock.json present) | — |
| `posthog-js` | FOUND-01, FOUND-02 | ✗ (not yet installed) | — | — |
| `posthog-node` | FOUND-05 scaffolding, Phase 8 usage | ✗ (not yet installed) | — | — |
| Vercel Node 20.x | FOUND-05 | ✓ (Vercel supports 20.x) | Latest 20.x | Use 22.x if 20.x unavailable |

**Missing dependencies with no fallback:** `posthog-js`, `posthog-node` — must be installed as part of Wave 0.

**Missing dependencies with fallback:** None.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.7 |
| Config file | `vitest.config.ts` |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FOUND-01 | `posthog.init` called with `capture_pageview: false` and `autocapture: false` | unit | `npm test -- src/lib/analytics/events.test.ts` | ❌ Wave 0 |
| FOUND-03 | Event catalog exports typed constants with `category:object_action` format | unit | `npm test -- src/lib/analytics/events.test.ts` | ❌ Wave 0 |
| FOUND-04 | `/ingest` rewrites resolve to PostHog host (config shape) | manual | Inspect `next.config.mjs` + network tab in dev | N/A — no runtime test |
| FOUND-05 | `engines.node` present and correct in `package.json` | manual | `node -e "require('./package.json').engines"` | N/A — config check |

**Note:** FOUND-01's init options and FOUND-04's proxy behavior are not unit-testable in isolation — the meaningful validation is a live network request in `npm run dev` (PostHog network tab shows `200 /ingest/e/`) and a PostHog dashboard event landing. Treat FOUND-01 init options as verified via TypeScript type-checking of the init config shape.

### Sampling Rate
- Per task commit: `npm test`
- Per wave merge: `npm test`
- Phase gate: Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/lib/analytics/events.test.ts` — covers FOUND-03 (event name format validation)
- [ ] No framework install needed — Vitest already configured

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes (minimal) | Env var presence checked at init; no user input flows through analytics catalog |
| V6 Cryptography | no | — |

### Known Threat Patterns for PostHog + Next.js

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| NEXT_PUBLIC_POSTHOG_KEY exposed in client bundle | Information Disclosure | Acceptable by design — PostHog project keys are public-facing; secrets are server-side write keys, not ingestion keys |
| `/ingest` proxy used to exfiltrate data to arbitrary PostHog host | Tampering | `NEXT_PUBLIC_POSTHOG_HOST` is an env var; value is validated at deployment time; rewrites pin destination to PostHog domains |
| Analytics events contain PII (e.g., email as distinctId) | Information Disclosure | Use Supabase UUID as `distinctId`, never email or name; enforced by Pattern 3 code |
| Service worker caches PostHog responses | Tampering | SW bypass guard (`/ingest/`) prevents caching analytics responses |
| Server-side PostHog client leaks between requests | Elevation of Privilege | Per-request instantiation pattern prevents cross-request contamination |

**ASVS Level 1 compliance notes:**
- No authentication is added or modified by this phase — auth risk is unchanged.
- The typed event catalog (`events.ts`) reduces information-disclosure risk by preventing arbitrary string event names from leaking internal data.
- `person_profiles: "identified_only"` in `posthog.init` prevents anonymous profiles from accumulating in PostHog, reducing data retention risk.

---

## Sources

### Primary (MEDIUM confidence)
- [posthog.com/docs/libraries/next-js](https://posthog.com/docs/libraries/next-js) — SDK init, identify, App Router setup
- [posthog.com/docs/advanced/proxy/nextjs](https://posthog.com/docs/advanced/proxy/nextjs) — Rewrite rules for `/ingest` reverse proxy
- [posthog.com/docs/libraries/vercel](https://posthog.com/docs/libraries/vercel.md) — Serverless/Vercel flush patterns
- [vercel.com/docs/functions/runtimes/node-js/node-js-versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions) — Node.js version configuration via `package.json` engines
- npm registry: `posthog-js@1.391.2`, `posthog-node@5.38.2` — version and engine confirmation

### Secondary (LOW confidence)
- [reetesh.in/blog/posthog-integration-in-next.js-app-router](https://reetesh.in/blog/posthog-integration-in-next.js-app-router) — PostHogProvider + PostHogPageview pattern with `useSearchParams`
- [twenty1-media.com/blog/posthog-nextjs-app-router-pageviews](https://www.twenty1-media.com/blog/posthog-nextjs-app-router-pageviews) — `posthog.__loaded` guard, `person_profiles` option
- [dev.to PostHog Suspense gotcha](https://dev.to/diven_rastdus_c5af27d68f3/posthog-nextjs-16-app-router-the-suspense-gotcha-that-silenced-my-analytics-for-6-days-5eeo) — Suspense boundary requirement, `posthog.__loaded` guard

### Tertiary (LOW confidence)
- [MDN ServiceWorkerGlobalScope fetch event](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerGlobalScope/fetch_event) — SW fetch passthrough pattern

---

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM — packages verified on npm registry; PostHog docs consulted
- Architecture: MEDIUM — official PostHog docs + multiple community cross-references
- Pitfalls: MEDIUM — confirmed by community sources; SW bypass is LOW (inferred from MDN patterns)
- Vercel runtime: MEDIUM — official Vercel docs confirmed; patch version assumption is LOW

**Research date:** 2026-06-20
**Valid until:** 2026-07-20 (posthog-js releases frequently; check version at planning time)
