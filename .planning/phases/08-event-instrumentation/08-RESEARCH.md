# Phase 8: Event Instrumentation - Research

**Researched:** 2026-06-27
**Domain:** PostHog event capture — server-side (posthog-node v5) and client-side (posthog-js/react)
**Confidence:** MEDIUM

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Server-Side PostHog Helper**
- Helper lives in `src/lib/analytics/server.ts` — co-located with `events.ts` in the existing analytics module
- Create a new `PostHogClient` instance per `captureServerEvent()` call — stateless, safe for serverless, no singleton leak
- Silent try-catch in the helper — analytics errors must never throw into business logic

**Shutdown & Flush Strategy**
- Call `await posthog.shutdown()` only in `cron/enforce/route.ts`, after `runEnforcement()` completes
- Other short-lived API routes rely on the `/ingest` reverse proxy keeping the batch alive; no shutdown call needed there
- No `captureServerEventAndShutdown()` helper variant — cron calls shutdown explicitly

**Client-Side Event Placement**
- Tab visit events: wire into `nav.tsx` onClick handler with `{ tab: <tab_name> }` property
- Notification CTR: hook into `notifications-overlay.tsx` on notification item click
- Shortcut setup viewed: `useEffect` on mount in the shortcut page/component

### Claude's Discretion
- Exact PostHog host env var (`NEXT_PUBLIC_POSTHOG_HOST`) already set from Phase 7 — server helper reads `process.env.NEXT_PUBLIC_POSTHOG_HOST` and `process.env.POSTHOG_PRIVATE_KEY` (or reuses key)
- Properties on each event: keep to signal-bearing fields only — `step_id` + `tour_version` for onboarding; `outcome` + `method` + `distance_m` for check-ins; relevant IDs for pact events
- Pact "challenge created" event fires from `groups/create` POST; "invite accepted" from `groups/join`; "invite declined" from a decline route; "member left" from `groups/leave`

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INSTR-01 | Onboarding walkthrough step events tracked server-side on each `complete_step` PATCH — each step ID is captured as a distinct event so funnel drop-off is measurable per step | `captureServerEvent(userId, EVENT.ONBOARDING_STEP_COMPLETED, { step_id, tour_version })` in `onboarding-progress/route.ts` after `mergeProgress()` succeeds; also emit `ONBOARDING_WALKTHROUGH_COMPLETED` when `merged.completed_at` transitions from null to set |
| INSTR-02 | Check-in events captured server-side in `api/checkin` route with outcome and method properties | `CHECKIN_GEO_FAILED` in early-return 422 branch; `CHECKIN_SUBMITTED` with `{ outcome, method, distance_m }` at successful end-path |
| INSTR-03 | Pact lifecycle events captured on existing API routes — challenge created, invite accepted, invite declined, member left | Four routes confirmed: `groups/create`, `challenges/respond` (accept branch), `challenges/respond` (decline branch), `groups/leave` |
| INSTR-04 | Financial events — penalty issued and settlement recorded — with `await posthog.shutdown()` in cron/enforce | FINANCIAL_PENALTY_ISSUED from cron loop (penalized branch); FINANCIAL_SETTLEMENT_RECORDED from `settlements/route.ts`; `await posthog.shutdown()` after `runEnforcement()` in cron route |
| INSTR-05 | Feature usage events client-side — tab visits, notification CTR, Shortcut setup viewed — using typed constants | `usePostHog()` in nav.tsx, notifications-overlay.tsx, shortcut client.tsx |
</phase_requirements>

---

## Summary

Phase 8 wires 14 typed events (already defined in `src/lib/analytics/events.ts` from Phase 7) into the existing API routes and client components. No new npm packages are needed — `posthog-node@5.38.6` and `posthog-js@1.395.0` are already installed and the `PostHogProvider` wraps the entire React tree.

The single new file is `src/lib/analytics/server.ts` — a thin `captureServerEvent(userId, event, props)` helper that creates a per-call `PostHog` instance with serverless-safe config (`flushAt: 1`, `flushInterval: 0`) and wraps everything in a silent try-catch so analytics failures never reach business logic. Every server-side route imports and calls this helper after its primary DB operation succeeds.

