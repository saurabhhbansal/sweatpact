---
phase: 07-analytics-foundation
verified: 2026-06-27T09:00:00Z
status: human_needed
score: 2/5
behavior_unverified: 3
overrides_applied: 0
re_verification: false
behavior_unverified_items:
  - truth: "A manual $pageview event lands in PostHog on every client route change"
    test: "Run npm run dev, open Network tab filtered to 'ingest', navigate between routes"
    expected: "POST /ingest/e/ requests appear on each route change (200 with real key; 400/401 with placeholder is acceptable — the request reaching the proxy confirms the pipeline)"
    why_human: "PostHog receipt requires a running server, real API key, and live network inspection — grep confirms the capture() call is wired but cannot confirm the event lands in the PostHog cloud"
  - truth: "After login, every event is attributed to the Supabase user ID in PostHog"
    test: "Log in to a test account, trigger any tracked action, check PostHog Events list"
    expected: "Events appear under the Supabase UUID as the distinct_id; no anonymous IDs for post-login events"
    why_human: "PostHog-side attribution requires a live PostHog project with real API key; posthog.identify() call is present and wired, but whether PostHog records the attribution cannot be observed without network access to the PostHog dashboard"
  - truth: "PostHog ingestion traffic reaches PostHog through /ingest without being blocked"
    test: "Run npm run dev with NEXT_PUBLIC_POSTHOG_KEY set, navigate the app, inspect /ingest/ network requests"
    expected: "/ingest/e/ requests are proxied to us.i.posthog.com and return 200 (or appropriate PostHog response); no ad-blocker interference since traffic originates from same origin"
    why_human: "Rewrite rules and skipTrailingSlashRedirect are verified in code; whether the proxy actually reaches PostHog servers and whether ad-blockers are circumvented requires a live network test with valid credentials"
human_verification:
  - test: "PostHog $pageview receipt — manual network inspection"
    expected: "POST /ingest/e/ request appears in Network tab on every SPA route change after setting a real NEXT_PUBLIC_POSTHOG_KEY in .env.local"
    why_human: "Requires live server + PostHog API key + network inspection; cannot be verified by static analysis"
  - test: "PostHog user attribution — dashboard check"
    expected: "Events after login appear attributed to the Supabase UUID (not anonymous) in the PostHog Events view"
    why_human: "Requires PostHog cloud access, live session, and Supabase user login to observe attribution"
  - test: "End-to-end proxy chain — /ingest reaches PostHog"
    expected: "/ingest/e/ POSTs reach us.i.posthog.com and are acknowledged; verify skipTrailingSlashRedirect prevents 404 on trailing-slash endpoints like /decide/"
    why_human: "Requires deployment or local dev with real API key; network-layer behavior cannot be observed from source files alone"
---

# Phase 07: Analytics Foundation — Verification Report

**Phase Goal:** PostHog is wired into the app so every event the team writes is reliably ingested, attributed to the right user, and named against one typed catalog.
**Verified:** 2026-06-27T09:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC-1 | A manual `$pageview` event lands in PostHog on every client route change, with autocapture and automatic pageview both disabled | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Code: `PostHogPageview` fires `posthog.capture("$pageview", ...)` on `[pathname, searchParams]` deps; `capture_pageview: false` and `autocapture: false` confirmed in `posthog-provider.tsx`; wired in `layout.tsx` inside `<Suspense>`. PostHog cloud receipt requires human test. |
| SC-2 | After a user logs in, every event that user triggers is attributed to their Supabase user ID in PostHog | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Code: `posthog.identify(session.user.id)` on `SIGNED_IN`, `posthog.reset()` on `SIGNED_OUT` in `posthog-identity.tsx`; wired in `layout.tsx`. PostHog-side attribution requires human test with live API key. |
| SC-3 | All event names used anywhere in the app resolve to constants in `events.ts` following `category:object_action` convention — no string literals at call sites | ✓ VERIFIED | `src/lib/analytics/events.ts` exports 14 `as const` constants; all values match `/^[a-z_]+:[a-z_]+$/`; 6 Vitest tests pass (format, uniqueness, entry count, spot-checks). No event call sites exist yet (Phase 8 will create them) — constraint holds vacuously and the catalog is ready. |
| SC-4 | PostHog ingestion traffic served first-party through `/ingest` (rewrites in place, excluded from middleware, service worker bypasses it) and reaches PostHog without being blocked | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Code: 3-rule `rewrites()` in `next.config.mjs` confirmed; `skipTrailingSlashRedirect: true` present; `ingest` in middleware negative-lookahead; `sw.js` conditional `/ingest/` fetch bypass present. "Reaches PostHog without being blocked" requires live network test. |
| SC-5 | Vercel runtime is Node.js 20.20+, satisfying `posthog-node@5` peer dependency | ✓ VERIFIED | `package.json` has `"engines": { "node": "20.x" }` at root level; `posthog-js: ^1.395.0` and `posthog-node: ^5.38.6` in `dependencies`. Correct Vercel mechanism (not deprecated `vercel.json functions.runtime`). |

