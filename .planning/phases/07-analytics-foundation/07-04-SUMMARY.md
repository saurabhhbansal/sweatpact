---
phase: 07-analytics-foundation
plan: "04"
subsystem: analytics
tags: [posthog, root-layout, next.js, suspense, env-vars, build-gate]
requires:
  - 07-02 (PostHogProvider, PostHogPageview, PostHogIdentity components)
  - 07-03 (/ingest reverse proxy, middleware exclusion, SW bypass)
provides:
  - Root layout with PostHogProvider wrapping all body children
  - PostHogPageview mounted inside Suspense boundary (useSearchParams safe)
  - PostHogIdentity mounted for Supabase auth → PostHog identity bridge
  - .env.example documenting NEXT_PUBLIC_POSTHOG_KEY and NEXT_PUBLIC_POSTHOG_HOST
affects:
  - src/app/layout.tsx (PostHog wired into app shell)
tech_stack:
  added: []
  patterns:
    - Next.js App Router client component wrapping in server root layout
    - Suspense boundary around useSearchParams hook for static-generation safety
key_files:
  created: []
  modified:
    - src/app/layout.tsx
    - .env.example
decisions:
  - PostHogProvider wraps all body children (not the html/body elements themselves) — correct App Router pattern where server component passes children through client component boundary
  - PostHogPageview placed inside Suspense fallback={null} as first child of PostHogProvider — required because useSearchParams() causes static-generation bailout without Suspense wrapper
  - PostHogIdentity placed outside Suspense (does not use useSearchParams; subscribe-on-mount pattern is safe without Suspense)
  - NEXT_PUBLIC_POSTHOG_HOST documented as /ingest (reverse proxy path) with explicit note NOT to use direct PostHog URL — enforces T-07-11 mitigation
metrics:
  duration: "4min"
  completed: "2026-06-27"
  tasks_completed: 2
  files_created: 0
  files_modified: 2
status: complete
requirements_satisfied:
  - FOUND-01
  - FOUND-02
  - FOUND-04
---

# Phase 07 Plan 04: Root Layout Integration and Phase Gate Summary

**One-liner:** Root layout wired with PostHogProvider + PostHogPageview-in-Suspense + PostHogIdentity; production build and full test suite pass, completing Phase 07 analytics foundation.

## What Was Built

### Task 1 — Wire PostHog components into root layout (FOUND-01, FOUND-02)

Modified `src/app/layout.tsx` to integrate the three PostHog components created in Plan 02:

**Imports added:**
- `import { Suspense } from "react"` — built-in React; required for useSearchParams Suspense boundary
- `import { PostHogProvider } from "@/components/posthog-provider"`
- `import { PostHogPageview } from "@/components/posthog-pageview"`
- `import { PostHogIdentity } from "@/components/posthog-identity"`

**Layout structure change:**

All existing body children (SplashScreen, InstallGate, tour-root div) are now wrapped by `<PostHogProvider>`. The wrapper structure inside `<body className="min-h-screen">` is:

```
<PostHogProvider>
  <Suspense fallback={null}><PostHogPageview /></Suspense>
  <PostHogIdentity />
  <SplashScreen />
  <InstallGate>{children}</InstallGate>
  <div id="tour-root" />
</PostHogProvider>
```

The Suspense boundary around PostHogPageview is mandatory — `useSearchParams()` in that component triggers a static-generation bailout if not wrapped. The build gate in Task 2 catches omission of this wrapper with an explicit error.

All existing elements (SplashScreen, InstallGate, tour-root div comment, metadata export, viewport export) are preserved and unchanged.

`npx tsc --noEmit` exits 0 after the edit.

### Task 2 — Document env vars and run phase gate build + test (FOUND-04)

**`.env.example` update:** Added PostHog section at the end of the file after the Google Maps API Key entry:

```
# PostHog Analytics
# Get your project API key from: PostHog project settings → Project → API Keys
NEXT_PUBLIC_POSTHOG_KEY=phc_your_project_api_key_here
# Always set to /ingest (the local reverse proxy) — NOT the direct PostHog URL
NEXT_PUBLIC_POSTHOG_HOST=/ingest
```

The placeholder value `phc_your_project_api_key_here` is not a real key (T-07-11 mitigation). The comment explicitly instructs developers to use the `/ingest` reverse proxy path, not the direct PostHog URL.

**Phase gate results:**

| Gate | Command | Result |
|------|---------|--------|
| Unit tests | `npm test` | 12 test files, 158/158 tests pass |
| Production build | `npm run build` | Exit 0, 15 static pages generated |
| useSearchParams check | (build output scan) | No "useSearchParams() should be wrapped in a suspense boundary" error |
| TypeScript | `npx tsc --noEmit` | Exit 0 |

The only build output warning is a pre-existing `@next/next/no-img-element` ESLint warning in `src/app/(tabs)/shortcut/client.tsx` — unrelated to this plan's changes, not a failure.

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 8e5e7b7 | feat | wire PostHog components into root layout (FOUND-01, FOUND-02) |
| 7c6111e | feat | document PostHog env vars and pass phase gate build + test (FOUND-04) |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — `NEXT_PUBLIC_POSTHOG_KEY=phc_your_project_api_key_here` is an intentional placeholder in `.env.example` (documentation file, not runtime config). Real keys are provided by developers in `.env.local` (gitignored) and Vercel project settings. This is the correct pattern, not a stub.

## Threat Flags

No new network endpoints, auth paths, or schema changes introduced.

| Flag | File | Description |
|------|------|-------------|
| threat_flag: Information Disclosure (T-07-11, mitigated) | .env.example | PostHog key placeholder `phc_your_project_api_key_here` — verified not a real key; real key lives only in .env.local and Vercel settings |

## Self-Check: PASSED

- [x] src/app/layout.tsx imports Suspense, PostHogProvider, PostHogPageview, PostHogIdentity
- [x] PostHogProvider wraps all body children
- [x] PostHogPageview is inside `<Suspense fallback={null}>`
- [x] PostHogIdentity is mounted inside body (not inside Suspense)
- [x] All existing elements preserved: SplashScreen, InstallGate, tour-root div, metadata, viewport
- [x] .env.example contains NEXT_PUBLIC_POSTHOG_KEY with placeholder value
- [x] .env.example contains NEXT_PUBLIC_POSTHOG_HOST=/ingest with comment
- [x] npx tsc --noEmit exits 0
- [x] npm test exits 0 (158/158 tests pass)
- [x] npm run build exits 0 (no useSearchParams Suspense error)
- [x] Commits 8e5e7b7 and 7c6111e exist in git log