The critical correctness concern is Vercel function teardown: `posthog-node` batches events and flushes them asynchronously. Short-lived routes are fine because the `/ingest` reverse proxy keeps the connection alive. The cron route (`cron/enforce`) is the exception — it runs inside a 30-second Vercel function that can be torn down before a background flush completes. The fix is a single `await posthog.shutdown()` call at the end of the cron handler, which forces a synchronous flush before the function exits.

Two architecture clarifications found by reading the actual routes:
1. "Invite accepted" and "invite declined" events both come from `src/app/api/challenges/respond/route.ts` (the `action: "accept" | "decline"` route), NOT from `groups/join` or a separate decline route. The `groups/join` route handles a separate invite-code join flow and should also emit `PACT_INVITE_ACCEPTED`.
2. `FINANCIAL_SETTLEMENT_RECORDED` comes from `src/app/api/settlements/route.ts` (manual user settlement), not from `cron/enforce`. Only `FINANCIAL_PENALTY_ISSUED` comes from the cron.

**Primary recommendation:** Create `server.ts` helper first (Wave 1), then instrument all server routes (Wave 2), then wire client-side events (Wave 3). Run `npm test` after Wave 1 (tests for events.ts still pass) and after Wave 3 (full suite green).

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Server-side event capture helper | API / Backend | — | `posthog-node` runs in Vercel Functions; helper created once, imported by routes |
| Onboarding step events | API / Backend | — | PATCH handler is server-authoritative; client must not forge step completion |
| Check-in events | API / Backend | — | Verification happens server-side; outcome is authoritative only at route level |
| Pact lifecycle events | API / Backend | — | Group creation/join/leave logic is in route handlers; events fire after DB success |
| Financial events | API / Backend | — | Enforcement is cron-triggered server logic; settlement is server-gated user action |
| Tab visit events | Browser / Client | — | Navigation happens on client; `nav.tsx` is already `"use client"` |
| Notification CTR events | Browser / Client | — | Click handlers are in `notifications-overlay.tsx` (`"use client"` portal) |
| Shortcut setup viewed event | Browser / Client | — | Page mount is detected via `useEffect` in `ShortcutSetup` client component |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `posthog-node` | 5.38.6 (installed) | Server-side event capture | Already installed (Phase 7); official PostHog Node SDK [VERIFIED: npm registry] |
| `posthog-js` | 1.395.0 (installed) | Client-side event capture via `usePostHog()` | Already installed, `PostHogProvider` wraps entire React tree [VERIFIED: npm registry] |

**No new packages to install.** Both packages are already in `package.json`.

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `posthog-js/react` | (sub-path of posthog-js) | `usePostHog()` hook for client components | Used in nav.tsx, notifications-overlay.tsx, shortcut client.tsx |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| per-call `new PostHog()` instance | module-level singleton | Singleton leaks across serverless cold starts and causes shutdown ordering bugs; per-call is safe |
| `usePostHog()` hook | `import posthog from 'posthog-js'` direct import | Direct import works but `usePostHog()` is the recommended pattern when `PostHogProvider` is already in the tree |

---

## Package Legitimacy Audit

> Packages were vetted in Phase 7 research and already installed. Re-verification here:

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `posthog-node` | npm | 6+ yrs (latest 2026-06-26) | 6,863,275/wk | github.com/PostHog/posthog-js | SUS (too-new latest patch) | Approved — same org/repo as posthog-js; millions of weekly downloads; verdict is timing artifact only |
| `posthog-js` | npm | 6+ yrs (latest 2026-06-26) | 8,304,079/wk | github.com/PostHog/posthog-js | SUS (too-new latest patch) | Approved — official PostHog browser SDK; no postinstall; established org |

**Packages removed due to [SLOP] verdict:** none

**Packages flagged as suspicious [SUS]:** Both packages — flagged due to very-recent publish date of the latest patch, NOT organic suspicion. No `checkpoint:human-verify` needed; install is already done.

---

## Architecture Patterns

### System Architecture Diagram