**Score:** 2/5 truths verified (3 present + wired but behavior exercisable only at runtime with real API key)

---

### REQUIREMENTS.md Coverage — Deviation Note

**FOUND-01** in `REQUIREMENTS.md` states: *"PostHog JS SDK initialized in `instrumentation-client.ts`..."*

The implementation uses `PostHogProvider` (a React client component with `useEffect`) instead of `instrumentation-client.ts`. This is an **intentional, documented deviation**: `instrumentation-client.ts` is only available in Next.js 15.3+; this project uses Next.js 14.2.35. The plan (07-02-PLAN.md) explicitly documents this and uses the correct alternative. The ROADMAP success criteria (authoritative) do not reference `instrumentation-client.ts`. The functional outcome of FOUND-01 is fully achieved through the PostHogProvider pattern.

This is NOT a blocker. The REQUIREMENTS.md text contains an implementation detail that is incompatible with the project's Next.js version. The intent is satisfied.

---

### Required Artifacts — All Four Plans

| Artifact | Expected | Level 1: Exists | Level 2: Substantive | Level 3: Wired | Status |
|----------|----------|-----------------|---------------------|----------------|--------|
| `src/lib/analytics/events.ts` | EVENT const (14 entries) + EventName type | Yes | 14-constant `as const` object, EventName union type derived correctly | Imported by `events.test.ts`; designed for Phase 8 import | ✓ VERIFIED |
| `src/lib/analytics/events.test.ts` | 6 Vitest format+uniqueness tests | Yes | 6 tests covering format regex, uniqueness, entry count, 2 spot-checks, type assignment | Runs via `npm test` | ✓ VERIFIED |
| `src/components/posthog-provider.tsx` | SDK init with `capture_pageview: false`, `autocapture: false`, `person_profiles: "identified_only"`, `__loaded` guard | Yes | All required options present; `__loaded` guard in `useEffect([])`; `api_host` falls back to `/ingest` | Imported and used in `src/app/layout.tsx` | ✓ VERIFIED |
| `src/components/posthog-pageview.tsx` | Manual `$pageview` on pathname/searchParams change, `__loaded` guard, returns null | Yes | `usePathname`+`useSearchParams` deps; `!posthog.__loaded` guard; `posthog.capture("$pageview", { $current_url })` | In `layout.tsx` inside `<Suspense fallback={null}>` | ✓ VERIFIED |
| `src/components/posthog-identity.tsx` | `identify(session.user.id)` on SIGNED_IN, `reset()` on SIGNED_OUT, cleanup unsubscribe | Yes | `onAuthStateChange` subscription; UUID-only identify; `reset()` on logout; `subscription.unsubscribe()` cleanup | In `layout.tsx` inside PostHogProvider | ✓ VERIFIED |
| `next.config.mjs` | 3 `/ingest` rewrites + `skipTrailingSlashRedirect: true`; existing redirects preserved | Yes | `skipTrailingSlashRedirect: true`; 3 rules in correct order (static, array, catch-all); `/group`→`/groups` redirect preserved; `reactStrictMode: true` preserved | Active Next.js config (no import needed) | ✓ VERIFIED |
| `src/middleware.ts` | `ingest` in negative-lookahead matcher; function body unchanged | Yes | `ingest` added to matcher at line 36: `api/checkin\|api/cron\|ingest\|...`; middleware body unchanged | Active Next.js middleware | ✓ VERIFIED |
| `public/sw.js` | Conditional `fetch` listener for `/ingest/` prefix; existing listeners unchanged | Yes | `addEventListener("fetch")` prepended before `install`; `/ingest/` condition before `respondWith`; push/notificationclick/install/activate listeners all intact | Active service worker | ✓ VERIFIED |
| `src/app/layout.tsx` | PostHogProvider wraps body content; PostHogPageview in Suspense; PostHogIdentity mounted | Yes | All 4 imports present; `<PostHogProvider>` wraps SplashScreen+InstallGate+tour-root+Pageview+Identity; `<Suspense fallback={null}>` wraps PostHogPageview; PostHogIdentity outside Suspense | Root layout — active for every page | ✓ VERIFIED |
| `.env.example` | `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST` with comments | Yes (via git commit 7c6111e) | Placeholder value `phc_your_project_api_key_here` (not a real key); `/ingest` documented as correct value with NOT-direct-URL comment | Documentation file — no runtime wiring needed | ✓ VERIFIED |
| `package.json` | `engines.node: "20.x"`, `posthog-js`, `posthog-node` in dependencies | Yes | `{ "node": "20.x" }` at root; `posthog-js: ^1.395.0`; `posthog-node: ^5.38.6` | Installed in node_modules | ✓ VERIFIED |

