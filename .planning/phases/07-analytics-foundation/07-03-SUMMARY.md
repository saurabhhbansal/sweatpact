---
phase: 07-analytics-foundation
plan: "03"
subsystem: analytics
tags: [posthog, reverse-proxy, middleware, service-worker, pwa]
requires:
  - 07-01
provides:
  - /ingest reverse proxy (next.config.mjs rewrites)
  - skipTrailingSlashRedirect for PostHog endpoints
  - middleware exclusion of /ingest paths
  - SW fetch bypass for PWA analytics
affects:
  - PostHog event ingestion pipeline (browser → /ingest → us.i.posthog.com)
  - PWA service worker fetch interception
tech_stack:
  added: []
  patterns:
    - Next.js async rewrites() for reverse proxy
    - Service worker conditional fetch event listener
key_files:
  created: []
  modified:
    - next.config.mjs
    - src/middleware.ts
    - public/sw.js
decisions:
  - Three ordered /ingest rewrite rules (static, array, catch-all) to ensure more-specific rules run before the catch-all
  - skipTrailingSlashRedirect: true required for PostHog endpoints that use trailing slashes (/e/, /decide/)
  - ingest excluded from middleware matcher (no leading slash, matching existing style of api/checkin and api/cron)
  - SW fetch listener is conditional (/ingest/ prefix only) to avoid intercepting navigation/asset requests
metrics:
  duration: "3min"
  completed: "2026-06-27"
  tasks_completed: 2
  files_created: 0
  files_modified: 3
status: complete
requirements_satisfied:
  - FOUND-04
---

# Phase 07 Plan 03: PostHog /ingest Reverse Proxy and Middleware Exclusion Summary

**One-liner:** PostHog reverse proxy wired via three ordered Next.js rewrites with skipTrailingSlashRedirect; middleware and PWA service worker exclude /ingest paths.

## What Was Built

### Task 1 — Add /ingest rewrites to next.config.mjs with skipTrailingSlashRedirect (FOUND-04)

Modified `next.config.mjs` to add two things alongside the existing `reactStrictMode: true` and `async redirects()`:

1. `skipTrailingSlashRedirect: true` — prevents Next.js from stripping trailing slashes before the rewrite runs. Required because PostHog API endpoints use trailing slashes (`/e/`, `/decide/`). Without this, requests to those endpoints return 404.

2. `async rewrites()` with exactly three ordered rules:
   - Rule 1 (static assets): `/ingest/static/:path*` → `https://us-assets.i.posthog.com/static/:path*`
   - Rule 2 (array endpoint): `/ingest/array/:path*` → `https://us-assets.i.posthog.com/array/:path*`
   - Rule 3 (catch-all): `/ingest/:path*` → `https://us.i.posthog.com/:path*`

The ordering is mandatory — more-specific rules must come before the catch-all. The existing `/group` → `/groups` redirect was preserved unchanged.

### Task 2 — Exclude /ingest from middleware matcher and add SW fetch bypass (FOUND-04)

**`src/middleware.ts`:** Added `ingest` to the existing negative-lookahead matcher group, following the existing style (no leading slash, same as `api/checkin` and `api/cron`):

Before: `"/((?!_next/static|_next/image|favicon.ico|api/checkin|api/cron|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"`
After:  `"/((?!_next/static|_next/image|favicon.ico|api/checkin|api/cron|ingest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"`

The middleware function body is byte-for-byte identical to before.

**`public/sw.js`:** Prepended a conditional fetch event listener before the existing `install` event listener:

```js
self.addEventListener("fetch", (event) => {
  if (event.request.url.includes("/ingest/")) {
    event.respondWith(fetch(event.request));
  }
  // For all other requests, do nothing — fall through to browser default
});
```

The condition ensures only `/ingest/` requests bypass SW interception. All other requests (navigation, assets, API calls) fall through to the browser default, preserving existing push-notification SW behavior. The existing install, activate, push, and notificationclick listeners are unchanged.

## Verification Results

1. `node -e "import('./next.config.mjs').then(m => m.default.rewrites()).then(r => console.log(r.length, r.map(x => x.source)))"` → `3 [ '/ingest/static/:path*', '/ingest/array/:path*', '/ingest/:path*' ]` PASS
2. `node -e "import('./next.config.mjs').then(m => console.log(m.default.skipTrailingSlashRedirect))"` → `true` PASS
3. `grep -c 'ingest' src/middleware.ts` → `1` PASS
4. `grep -c '/ingest/' public/sw.js` → `2` PASS
5. `npx tsc --noEmit` → exit 0 PASS
6. `npm run build` → exit 0 PASS

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 9167067 | feat | add /ingest reverse proxy rewrites and skipTrailingSlashRedirect to next.config.mjs |
| 78fba20 | feat | exclude /ingest from middleware matcher and add SW fetch bypass for PWA |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all three config changes are fully wired. The proxy rewrites point to hardcoded PostHog US endpoints; middleware exclusion and SW bypass are unconditional guards with no stub paths.

## Threat Flags

None — no new auth paths, financial endpoints, or trust boundaries introduced beyond those enumerated in the plan's threat model (T-07-07 through T-07-10, all accepted or mitigated inline).

## Self-Check: PASSED

- [x] next.config.mjs contains `skipTrailingSlashRedirect: true`
- [x] next.config.mjs `async rewrites()` returns 3 rules in correct order
- [x] next.config.mjs existing `/group` → `/groups` redirect preserved
- [x] next.config.mjs `reactStrictMode: true` preserved
- [x] src/middleware.ts matcher contains `ingest` in negative-lookahead
- [x] public/sw.js has `self.addEventListener("fetch", ...)` listener
- [x] public/sw.js fetch listener is conditional on `/ingest/` URL prefix
- [x] public/sw.js existing install, activate, push, notificationclick listeners unchanged
- [x] `npx tsc --noEmit` exits 0
- [x] `npm run build` exits 0
- [x] Commits 9167067 and 78fba20 exist in git log