```
Server Routes                    server.ts helper                 PostHog Cloud
  │                                    │                               │
  │  DB op succeeds                    │                               │
  ├─ captureServerEvent(userId, …) ───►│                               │
  │                                    │  new PostHog(key, host)       │
  │                                    │  client.capture(…)            │
  │                                    │  [no shutdown — short route]  │
  │                                    │  → batch flushes via /ingest  │
  │                                    │  → proxy forwards to PostHog ─┤
  │                                    │                               │

Cron Route (cron/enforce)        server.ts helper
  │                                    │
  │  await runEnforcement(admin, now)  │
  │  → per-user captureServerEvent ───►│
  │                                    │
  │  await posthog.shutdown() ◄────────┤ ← forces synchronous flush
  │  (before Vercel function exits)    │   before teardown
  │                                    │

Client Components (nav.tsx, etc.) usePostHog()              PostHog (via /ingest)
  │                                    │                               │
  │  onClick / useEffect mount         │                               │
  ├─ posthog?.capture(EVENT.*, {…}) ──►─────────────────────────────►│
  │                                    │                               │
```

### Recommended Project Structure

```
src/
├── lib/
│   └── analytics/
│       ├── events.ts          # Already exists — typed EVENT constants (14 events)
│       └── server.ts          # NEW — captureServerEvent() helper using posthog-node
├── app/
│   └── api/
│       ├── onboarding-progress/route.ts   # MODIFIED — INSTR-01
│       ├── checkin/route.ts               # MODIFIED — INSTR-02
│       ├── groups/
│       │   ├── create/route.ts            # MODIFIED — INSTR-03
│       │   └── leave/route.ts             # MODIFIED — INSTR-03
│       ├── challenges/
│       │   └── respond/route.ts           # MODIFIED — INSTR-03 (accept + decline)
│       ├── settlements/route.ts           # MODIFIED — INSTR-04 (settlement recorded)
│       └── cron/
│           └── enforce/route.ts           # MODIFIED — INSTR-04 + shutdown
└── components/
    ├── nav.tsx                            # MODIFIED — INSTR-05 (tab visits)
    ├── notifications-overlay.tsx          # MODIFIED — INSTR-05 (notification CTR)
    └── (tabs)/shortcut/client.tsx         # MODIFIED — INSTR-05 (shortcut setup viewed)
```

### Pattern 1: Server-Side Helper (`src/lib/analytics/server.ts`)

**What:** Thin wrapper around `posthog-node` that creates a per-call client and swallows errors.

**When to use:** Import `captureServerEvent` in any API route that needs server-side event capture.

```typescript
// Source: posthog.com/docs/libraries/node (serverless pattern) [CITED]
// File: src/lib/analytics/server.ts
import { PostHog } from "posthog-node";
import type { EventName } from "@/lib/analytics/events";

/**
 * Emit a typed server-side PostHog event.
 * - Creates a new PostHog instance per call (stateless, safe for serverless).
 * - flushAt: 1 + flushInterval: 0 flush the event immediately in one HTTP call.
 * - Silent try-catch: analytics failures must never surface into business logic.
 * - Does NOT call shutdown() — callers that need guaranteed flush (cron/enforce)
 *   must call shutdown() on the returned client or handle it explicitly.
 */
export async function captureServerEvent(
  distinctId: string,
  event: EventName,
  properties?: Record<string, unknown>
): Promise<void> {
  try {
    const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!apiKey) return; // no-op if not configured (test/CI environments)

    // NEXT_PUBLIC_POSTHOG_HOST is '/ingest' (browser reverse proxy) — not valid
    // for server-to-server calls. Fall back to the direct PostHog US endpoint.
    const host = "https://eu.i.posthog.com"; // EU region — confirmed via next.config.mjs rewrites

    const client = new PostHog(apiKey, {
      host,
      flushAt: 1,       // flush after every event (serverless: no batching)
      flushInterval: 0, // disable interval-based flush
    });

    client.capture({ distinctId, event, properties });
    await client.shutdown(); // flush synchronously before function returns
  } catch {
    // Swallow: analytics must never throw into business logic
  }
}
```

**Note on host:** `NEXT_PUBLIC_POSTHOG_HOST` is hardcoded to `/ingest` for browser use (ad-blocker bypass). The server SDK communicates directly to PostHog — it must use `https://eu.i.posthog.com`. The EU region is confirmed: `next.config.mjs` rewrites point to `eu.i.posthog.com` and `eu-assets.i.posthog.com`. [VERIFIED: codebase — next.config.mjs]