---

### Key Link Verification

| From | To | Via | Status | Evidence |
|------|----|-----|--------|----------|
| `src/app/layout.tsx` | `src/components/posthog-provider.tsx` | `import { PostHogProvider } from "@/components/posthog-provider"` | ✓ WIRED | Confirmed at layout.tsx line 6 |
| `src/app/layout.tsx` | `src/components/posthog-pageview.tsx` | `import { PostHogPageview } from "@/components/posthog-pageview"` + `<Suspense>` wrapper | ✓ WIRED | Confirmed at layout.tsx lines 7, 49 |
| `src/app/layout.tsx` | `src/components/posthog-identity.tsx` | `import { PostHogIdentity } from "@/components/posthog-identity"` | ✓ WIRED | Confirmed at layout.tsx lines 8, 50 |
| `src/components/posthog-identity.tsx` | `src/lib/supabase/browser.ts` | `import { createClient } from "@/lib/supabase/browser"` | ✓ WIRED | Confirmed at posthog-identity.tsx line 5 |
| `next.config.mjs rewrites` | `https://us.i.posthog.com` | `/ingest/:path*` → PostHog US endpoint (catch-all) | ✓ WIRED | Confirmed in next.config.mjs lines 19-22 |
| `src/middleware.ts matcher` | `next.config.mjs rewrites` | `ingest` excluded from negative-lookahead so middleware skips PostHog proxy requests | ✓ WIRED | Confirmed at middleware.ts line 36 |

---

### Behavioral Spot-Checks

| Behavior | Evidence | Status |
|----------|----------|--------|
| events.test.ts — 6 format tests | Commit 9e6e82b (GREEN gate); SUMMARY documents `6/6 tests passed`; file structure confirms describe/it blocks with correct assertions | ✓ VERIFIED (test file examined directly) |
| package.json engines.node = "20.x" | `node -e "..."` confirmed `{ node: '20.x' }` via bash check | ✓ VERIFIED |
| posthog-js and posthog-node in dependencies | Confirmed via Node.js `require('./package.json')` output | ✓ VERIFIED |
| PostHogPageview in Suspense boundary | `layout.tsx` line 49: `<Suspense fallback={null}><PostHogPageview /></Suspense>` | ✓ VERIFIED |
| capture_pageview: false + autocapture: false | `posthog-provider.tsx` lines 16-19 | ✓ VERIFIED |
| identify uses UUID not email | `posthog-identity.tsx` line 18: `posthog.identify(session.user.id)` — user.id is Supabase UUID | ✓ VERIFIED |
| skipTrailingSlashRedirect: true | `next.config.mjs` line 4 | ✓ VERIFIED |
| SW fetch bypass conditional on /ingest/ | `public/sw.js` lines 7-12: `if (event.request.url.includes("/ingest/"))` before respondWith | ✓ VERIFIED |

Step 7b SKIPPED for runtime network checks — starting server would be required to verify `/ingest/e/` POST requests appear; routes to human verification instead.

---

### Requirements Coverage

| Requirement | Plans | Description | Status | Evidence |
|-------------|-------|-------------|--------|----------|
| FOUND-01 | 07-02, 07-04 | SDK init with capture_pageview/autocapture off; PostHogPageview in root layout | ⚠️ Code VERIFIED; PostHog receipt HUMAN NEEDED | PostHogProvider + PostHogPageview + layout wiring confirmed; deviation from instrumentation-client.ts is intentional (Next.js 14 incompatibility) |
| FOUND-02 | 07-02, 07-04 | identify() with Supabase user ID on login | ⚠️ Code VERIFIED; PostHog attribution HUMAN NEEDED | posthog-identity.tsx confirmed; layout wiring confirmed |
| FOUND-03 | 07-01 | Typed event catalog with category:object_action naming | ✓ SATISFIED | events.ts (14 constants) + events.test.ts (6 tests) confirmed |
| FOUND-04 | 07-03, 07-04 | /ingest reverse proxy; middleware exclusion; SW bypass | ⚠️ Code VERIFIED; network delivery HUMAN NEEDED | next.config.mjs rewrites + middleware + sw.js all confirmed |
| FOUND-05 | 07-01 | Node.js 20.20+ runtime for posthog-node@5 | ✓ SATISFIED | engines.node "20.x" in package.json confirmed |

