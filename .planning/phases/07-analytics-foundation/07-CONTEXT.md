# Phase 7: Analytics Foundation - Context

**Gathered:** 2026-06-20
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

PostHog is wired into the app so every event the team writes is reliably ingested, attributed to the right user, and named against one typed catalog.

Deliverables:
- `instrumentation-client.ts` with PostHog JS SDK, `capture_pageview: false`, autocapture off, `$pageview` on route change via `PostHogPageview` client component
- `identify()` called on login with Supabase user ID for user attribution
- Typed event catalog in `src/lib/analytics/events.ts` with `category:object_action` naming
- `/ingest` reverse proxy rewrites in `next.config.mjs` (excluded from middleware matcher; PWA service worker bypass)
- Node.js runtime upgraded to 20.20+ for `posthog-node@5` peer dependency

Requirements: FOUND-01, FOUND-02, FOUND-03, FOUND-04, FOUND-05

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure/setup phase. Use REQUIREMENTS.md FOUND-01 through FOUND-05 as the authoritative spec. All file paths, naming conventions, and configuration details are already specified there.

Key decisions deferred to planner:
- Where exactly `identify()` is called (client-side auth state listener vs server-confirmed login path)
- Dev/test mode handling (whether to disable PostHog in non-production)
- Node 20.20+ upgrade mechanism (`.nvmrc`, `package.json` engines, `vercel.json`)
- Service worker bypass implementation for `/ingest` path in PWA manifest or sw.js

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/supabase/browser.ts` — client-side Supabase client (auth state listener available here)
- `src/app/layout.tsx` — root layout where `PostHogPageview` component should be added
- `next.config.mjs` — Next.js config file for adding `/ingest` rewrites (currently minimal)
- `src/middleware.ts` — middleware with existing route exclusions (pattern to follow for `/ingest`)

### Established Patterns
- Named exports, `@/` imports, kebab-case filenames, camelCase functions
- `src/lib/*.ts` for pure utility/logic modules (no side effects) — analytics catalog fits here
- `"use client"` directive for client components
- TypeScript strict mode, Zod at API boundaries

### Integration Points
- Root layout (`src/app/layout.tsx`) — add `PostHogPageview` + `PostHogProvider` wrapper
- Supabase auth flow — add `identify()` call where user auth state is confirmed client-side
- `next.config.mjs` — rewrites for `/ingest` proxy to PostHog's ingest endpoint
- `.env.local` / Vercel env — `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST`

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase. Follow REQUIREMENTS.md FOUND-01 through FOUND-05 exactly. The requirements already specify exact file names, init options, naming conventions, and proxy paths.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