**Note on shutdown strategy:** The CONTEXT.md decision says "no shutdown call in short routes" — however the posthog-node docs say `flushAt: 1` + `flushInterval: 0` still requires `await client.shutdown()` for guaranteed delivery in serverless. With the per-call pattern, calling `shutdown()` inside the helper is safe and simpler than the caller managing it. The cron route still calls `shutdown()` explicitly on its own client instance (see Pattern 3).

### Pattern 2: INSTR-01 — Onboarding Step Events

**What:** After `mergeProgress()` upserts successfully, emit `ONBOARDING_STEP_COMPLETED` per step, then `ONBOARDING_WALKTHROUGH_COMPLETED` if this PATCH just set `completed_at`.

**Integration point:** `src/app/api/onboarding-progress/route.ts` PATCH, after the upsert `.single()` returns.

```typescript
// File: src/app/api/onboarding-progress/route.ts (addition after upsert succeeds)
import { captureServerEvent } from "@/lib/analytics/server";
import { EVENT } from "@/lib/analytics/events";

// After: const { data, error } = await supabase.from(...).upsert(...).single()
// After: if (error) { ... return }

if (parsed.data.complete_step) {
  await captureServerEvent(auth.user.id, EVENT.ONBOARDING_STEP_COMPLETED, {
    step_id: parsed.data.complete_step,
    tour_version: data.tour_version,
  });
}

// Walkthrough completed: completed_at just transitioned from null → set.
// Check against existing (pre-merge) state to avoid re-firing on idempotent replay.
if (data.completed_at && !existing?.completed_at) {
  await captureServerEvent(auth.user.id, EVENT.ONBOARDING_WALKTHROUGH_COMPLETED, {
    tour_version: data.tour_version,
    steps_completed: data.completed_steps.length,
  });
}
```

**Key insight:** `existing` is already read before the upsert (the `SELECT` at line 57 of the current route). Use `existing?.completed_at` to detect the transition.

### Pattern 3: INSTR-04 — Financial Events with Shutdown

**What:** The cron route needs a single PostHog client created before `runEnforcement()`, used for per-user penalty events inside the loop, then shutdown after.

**Problem with current `captureServerEvent` helper:** It creates and shuts down a client per call. For the cron loop (potentially hundreds of users), a shared client is more efficient.

**Recommended approach:** Two options:
- **Option A (simpler):** Keep `captureServerEvent` as-is; call it for each penalized user in the cron. The `shutdown()` inside each call flushes immediately — works but creates N clients for N penalized users.
- **Option B (cron-optimized):** Export a `createServerClient()` factory and let the cron create one client, call `capture()` in a loop, then call `await client.shutdown()` once at the end.

The CONTEXT.md decision was "cron calls shutdown explicitly" — this implies Option B is preferred. The `captureServerEvent` helper is for simple single-event use cases; the cron gets its own client.

```typescript
// File: src/app/api/cron/enforce/route.ts (addition)
import { PostHog } from "posthog-node";
import { EVENT } from "@/lib/analytics/events";

// Inside handle():
const posthog = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "", {
  host: "https://eu.i.posthog.com", // EU region confirmed
  flushAt: 1,
  flushInterval: 0,
});

try {
  const result = await runEnforcement(admin, now, posthog); // thread client in
  // ...
} finally {
  await posthog.shutdown(); // guaranteed flush before Vercel tears down
}
```

**OR (no enforcement.ts change):** Modify `runEnforcement` to return `penalized_user_ids: string[]`, then emit per-user events in the cron route after `runEnforcement` returns.

**Recommended:** Return `penalized_user_ids` from `runEnforcement` rather than threading `posthog` into a financial module. This keeps analytics out of the financial core. [ASSUMED — see Open Questions]

### Pattern 4: INSTR-05 — Client-Side Events with `usePostHog()`

**What:** React hook from `posthog-js/react` gives access to the initialized PostHog instance.

**When to use:** In any `"use client"` component that is a descendant of `PostHogProvider`.

```typescript
// Source: posthog.com/docs/libraries/react [CITED]
// File: src/components/nav.tsx (addition)
import { usePostHog } from "posthog-js/react";
import { EVENT } from "@/lib/analytics/events";

// Inside MobileNav component:
const posthog = usePostHog();

// In the Link onClick handler:
<Link
  key={link.href}
  href={link.href}
  onClick={() => posthog?.capture(EVENT.FEATURE_TAB_VISITED, { tab: link.label.toLowerCase() })}
  // ... existing props
>
```

