# Phase 8: Event Instrumentation - Context

**Gathered:** 2026-06-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Every key product moment — onboarding steps, check-ins, pact lifecycle, financial settlement, and feature usage — emits a typed event so the Admin Dashboard (Phase 9) has real data to read.

Deliverables:
- `src/lib/analytics/server.ts` — shared `captureServerEvent(userId, event, props)` helper using posthog-node
- Server-side events in `onboarding-progress/route.ts` (PATCH, per step + walkthrough complete)
- Server-side events in `checkin/route.ts` (POST, with outcome + method properties)
- Server-side events in group routes: `groups/create`, `groups/invite`, `groups/join`, `groups/leave`
- Financial events in `cron/enforce/route.ts` with `await posthog.shutdown()` after runEnforcement
- Client-side events in `nav.tsx` (tab visits), `notifications-overlay.tsx` (notification CTR), shortcut page/component (setup viewed)

All event names use `EVENT.*` constants from `src/lib/analytics/events.ts` — no inline strings.

Requirements: INSTR-01, INSTR-02, INSTR-03, INSTR-04, INSTR-05

</domain>

<decisions>
## Implementation Decisions

### Server-Side PostHog Helper
- Helper lives in `src/lib/analytics/server.ts` — co-located with `events.ts` in the existing analytics module
- Create a new `PostHogClient` instance per `captureServerEvent()` call — stateless, safe for serverless, no singleton leak
- Silent try-catch in the helper — analytics errors must never throw into business logic (financial correctness and check-in logic are unaffected by analytics failures)

### Shutdown & Flush Strategy
- Call `await posthog.shutdown()` only in `cron/enforce/route.ts`, after `runEnforcement()` completes — this is the only long-lived route where Vercel teardown could drop the flush
- Other short-lived API routes rely on the `/ingest` reverse proxy keeping the batch alive; no shutdown call needed there
- No `captureServerEventAndShutdown()` helper variant — cron calls shutdown explicitly, keeping the API surface minimal

### Client-Side Event Placement
- Tab visit events: wire into `nav.tsx` onClick handler (existing click logic, single place, captures all tab navigations with `{ tab: <tab_name> }` property)
- Notification CTR: hook into `notifications-overlay.tsx` on notification item click (has existing click handlers)
- Shortcut setup viewed: `useEffect` on mount in the shortcut page/component (fires once when user lands on the screen)

### Claude's Discretion
- Exact PostHog host env var (`NEXT_PUBLIC_POSTHOG_HOST`) already set from Phase 7 — server helper reads `process.env.NEXT_PUBLIC_POSTHOG_HOST` and `process.env.POSTHOG_PRIVATE_KEY` (or reuses key)
- Properties on each event: keep to signal-bearing fields only — `step_id` + `tour_version` for onboarding; `outcome` + `method` + `distance_m` for check-ins; relevant IDs for pact events
- Pact "challenge created" event fires from `groups/create` POST; "invite accepted" from `groups/join`; "invite declined" from a decline route; "member left" from `groups/leave`

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/analytics/events.ts` — fully typed `EVENT` catalog with all 14 event constants (ONBOARDING_STEP_COMPLETED, CHECKIN_SUBMITTED, PACT_CREATED, FINANCIAL_PENALTY_ISSUED, FEATURE_TAB_VISITED, etc.)
- `src/components/posthog-identity.tsx` — client PostHog identity wiring from Phase 7
- `src/components/nav.tsx` — tab navigation component with existing onClick handlers (client component)
- `src/components/notifications-overlay.tsx` — notification display component with click handlers
- `src/app/(tabs)/shortcut/` — shortcut setup page (page.tsx, client.tsx)

### Established Patterns
- Server routes: `runtime = "nodejs"`, `createAdminClient()` for trusted paths, `createClient()` for user-scoped paths
- `try { } catch { }` error handling — silent swallow for non-critical operations (consistent with push notification pattern)
- Zod validation at every PATCH/POST boundary before business logic runs
- `"use client"` components use `usePostHog()` hook (from posthog-js/react) for client-side capture
- Named exports, `@/` imports, strict TypeScript

### Integration Points
- `src/app/api/onboarding-progress/route.ts` PATCH — fires after `mergeProgress()` succeeds; emit step event then check if walkthrough just completed
- `src/app/api/checkin/route.ts` POST — fires after reconciliation returns the final status (verified/unverified/geo_failed)
- `src/app/api/groups/create/route.ts` — pact created event after successful DB insert
- `src/app/api/groups/join/route.ts` — invite accepted
- `src/app/api/groups/leave/route.ts` — member left
- `src/app/api/cron/enforce/route.ts` — financial events inside `runEnforcement()` (may need to thread PostHog client in) + `await posthog.shutdown()` after

</code_context>

<specifics>
## Specific Ideas

- The `onboarding-progress` PATCH already has `last_step_id` and `tour_version` in the merged payload — use those as event properties for INSTR-01
- Check-in source is already on the `Body` schema as `source: "shortcut" | "manual"` — pass as `method` property on CHECKIN_SUBMITTED
- Financial events (INSTR-04): `runEnforcement()` in `src/lib/enforcement.ts` closes periods and issues penalties — PostHog capture should happen there or be returned as metadata and captured in the cron route handler

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