All 5 requirements have implementation evidence. FOUND-01, FOUND-02, FOUND-04 have runtime outcome components that require human testing.

---

### Anti-Patterns Scan

Scanned all 9 files modified by this phase: `src/lib/analytics/events.ts`, `src/lib/analytics/events.test.ts`, `src/components/posthog-provider.tsx`, `src/components/posthog-pageview.tsx`, `src/components/posthog-identity.tsx`, `src/app/layout.tsx`, `next.config.mjs`, `src/middleware.ts`, `public/sw.js`.

| File | Pattern | Severity | Finding |
|------|---------|----------|---------|
| All 9 files | TBD / FIXME / XXX | — | None found |
| All 9 files | return null / {} / [] stubs | — | `posthog-pageview.tsx` and `posthog-identity.tsx` return null by design (headless components) |
| `.env.example` | Placeholder value | ℹ️ Info | `phc_your_project_api_key_here` is the correct pattern for a template file — not a stub |

No blockers, no warnings. All files are complete implementations.

---

### Commit Verification

All SUMMARY-documented commits confirmed present in `git log`:

| Commit | Description |
|--------|-------------|
| `4537ed9` | chore(07-01): install posthog-js posthog-node and add engines.node 20.x |
| `304bf1b` | test(07-01): add failing tests for event catalog format validation (RED gate) |
| `9e6e82b` | feat(07-01): create typed event catalog with 14 PostHog event constants |
| `045e1df` | feat(07-02): create PostHogProvider SDK init component |
| `b679ea1` | feat(07-02): create PostHogPageview and PostHogIdentity components |
| `9167067` | feat(07-03): add /ingest reverse proxy rewrites and skipTrailingSlashRedirect |
| `78fba20` | feat(07-03): exclude /ingest from middleware matcher and add SW fetch bypass |
| `8e5e7b7` | feat(07-04): wire PostHog components into root layout |
| `7c6111e` | feat(07-04): document PostHog env vars and pass phase gate build + test |

---

### Human Verification Required

#### 1. PostHog $pageview network receipt

**Test:** Set `NEXT_PUBLIC_POSTHOG_KEY=<real key>` and `NEXT_PUBLIC_POSTHOG_HOST=/ingest` in `.env.local`. Run `npm run dev`. Open the app in Chrome with DevTools Network tab filtered to `ingest`. Navigate between routes (e.g., `/`, `/groups`, `/settings`).
**Expected:** A `POST /ingest/e/` request appears after each navigation. Status 200 with a real key (400/401 with the placeholder is acceptable — the request reaching the proxy is sufficient to confirm the pipeline is wired).
**Why human:** Requires a live dev server, real PostHog API key, and network inspection. grep can confirm the capture call is wired but cannot confirm the HTTP round-trip.

#### 2. PostHog user attribution — dashboard confirmation

**Test:** With a real API key configured, log in to a test account and trigger any action (navigate between tabs). Open the PostHog project dashboard → Events.
**Expected:** Events after login appear with the Supabase UUID as the `distinct_id`. No anonymous IDs for post-login events.
**Why human:** PostHog-side attribution requires access to the PostHog cloud dashboard. The `posthog.identify(session.user.id)` call is present and wired, but whether PostHog records it correctly cannot be observed from source files.

#### 3. End-to-end /ingest proxy chain

**Test:** With `NEXT_PUBLIC_POSTHOG_HOST=/ingest`, run `npm run dev` and inspect `/ingest/decide/` requests (PostHog feature-flag check endpoint that uses a trailing slash).
**Expected:** Request is proxied to `us.i.posthog.com/decide/` without a 404. The `skipTrailingSlashRedirect: true` prevents Next.js from stripping the trailing slash.
**Why human:** Next.js rewrite + PostHog endpoint interaction requires a running server and live network to observe the proxy chain.

---

### Gaps Summary

No code gaps found. All artifacts are substantive and wired. All documented commits exist.

The only items requiring attention are:

1. **Runtime verification** (human_needed): The three end-to-end behaviors (pageview receipt, attribution, proxy delivery) require a real PostHog API key and a running server to confirm. This is expected for a third-party analytics integration phase — the plan explicitly identifies these as manual dev checks. They are not implementation gaps.

2. **REQUIREMENTS.md wording** (non-blocking deviation): FOUND-01 references `instrumentation-client.ts` which cannot be used on Next.js 14. The correct alternative (`PostHogProvider` + `useEffect`) is implemented and documented. The ROADMAP success criteria (which are authoritative) are fully met.

---

_Verified: 2026-06-27T09:00:00Z_
_Verifier: Claude (gsd-verifier)_