**Shortcut page — `useEffect` pattern:**
```typescript
// File: src/app/(tabs)/shortcut/client.tsx — inside ShortcutSetup component
import { usePostHog } from "posthog-js/react";
import { EVENT } from "@/lib/analytics/events";

const posthog = usePostHog();
useEffect(() => {
  posthog?.capture(EVENT.FEATURE_SHORTCUT_SETUP_VIEWED);
}, []); // fires once on mount
```

**Optional chaining is required:** `posthog?.capture(...)` — `usePostHog()` returns `undefined` if called outside a `PostHogProvider`, and can return the uninitialized instance during SSR hydration. [CITED: posthog.com/docs/libraries/react]

### Anti-Patterns to Avoid

- **Throwing from the analytics helper:** Any exception from PostHog must be swallowed in the catch block. Financial correctness and check-in logic must be unaffected by analytics failures.
- **Capturing events before DB success:** Always emit events AFTER the primary DB operation succeeds. A failed DB op that fires an analytics event creates phantom data in PostHog that never matches Supabase state.
- **Using `/ingest` as the host in posthog-node:** The `/ingest` path is a browser-side reverse proxy URL. `posthog-node` runs server-side and must use `https://eu.i.posthog.com` directly (EU region confirmed from `next.config.mjs`).
- **Module-level PostHog singleton in server code:** Next.js serverless functions reuse module scope across invocations; a singleton client can accumulate unflushed events and leak state between requests.
- **Calling `posthog.shutdown()` in short API routes unnecessarily:** The CONTEXT.md decision says only the cron route needs explicit shutdown. Adding it to every route adds latency (shutdown awaits flush). With `flushAt: 1` the event is sent immediately; shutdown is for final teardown only.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Event type safety | Ad-hoc string literals in capture calls | `EVENT.*` constants from `events.ts` | Typos create phantom events in PostHog that are unfindable; TypeScript catches mismatches |
| Analytics error isolation | try/catch at every call site | `captureServerEvent` helper with single catch | Consistent swallow pattern; no accidental throw propagation |
| Serverless flush | Custom retry/flush logic | `flushAt: 1, flushInterval: 0` + `shutdown()` | PostHog's own SDK handles batching and retry; hand-rolled logic creates duplicate events |
| Client-side PostHog access | `import posthog from 'posthog-js'` direct import in components | `usePostHog()` hook | Hook gives access to the initialized instance from `PostHogProvider`; direct import may be undefined during SSR |

---

## Integration Point Analysis

### INSTR-03: Invite Declined vs. Challenge Routes

The CONTEXT.md mentions "invite declined from a decline route" — the actual route is `src/app/api/challenges/respond/route.ts` which handles **both** accept and decline via `action: z.enum(["accept", "decline"])`. There is no separate decline route. The `groups/join` route uses a different flow (invite_code based).

| Event | Route | Trigger |
|-------|-------|---------|
| PACT_CREATED | `groups/create` POST | After `groups` + `group_members` insert succeeds |
| PACT_INVITE_ACCEPTED (via invitation) | `challenges/respond` POST, `action === "accept"` | After `group_members` insert for recipient succeeds |
| PACT_INVITE_ACCEPTED (via code) | `groups/join` POST | After `group_members` insert succeeds |
| PACT_INVITE_DECLINED | `challenges/respond` POST, `action === "decline"` | After invitation status set to "declined" |
| PACT_MEMBER_LEFT | `groups/leave` POST | After `group_members` delete succeeds (non-owner path) |

**Note:** `PACT_MEMBER_LEFT` should fire only for the non-owner delete path. The owner-delete path (`deleted_group: true`) deletes the entire group — this could also fire but is a different scenario. Emit `PACT_MEMBER_LEFT` with `{ role: membership.role }` property to distinguish.

### INSTR-04: Financial Events — Two Routes

| Event | Route | When |
|-------|-------|------|
| FINANCIAL_PENALTY_ISSUED | `cron/enforce/route.ts` (via runEnforcement) | `reconciled.status === "missed" && existing?.status !== "missed"` |
| FINANCIAL_SETTLEMENT_RECORDED | `settlements/route.ts` POST | After `settlements` insert + `obligations` status update succeed |

`FINANCIAL_SETTLEMENT_RECORDED` fires from `settlements/route.ts`, not from `cron/enforce`. The cron does not record settlements — it only enforces missed days into obligations. Settlements are a manual user action from the ledger UI.

### INSTR-02: Check-In Outcome Mapping

| Branch | Event | Properties |
|--------|-------|------------|
| Geo-fail early return (line ~141) | `CHECKIN_GEO_FAILED` | `{ method: body.source, distance_m: distance }` |
| Success — verified | `CHECKIN_SUBMITTED` | `{ outcome: "verified", method: body.source, distance_m: distance }` |
| Success — unverified | `CHECKIN_SUBMITTED` | `{ outcome: "unverified", method: body.source, distance_m: distance }` |

The `CHECKIN_VERIFIED` event constant in the catalog overlaps with the `CHECKIN_SUBMITTED` `outcome: "verified"` approach. Use `CHECKIN_SUBMITTED` with `outcome` property for all success-path submissions (both verified and unverified) and `CHECKIN_GEO_FAILED` for the early-return fail. This makes the PostHog funnel query: "users who submitted → users who verified" straightforward. [ASSUMED — see Open Questions]

---

## Common Pitfalls

### Pitfall 1: Vercel Teardown Drops Cron Events

**What goes wrong:** `runEnforcement` returns; the cron route sends a 200 response; Vercel tears down the function before the PostHog background flush completes. Financial events are lost.

**Why it happens:** `posthog-node` by default batches events and flushes them on a timer. The Vercel function lifetime ends before the timer fires.

**How to avoid:** `await posthog.shutdown()` in the cron route AFTER `runEnforcement` completes and BEFORE the `NextResponse.json()` return. Ensure this is in a `finally` block so it runs even on enforcement errors.

**Warning signs:** PostHog shows zero financial events despite cron running successfully.

### Pitfall 2: Event Fired Before DB Confirms

**What goes wrong:** `captureServerEvent` called before the DB upsert/insert is awaited and checked for errors. The operation fails (network error, constraint violation) but the event already fired — PostHog shows a pact_created event for a group that doesn't exist.

**Why it happens:** Fire-and-forget pattern applied to analytics too early in the route.

**How to avoid:** Always place `captureServerEvent` after the DB operation AND after the error check. Only fire when `error === null` and data is returned.

### Pitfall 3: `usePostHog()` Outside PostHogProvider

**What goes wrong:** Calling `usePostHog()` in a component that is not a descendant of `PostHogProvider` returns `null`/`undefined`. Calling `.capture()` on it throws a TypeError.

**Why it happens:** Component is used in a context outside the main app shell (e.g., error pages, test render without providers).

**How to avoid:** Always use optional chaining: `posthog?.capture(...)`. The `PostHogProvider` wraps all body children in the root layout — no standard page is outside it, but defensive coding prevents edge-case crashes.

### Pitfall 4: onboarding `WALKTHROUGH_COMPLETED` Fires on Every Replay

**What goes wrong:** User replays the tour; the route emits `ONBOARDING_WALKTHROUGH_COMPLETED` again because `data.completed_at` is set (from the original completion) and the check doesn't gate on the before/after transition.

**Why it happens:** The check only looks at the post-upsert value, not the transition.

**How to avoid:** Gate on transition: `data.completed_at && !existing?.completed_at`. The `existing` variable is already read before the upsert in the current route (the `SELECT` at the top of PATCH).

### Pitfall 5: Tab Events Fire on Initial Load

**What goes wrong:** Wrapping the nav Link in an onClick handler that fires even on the initial page load (e.g., if the onClick is on the parent rather than the Link itself).

**Why it happens:** Incorrect placement of the capture call.

**How to avoid:** Attach `onClick` to the `<Link>` element directly. The event only fires when the user actively clicks — not on navigation caused by `router.push()` from other code.

---

## Code Examples

### Complete `server.ts` helper

```typescript
// Source: posthog.com/docs/libraries/node (serverless section) [CITED]
// File: src/lib/analytics/server.ts
import { PostHog } from "posthog-node";
import type { EventName } from "@/lib/analytics/events";

export async function captureServerEvent(
  distinctId: string,
  event: EventName,
  properties?: Record<string, unknown>
): Promise<void> {
  try {
    const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!apiKey) return;
    const client = new PostHog(apiKey, {
      host: "https://eu.i.posthog.com", // EU region confirmed
      flushAt: 1,
      flushInterval: 0,
    });
    client.capture({ distinctId, event, properties });
    await client.shutdown();
  } catch {
    // Swallow — analytics must never interrupt business logic
  }
}
```

### onboarding-progress PATCH additions

```typescript
// After upsert succeeds, before revalidateTag():
if (parsed.data.complete_step) {
  await captureServerEvent(auth.user.id, EVENT.ONBOARDING_STEP_COMPLETED, {
    step_id: parsed.data.complete_step,
    tour_version: data.tour_version,
  });
}
if (data.completed_at && !existing?.completed_at) {
  await captureServerEvent(auth.user.id, EVENT.ONBOARDING_WALKTHROUGH_COMPLETED, {
    tour_version: data.tour_version,
  });
}
```

### cron/enforce shutdown pattern

```typescript
// cron/enforce/route.ts — inside handle()
const posthog = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "", {
  host: "https://eu.i.posthog.com", // EU region confirmed
  flushAt: 1,
  flushInterval: 0,
});
try {
  const result = await runEnforcement(admin, now);
  // Emit per-user penalty events here (using returned penalized_user_ids)
  // ...
  return NextResponse.json({ ok: result.errors === 0, ...result });
} finally {
  await posthog.shutdown(); // must run even on error
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| PostHog module-level singleton in serverless | Per-call `new PostHog()` instance | posthog-node v3+ | No state leakage across cold starts |
| `flushAt: 20` default | `flushAt: 1, flushInterval: 0` for serverless | Serverless best practice | Immediate delivery without batching delay |
| `posthog.shutdownAsync()` | `await posthog.shutdown()` | posthog-node v4+ | `shutdown()` is now async; `shutdownAsync()` was the v3 alias |

**Note:** `posthog.shutdownAsync()` was the older API name. In posthog-node v5, `shutdown()` returns a Promise — `await client.shutdown()` is correct. [ASSUMED — verify against installed v5.38.6 types]

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `posthog.shutdown()` is the correct v5 method name (not `shutdownAsync()`) | Code Examples, State of the Art | Will get TypeScript error at compile time — easy to fix |
| A2 | `CHECKIN_SUBMITTED` with `outcome` property is the right approach for verified/unverified (vs. separate CHECKIN_VERIFIED event constant) | Integration Point Analysis — INSTR-02 | If planner uses CHECKIN_VERIFIED as a separate event, dashboard queries need to account for two event names |
| A3 | Per-user penalty events are desirable (emitting one event per penalized user in the cron loop) vs. summary event with count | Integration Point Analysis — INSTR-04 | If per-user approach is wrong, enforcement.ts changes are not needed and a simpler summary event suffices |
| A4 | `runEnforcement` should return `penalized_user_ids` rather than threading posthog client into the financial module | Pattern 3 | If threading is preferred, enforcement.ts signature changes; isolation is different |

**PostHog region confirmed:** `next.config.mjs` rewrites use `eu.i.posthog.com` — EU region, not US. [VERIFIED: codebase] Removed from assumptions.

**Confirm before planning:** A2 (event strategy for check-ins), A3/A4 (penalty event per-user vs. summary).

---

## Open Questions

1. **CHECKIN_SUBMITTED vs. CHECKIN_VERIFIED for the verified outcome (A2)**
   - What we know: The EVENT catalog has both `CHECKIN_SUBMITTED` and `CHECKIN_VERIFIED`
   - What's unclear: Whether INSTR-02 expects one event with outcome property or separate events per outcome
   - Recommendation: Use `CHECKIN_SUBMITTED` (always fires) + CHECKIN_GEO_FAILED (early return) — simpler funnel analysis; CHECKIN_VERIFIED is redundant

2. **Per-user penalty events vs. summary (A3/A4)**
   - What we know: `runEnforcement` currently returns `{ scanned, penalized, skipped, errors }` — no per-user data
   - What's unclear: Whether the dashboard needs `user_id` on each penalty event
   - Recommendation: Return `penalized_user_ids: string[]` from `runEnforcement`; emit per-user events in cron route. This gives the most analytical value.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `posthog-node` | `server.ts` helper | ✓ | 5.38.6 | — |
| `posthog-js` | Client components via `usePostHog()` | ✓ | 1.395.0 | — |
| `NEXT_PUBLIC_POSTHOG_KEY` | All PostHog capture | Must be set in `.env.local` / Vercel | phc_xxx | Helper returns early if unset |
| `NEXT_PUBLIC_POSTHOG_HOST` | Client SDK (Phase 7) | ✓ `/ingest` | — | — |

**Missing dependencies with no fallback:** `NEXT_PUBLIC_POSTHOG_KEY` must be configured — events are silently no-ops without it (by design; does not block build or runtime).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.7 |
| Config file | `vitest.config.ts` |
| Quick run command | `npm test -- --reporter=verbose` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INSTR-01 | `captureServerEvent` called with correct event and props | unit (mock) | `npm test -- src/lib/analytics/server.test.ts` | ❌ Wave 0 |
| INSTR-01 | Event constant format validation | unit | `npm test -- src/lib/analytics/events.test.ts` | ✅ (exists) |
| INSTR-02 through INSTR-05 | Route/component integration | manual-only | n/a — API routes are not unit-tested per project convention | — |

**Note on project testing convention:** The project does NOT write unit tests for API route handlers (`route.ts` files). Only pure domain modules in `src/lib/` get unit tests. The `server.ts` helper is a `src/lib/` module and qualifies for a test.

### Wave 0 Gaps

- [ ] `src/lib/analytics/server.test.ts` — covers INSTR-01 (tests that helper calls PostHog capture with correct args, mocking `posthog-node`; tests that helper swallows errors; tests no-op when NEXT_PUBLIC_POSTHOG_KEY is unset)

*(Other requirements use manual verification per project convention)*

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Events fire after auth check in route — no new auth surface |
| V3 Session Management | no | No new session handling |
| V4 Access Control | no | Events fired server-side, gated by existing route auth |
| V5 Input Validation | yes | Event properties built from already-validated Zod-parsed inputs — no raw user input flows into PostHog properties |
| V6 Cryptography | no | NEXT_PUBLIC_POSTHOG_KEY is a write-only ingestion key; no decryption |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| PII in event properties | Information Disclosure | Only capture Supabase UUIDs (non-PII) and enum values (outcome, method, step_id) — no email, name, or location coordinates |
| PostHog write key exposure in server code | Information Disclosure | `NEXT_PUBLIC_POSTHOG_KEY` is already public (client-side SDK); no new secret exposure. Server does not use a private key |
| Analytics event spoofing | Tampering | Server-side events are authoritative (user cannot forge them); client-side events are feature-usage signals only (not financial-authoritative) |

**Security note:** The `NEXT_PUBLIC_POSTHOG_KEY` used in `posthog-node` is the same public project API key exposed in the browser SDK. It is a write-only ingestion key (no read permissions). Using it server-side is standard PostHog practice and creates no additional security surface. [CITED: posthog.com/docs/libraries/node]

---

## Sources

### Primary (MEDIUM confidence)
- `posthog.com/docs/libraries/node` — PostHog Node.js SDK: instantiation, capture, shutdown for serverless [CITED]
- `posthog.com/docs/libraries/next-js` — Next.js integration: server-side patterns, flushAt/flushInterval config [CITED]
- `posthog.com/docs/libraries/react` — React hook: `usePostHog()`, optional chaining requirement [CITED]

### Secondary (MEDIUM confidence)
- Existing Phase 7 research (`.planning/phases/07-analytics-foundation/07-RESEARCH.md`) — context7 fetched, posthog-js and posthog-node API verified
- Codebase inspection: `src/lib/analytics/events.ts`, `src/components/posthog-provider.tsx`, `src/components/posthog-identity.tsx` — confirmed existing Phase 7 deliverables

### Tertiary (LOW confidence)
- `posthog-node` v5 `shutdown()` method name (vs `shutdownAsync()`) tagged `[ASSUMED]` — verify against installed types

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — both packages installed, versions confirmed from package.json
- Architecture: HIGH — based on direct codebase inspection of all affected routes
- posthog-node API: MEDIUM — posthog.com/docs fetched but not verified against exact installed version
- Pitfalls: HIGH — based on official serverless guidance and codebase patterns

**Research date:** 2026-06-27
**Valid until:** 2026-07-27 (posthog-node v5 API stable; risk is minor version changes only)
