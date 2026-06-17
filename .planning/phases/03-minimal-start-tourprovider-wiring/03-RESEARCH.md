# Phase 3: Minimal Start & TourProvider Wiring - Research

**Researched:** 2026-06-17
**Domain:** Next.js 14 App Router RSC→client hydration, redirect-gate centralization, React context provider wiring (SweatPact / Supabase)
**Confidence:** HIGH

## Summary

Phase 3 is a **pure wiring phase against infrastructure that already exists**. The persistence
layer (`onboarding_progress` table, owner-only RLS, auto-provisioning trigger, `GET`/`PATCH`
`/api/onboarding-progress`, the `mergeProgress` pure merge) was built in Phase 1; the pure
decision logic (`steps.ts` registry, `TOUR_VERSION`, `completion.ts` probes, `TEACHING_KEYS`)
was built in Phase 2. Phase 3 does not need a migration, a new endpoint, or any new domain logic.
It does three things: (1) narrow the username/onboarding gate down to **username-only** and
centralize it in `(tabs)/layout.tsx`, (2) delete the now-redundant per-page redirects from 8 tab
pages, and (3) introduce the codebase's **first React context provider** — `TourProvider` —
server-hydrated from the RSC layout and rendering only `{children}`.

The single highest-value research finding contradicts the literal wording of CONTEXT D-04. CONTEXT
says the layout "calls `GET /api/onboarding-progress` server-side." The established codebase
convention is the opposite: **RSC pages read the database directly** (dashboard reads `user_gyms`,
`GymOnboarding` page reads `user_gyms`) and **only client components call `fetch("/api/...")`.**
There is zero precedent in this codebase for a Server Component fetching its own internal API route,
and doing so is a known Next.js anti-pattern (absolute-URL construction + manual cookie forwarding,
both of which `getViewerProfile`'s request-cached admin read already sidesteps). The plan should
hydrate `initialProgress` via a **direct, request-cached DB read inside the layout**, matching the
`GymOnboarding({ initialGymCount })` precedent that CONTEXT itself names as the analog — not via a
self-`fetch`. The PATCH writes from `advance()`/`dismiss()` are correctly client-side `fetch` calls.

**Primary recommendation:** Add a request-cached server reader `getOnboardingProgress()` next to
`getViewerProfile()` in `src/lib/supabase/rsc.ts` (admin client, scoped to `auth.user.id`,
returning the Phase-1 `ProgressRow` shape or `null` on failure). The layout calls it once, passes
the result to `<TourProvider initialProgress={…}>`. `TourProvider` is a `"use client"` context
provider that derives `currentStepId` purely from `completion.ts` + `steps.ts`, persists via
client `PATCH /api/onboarding-progress`, and renders `{children}` only.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Gate cleanup**
- **D-01:** Centralize the gate in `(tabs)/layout.tsx`. An explicit async gate (awaited before
  Suspense slots render) calls `getViewerProfile()` (request-cached — zero extra round trip). If
  the profile is missing or the username is auto-generated (`/^user_[a-f0-9]{8}$/`), redirect to
  `/onboarding/username`. This is the ONLY username redirect gate going forward.
- **D-02:** Remove the `onboarding_complete` check entirely. The `!profile.onboarding_complete →
  redirect("/onboarding/schedule")` lines are deleted from all tab pages. Users with optional setup
  incomplete land in the real app.
- **D-03:** Trust the layout — remove per-page redirects from `dashboard`, `groups`, `groups/[id]`,
  `cycle`, `notifications`, `settings`, `u/me`, `u/[username]`. The layout gate is the single source
  of truth. No per-page safety net.

**Server hydration**
- **D-04:** Layout fetches progress server-side and passes it as the `initialProgress` prop to
  `<TourProvider>`. Consumers receive pre-hydrated state — no `useEffect` fetch, no flash. Matches
  the `initialGymCount` pattern in `GymOnboarding`. *(See "State of the Art" / "Common Pitfalls" —
  research recommends a direct request-cached DB read, NOT a self-fetch of the API route.)*
- **D-05:** `TourProvider` wraps `{children}` in the layout, mounted between the nav shell and page
  content so all tab routes can call `useTour()`.
- **D-06:** Fetch failure → silent no-op. If the server-side read fails (network/401/null),
  `initialProgress` is `null`; the provider treats this as a blank slate (`dismissed: false`,
  `completed_steps: []`). The tour simply never activates. The app remains fully usable.

**TourProvider context API**
- **D-07:** Minimal surface. `useTour()` returns `currentStepId: string | null`, `isActive: boolean`,
  `advance(stepId: string): Promise<void>`, `dismiss(): Promise<void>`. No other members
  (`isComplete`/`progress` are deliberately deferred to Phase 4+).
- **D-08:** TourProvider owns persistence writes. `advance()` and `dismiss()` call
  `PATCH /api/onboarding-progress` internally with optimistic state update.
- **D-09:** `currentStepId` is derived from the Phase-2 probes. On init and after each `advance()`,
  TourProvider walks the ordered `STEPS` registry to find the first step not in `completed_steps`
  and not auto-skippable (via `completion.ts` probes). Single source of truth — same probes Phase 6
  replay will use.

**Skip / dismiss**
- **D-10:** One exit action — `dismiss()`. No step-level skip in Phase 3. The single affordance
  (copy decided in Phase 4) calls `dismiss()`, which PATCHes `dismissed: true`. Tour hides
  immediately; the app keeps working.
- **D-11:** Dismissal is replayable. `dismissed: true` hides the walkthrough until explicitly reset.
  Phase 6 adds the Settings reset (`dismissed: false`, `last_step_id: null`). Phase 3 only needs to
  persist `dismissed: true` correctly.

### Claude's Discretion
None — the discussion log records "all gray areas had clear user preferences." Claude's only
latitude is *how* to implement the locked decisions (e.g., the direct-DB-read vs self-fetch
mechanism for D-04, the exact file/type shapes), staying within the conventions below.

### Deferred Ideas (OUT OF SCOPE)
- **Coachmark / spotlight UI** — Phase 4. TourProvider is wired; nothing renders a coachmark.
- **Cross-route navigate-then-reveal** — Phase 5.
- **Replay Settings entry** (reset `dismissed: false`) — Phase 6.
- **`tour_version` drift handling on replay** — Phase 6.
- **Skip-already-done auto-skip *UX*** (showing the user they're being skipped) — Phase 6. Phase 3
  wires the probes into `currentStepId` derivation, but the end-to-end auto-skip experience is later.
- **`isComplete` and full `progress` shape in context** — Phase 4+ (after the coachmark library is
  picked), to avoid premature API lock.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **ONB-01** | New user completes a username-only mandatory start and lands directly in the real app | The existing `/onboarding/username` page already enforces username-only (parity-locked, see UI-SPEC). The layout gate (D-01) sends users there only when username is missing/auto. Removing the `onboarding_complete → /onboarding/schedule` redirect (D-02) is what makes them "land directly" — verified the redirect exists in all 8 pages today. |
| **ONB-02** | The `(tabs)` redirect gate no longer forces the full setup wizard — only a missing username redirects | Confirmed all 8 tab pages currently carry BOTH a username redirect and an `onboarding_complete → /onboarding/schedule` redirect. Plan deletes the `onboarding_complete` redirect everywhere and consolidates the username redirect into the layout. `cycle/page.tsx` has an ADDITIONAL `gender !== "female" → /dashboard` redirect that is functional, not onboarding — must be preserved. |
| **ONB-04** | User can skip the walkthrough at any step without being blocked or nagged, and keep using the app | `dismiss()` (D-10) PATCHes `dismissed: true` against the Phase-1 endpoint; the merge in `mergeProgress` persists it. On reload, `initialProgress.dismissed === true` ⇒ provider yields `currentStepId: null`, `isActive: false` — never re-prompts. Persistence path verified end-to-end (table → RLS → merge → GET). |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Username-only redirect gate | Frontend Server (RSC layout) | — | `redirect()` must run server-side before any client render; centralizing in the layout (D-01) means it runs once per navigation for all tab routes. Middleware is NOT used for this (middleware here only refreshes the session cookie; it has no profile read). |
| Progress hydration (read) | Frontend Server (RSC layout) | Database (RLS) | RSC reads the owner's `onboarding_progress` row directly (request-cached) and passes it as a prop — the no-flash guarantee requires the data be present at first server render. |
| Progress derivation (`currentStepId`) | Browser / Client (TourProvider) | — | Pure client computation over `completion.ts` + `steps.ts`; no server round trip after hydration (D-09). |
| Progress persistence (write) | Browser / Client → API | API + Database | `advance()`/`dismiss()` call `PATCH /api/onboarding-progress` (client `fetch`); the route is server-authoritative (`mergeProgress`, RLS-scoped upsert). |
| Tour state distribution | Browser / Client (React Context) | — | `useTour()` is consumed by Phase 4+ coachmarks across tab routes — context is the correct distribution mechanism. |

## Standard Stack

This phase introduces **no new packages**. Everything needed is already installed and in use.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 14.2.35 | App Router RSC, `redirect()`, RSC→client prop hydration | Established framework [VERIFIED: package.json / CLAUDE.md] |
| react | 18.3.1 | `createContext`/`useContext`/`useState` for TourProvider | Established [VERIFIED: package.json] |
| @supabase/supabase-js | 2.45.4 | DB read for hydration (via admin client in rsc.ts) | Established data layer [VERIFIED: package.json] |
| zod | 3.23.8 | Already validates the PATCH body (`PatchBody`, Phase 1) | Mandated at every API boundary [VERIFIED: CLAUDE.md] |
| vitest | 4.1.7 | Unit tests for any pure derivation helper extracted in this phase | Established test runner [VERIFIED: vitest.config.ts] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none) | — | — | No supporting libraries are needed. A coachmark/tour library (react-joyride v3 vs Onborda/NextStep) is a **Phase 4** decision per ROADMAP line 114 — do NOT install one here. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Direct request-cached DB read for hydration | RSC `fetch("/api/onboarding-progress")` (literal D-04 wording) | The self-fetch needs an absolute URL + manual cookie forwarding and has no precedent in this codebase. The direct read mirrors `getViewerProfile` and the `initialGymCount` analog. **Recommend direct read.** See Common Pitfalls #1. |
| React Context provider | Module-level store / Zustand / Jotai | Context is the idiomatic, zero-dependency choice for a layout-scoped provider consumed by descendants. No state library is installed; adding one is unjustified for this surface. |

**Installation:** None — no `npm install` in this phase.

## Package Legitimacy Audit

> Not applicable. This phase installs **no external packages**. All dependencies are pre-existing
> and already audited as part of the shipped v1.0 baseline.

## Architecture Patterns

### System Architecture Diagram

```
  Browser navigation to any /(tabs)/* route
                │
                ▼
   middleware.ts ── refreshes Supabase session cookie ONLY (no profile read, no gate)
                │
                ▼
   src/app/(tabs)/layout.tsx  (RSC, force-dynamic)
                │
                ├─(1) GATE ─────────────────────────────────────────────┐
                │     await getViewerProfile()  [request-cached]          │
                │     if (!profile || isAutoUsername(profile.username))   │
                │         redirect("/onboarding/username")  ──────────────┼──▶ /onboarding/username
                │     (NO onboarding_complete check — deleted, D-02)       │     (parity-locked page)
                │                                                          │
                ├─(2) HYDRATE ───────────────────────────────────────────┘
                │     const initialProgress = await getOnboardingProgress()
                │         │   [request-cached admin read, scoped to user_id]
                │         │   returns ProgressRow | null  (null on any failure → D-06)
                │         ▼
                │     reads public.onboarding_progress  ◀── owner-only RLS / always-present row
                │
                ▼
   <Suspense><TopBar/></Suspense>          (nav shell — unchanged)
   <header-height spacer aria-hidden/>      (unchanged)
   <TourProvider initialProgress={…}>       ◀── NEW: "use client" context provider
        {children}                          (the page RSC — per-page redirects removed)
   </TourProvider>
   <Suspense><BottomBar/></Suspense>        (unchanged)
                │
                ▼ (client, after hydration)
   useTour() consumers (Phase 4+ coachmarks)
        currentStepId  = deriveCurrentStep(completed_steps, dismissed, probeState)
                          └─ walks STEPS (steps.ts), skips probe-done steps (completion.ts)
        advance(stepId) ─▶ optimistic setState ─▶ fetch PATCH {complete_step, last_step_id}
        dismiss()       ─▶ optimistic setState ─▶ fetch PATCH {dismissed: true}
```

### Recommended Project Structure
```
src/
├── app/(tabs)/layout.tsx            # MODIFY: add gate + hydration read + TourProvider mount
├── app/(tabs)/<8 pages>/page.tsx    # MODIFY: delete username + onboarding_complete redirects
├── components/tour-provider.tsx     # NEW: "use client" context provider + useTour() hook
├── lib/supabase/rsc.ts              # MODIFY: add getOnboardingProgress() request-cached reader
└── lib/onboarding/
    ├── steps.ts                     # REUSE (Phase 2) — ordered registry + TOUR_VERSION
    ├── completion.ts                # REUSE (Phase 2) — pure probes
    └── current-step.ts (optional)   # NEW (optional): pure deriveCurrentStep() so it is .test.ts-able
```

### Pattern 1: RSC reads DB directly, passes initial state to a `"use client"` child
**What:** The Server Component fetches data via a Supabase client and hands it to a client child as
a prop. The client child seeds `useState` from the prop — no `useEffect` fetch, no flash.
**When to use:** Every hydration-on-first-paint case in this codebase. This is THE canonical pattern
CONTEXT names for `TourProvider`.
**Example:**
```tsx
// Source: src/app/onboarding/gym/page.tsx:27-55 + client.tsx + components/onboarding/gym-surface.tsx
// RSC reads the DB directly...
const { data: gyms } = await supabase.from("user_gyms").select("id, name").eq("user_id", auth.user.id);
return <GymOnboarding initialGymCount={gyms?.length ?? 0} />;

// ...client seeds state from the prop — no useEffect fetch:
"use client";
export function GymSurface({ initialGymCount }: { initialGymCount: number }) {
  const [count, setCount] = useState(initialGymCount);  // pre-hydrated, no flash
  // ...
}
```

### Pattern 2: Request-cached RSC reader (avoids duplicate round trips)
**What:** Wrap a Supabase read in React `cache()` so the layout and the page it wraps share one
query within a single RSC render pass.
**When to use:** `getOnboardingProgress()` should follow this exactly, mirroring `getViewerProfile`.
**Example:**
```tsx
// Source: src/lib/supabase/rsc.ts:21-36 (getViewerProfile pattern to mirror)
export const getOnboardingProgress = cache(async () => {
  const user = await getAuthUser();        // already request-cached
  if (!user) return null;
  const { data } = await createAdminClient()      // owner's row only — scoped to user.id, safe
    .from("onboarding_progress")
    .select("mandatory_done, tour_version, last_step_id, completed_steps, dismissed, completed_at")
    .eq("user_id", user.id)
    .maybeSingle();
  return data ?? null;                       // null → D-06 blank-slate handling in provider
});
```

### Pattern 3: Client component writes via `fetch("/api/…")`
**What:** Mutations go through the client `fetch` → Zod-validated route → server-authoritative
upsert. Optimistic local state update first, then `fetch` (best-effort for an optional walkthrough).
**When to use:** `advance()` and `dismiss()` (D-08). Mirrors every other mutation in the app
(`/api/profile`, `/api/gyms`, `/api/settlements`, etc.).
**Example:**
```tsx
// Source: src/app/(tabs)/shortcut/client.tsx:71, gym-surface.tsx:73-77 (fetch-mutation shape)
await fetch("/api/onboarding-progress", {
  method: "PATCH",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ complete_step: stepId, last_step_id: stepId }),
}).catch(() => {});   // best-effort; optimistic state already applied (D-08, optional surface)
```

### Pattern 4: First React context provider in the codebase
**What:** There is currently **no** `createContext`/`useContext` anywhere in `src/`. TourProvider
establishes the pattern. Standard shape: a typed context, a `"use client"` provider that owns state
and renders `{children}` (no markup), and a `useTour()` hook that throws if used outside the
provider.
**When to use:** This phase. Keep it minimal (D-07).
```tsx
// New pattern (no in-repo precedent — verified via grep: zero createContext usages)
"use client";
const TourContext = createContext<TourValue | null>(null);
export function TourProvider({ initialProgress, children }: { initialProgress: ProgressRow | null; children: React.ReactNode }) {
  const [progress, setProgress] = useState(initialProgress ?? blankSlate());
  // ...derive currentStepId, isActive; define advance/dismiss
  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}
export function useTour() {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error("useTour must be used within TourProvider");
  return ctx;
}
```

### Anti-Patterns to Avoid
- **RSC self-fetching its own API route** (`fetch("/api/onboarding-progress")` from the layout):
  no precedent here, requires absolute URL + manual cookie forwarding, and adds a network hop to a
  read the RSC can do directly. Use the direct request-cached DB read instead.
- **`useEffect`-based client fetch in TourProvider:** defeats the no-flash guarantee (D-04). State
  must seed from `initialProgress`.
- **Keeping a per-page username/onboarding redirect "just in case":** explicitly rejected (D-03,
  discussion log "Trust the layout"). Leaving any in place creates two sources of truth and can
  re-introduce the wizard bounce after D-02.
- **Deriving `currentStepId` from `last_step_id` alone:** rejected (D-09 / discussion log). It
  bypasses the probes and breaks auto-skip; walk the registry with probes instead.
- **Adding `isComplete`/`progress`/`skip()`/`goTo()` to `useTour()` now:** out of scope (D-07,
  UI-SPEC "Deliberately deferred"). Freeze the 4-member surface exactly.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dedupe-append to `completed_steps` | A custom array-merge on the client | The Phase-1 `mergeProgress` + server upsert (already idempotent) | Server is authoritative; client just sends `complete_step`. Replaying the same key is already a no-op. |
| "Is the tour complete?" | A new boolean column / client check | `isTourComplete(completed_steps)` from `completion.ts` | Single source of truth; reuses `TEACHING_KEYS`. (Note: not strictly needed in Phase 3, but available.) |
| "Which step is next?" ordering | Hardcoded step list in the provider | Walk `STEPS` from `steps.ts` (`as const`, frozen) | Registry is the ordered source of truth; Phase 6 replay reuses the same walk. |
| Auth + owner-scoped read | New Supabase client + `getUser()` in the provider | `getViewerProfile`/`getAuthUser` request-cached pattern in `rsc.ts` | Avoids duplicate auth round trips within the RSC pass. |
| Username "is it auto-generated?" check | Re-deriving the regex inline | Reuse/extract `isAutoUsername` (`/^user_[a-f0-9]{8}$/`) from username page | Identical logic already lives in `onboarding/username/page.tsx:11`; keep one definition. |

**Key insight:** Phase 3 builds almost no new logic — it *connects* Phase-1 persistence to Phase-2
pure logic through a thin client provider and a narrowed gate. The temptation to re-implement merge,
completion, or step-ordering logic locally must be resisted; all of it exists and is unit-tested.

## Common Pitfalls

### Pitfall 1: Following D-04's literal "fetch GET /api/… server-side" wording
**What goes wrong:** A Server Component that calls `fetch("/api/onboarding-progress")` needs an
absolute URL (relative URLs fail in RSC fetch) and must manually forward the session cookie via
`headers()`/`cookies()`, or the route returns 401 and hydration silently falls to the blank slate
on every load (tour never activates even when it should).
**Why it happens:** Taking D-04's prose literally instead of matching the named analog
(`initialGymCount`), which reads the DB directly.
**How to avoid:** Implement hydration as a direct request-cached DB read (`getOnboardingProgress`),
not a self-fetch. The PATCH writes stay client-side `fetch` (those are correct).
**Warning signs:** `process.env.NEXT_PUBLIC_SITE_URL` appearing in the layout; 401s in dev when
loading a tab route; `initialProgress` always `null` for logged-in users.

### Pitfall 2: Gate timing — redirect must run before Suspense slots stream
**What goes wrong:** If the gate is buried inside a Suspense child (like `getNavProfile` in
`TopBar`), the nav can flash for a user who is about to be redirected.
**Why it happens:** The current layout only reads the profile inside the streamed `TopBar`/`BottomBar`.
**How to avoid:** Add an explicit `await getViewerProfile()` + `redirect()` at the top of the layout
component body, before the JSX returns the Suspense slots (D-01, discussion: "Add explicit gate
before Suspense"). The current `TabsLayout` is a **synchronous** function — it must become `async`
to await the gate and the hydration read.
**Warning signs:** Brief nav render before redirect; `redirect()` "called after response started"
style warnings.

### Pitfall 3: Re-throwing `redirect()` inside the dashboard/cycle try/catch
**What goes wrong:** `dashboard/page.tsx` and `cycle/page.tsx` wrap their body in `try/catch` and
explicitly re-throw `NEXT_REDIRECT` digests (dashboard lines 242-253). When the per-page redirects
are removed, this re-throw guard becomes dead weight but is harmless — verify nothing else relies on
the removed redirect being inside the try.
**Why it happens:** Mechanical deletion may leave the try/catch expecting a redirect that no longer
fires.
**How to avoid:** Remove only the username + `onboarding_complete` redirect lines; leave the
try/catch and the functional `cycle` gender redirect intact. Do not remove `if (!profile)
redirect("/login")` — that is an auth guard, not an onboarding gate, and the layout's
`getViewerProfile`→`/login` already covers it but pages may still read `profile` non-null.
**Warning signs:** TypeScript "possibly null" errors after deleting the `if (!profile)` line; the
cycle page rendering for male users.

### Pitfall 4: `cycle/page.tsx` has an extra non-onboarding redirect
**What goes wrong:** Blanket-deleting "all redirects" in cycle would remove
`if (profile.gender !== "female") redirect("/dashboard")` (line 24-26), breaking the cycle tab's
gender gating.
**Why it happens:** It sits adjacent to the onboarding redirects.
**How to avoid:** Delete ONLY the username (lines 18-20) and `onboarding_complete` (21-23) redirects;
preserve the gender redirect. Likewise `u/me/page.tsx` ends in a functional
`redirect(\`/u/\${profile.username}\`)` that must stay.
**Warning signs:** Cycle page accessible to male users; `/u/me` no longer resolving.

### Pitfall 5: TourProvider must render `{children}` with no wrapper element
**What goes wrong:** Wrapping `{children}` in a `<div>` changes the `(tabs)` layout flow (the
`aria-hidden` header spacer + page content assume direct children). UI-SPEC explicitly forbids any
wrapper, padding, or margin.
**Why it happens:** Habit of wrapping provider children in markup.
**How to avoid:** `return <TourContext.Provider value={…}>{children}</TourContext.Provider>` — the
`Provider` is not a DOM element, so layout is unaffected.
**Warning signs:** Spacing shift below the fixed header; failing UI-SPEC preservation checklist.

### Pitfall 6: Vitest only collects `src/**/*.test.ts` (NOT `.tsx`)
**What goes wrong:** A `tour-provider.test.tsx` rendering test would not be picked up by the runner
(`include: ["src/**/*.test.ts"]`).
**Why it happens:** Config restricts to `.ts`; the project tests pure logic, not components.
**How to avoid:** Keep the testable derivation logic pure and in a `.ts` file (e.g.
`deriveCurrentStep` in `src/lib/onboarding/current-step.ts`) with a co-located `*.test.ts`. Don't
plan a component-render test for TourProvider — it would silently not run. (Project convention:
route handlers and components are untested; pure `src/lib/*` logic is unit-tested.)
**Warning signs:** A new `.tsx` test that "passes" because it never executed.

## Runtime State Inventory

> This is a refactor-adjacent phase (deleting redirects, narrowing a gate). Inventory of runtime
> state that a file-level grep would miss:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `public.onboarding_progress` rows already exist for every profile (Phase-1 backfill + `handle_new_user` trigger, migration 0030). `profiles.onboarding_complete` (migration 0014) still exists and is still SELECTed by `getViewerProfile` (rsc.ts:31). | **No data migration.** Phase 3 stops *reading* `onboarding_complete` for gating (D-02) but does not drop the column. Leave the column; Phase 6 owns any cleanup. |
| Live service config | None. No external service (n8n, Datadog, scheduler) embeds onboarding/gate state. The Vercel cron (`/api/cron/enforce`) is unrelated. | None. |
| OS-registered state | None. | None — verified: no OS-level registration references onboarding. |
| Secrets / env vars | None added or renamed. No new env var is needed (hydration is a DB read, not a self-fetch requiring `SITE_URL`). | None. |
| Build artifacts | None. No package install, no codegen. | None. |

**The canonical question — after all files are updated, what still references the old gate?**
The `onboarding_complete` column persists in the DB and in `getViewerProfile`'s SELECT list, but
nothing in `(tabs)` reads it for gating anymore. The legacy `/onboarding/*` routes (`username`,
`gym`, `schedule`, `shortcut`) still self-redirect using `onboarding_complete` (e.g.
`gym/page.tsx:25 if (profile.onboarding_complete) redirect("/dashboard")`) — **these are out of
scope for Phase 3** (ROADMAP Phase 6 success criterion 4: "legacy `/onboarding/*` redirect chain is
cleaned up"). Do not touch them here.

## Code Examples

### Narrowed, centralized gate in the async layout
```tsx
// Target: src/app/(tabs)/layout.tsx (must become async)
// Source pattern: getNavProfile (layout.tsx:11-15) + isAutoUsername (username/page.tsx:11)
export default async function TabsLayout({ children }: { children: React.ReactNode }) {
  const profile = await getViewerProfile();                       // request-cached
  if (!profile || isAutoUsername(profile.username)) {
    redirect("/onboarding/username");                             // D-01 — only username gate
  }                                                              // (NO onboarding_complete check — D-02)
  const initialProgress = await getOnboardingProgress();         // request-cached DB read; null on failure (D-06)
  return (
    <>
      <RefreshOnFocus />
      <Suspense fallback={<TopNav />}><TopBar /></Suspense>
      <div aria-hidden="true" style={{ height: "calc(max(env(safe-area-inset-top), 0.75rem) + 3.5rem)" }} />
      <TourProvider initialProgress={initialProgress}>{children}</TourProvider>   {/* D-05 */}
      <Suspense fallback={<MobileNav />}><BottomBar /></Suspense>
    </>
  );
}
```

### Pure step derivation (testable in a `.ts` file)
```ts
// Suggested: src/lib/onboarding/current-step.ts  (co-located current-step.test.ts)
// Reuses STEPS (steps.ts) + the completion probes (completion.ts) — no new logic invented.
import { STEPS } from "@/lib/onboarding/steps";
import { isGymDone, isScheduleDone, isShortcutDone } from "@/lib/onboarding/completion";

type ProbeState = { gymCount: number; restDays: number[]; completedSteps: string[] };

export function deriveCurrentStep(
  completedSteps: string[],
  dismissed: boolean,
  probe: ProbeState
): string | null {
  if (dismissed) return null;                                    // D-10 / ONB-04
  for (const step of STEPS) {
    if (completedSteps.includes(step.id)) continue;              // already advanced
    if (step.probe === "gym" && isGymDone(probe.gymCount)) continue;          // auto-skip (D-09)
    if (step.probe === "schedule" && isScheduleDone(probe.restDays)) continue;
    if (step.probe === "shortcut" && isShortcutDone(probe.completedSteps)) continue;
    return step.id;                                              // first pending, non-skippable
  }
  return null;                                                   // complete
}
```
*Note on probe inputs:* the auto-skip probes need `gymCount` and `restDays`, which are NOT in the
`onboarding_progress` row. In Phase 3 (no coachmark renders yet) it is acceptable to derive
`currentStepId` from `completed_steps` + `dismissed` alone and feed empty/neutral probe state, OR to
additionally pass `profile.rest_days` and a gym count from the layout into TourProvider. The plan
should pick one and state it; the full auto-skip *UX* is Phase 6 (deferred). Keeping `deriveCurrentStep`
pure lets either choice be unit-tested.

### dismiss() — the one exit action
```tsx
// Inside TourProvider (D-08, D-10)
async function dismiss() {
  setProgress((p) => ({ ...p, dismissed: true }));               // optimistic — isActive→false immediately
  await fetch("/api/onboarding-progress", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ dismissed: true }),
  }).catch(() => {});                                            // best-effort (optional surface)
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Per-page username + `onboarding_complete` redirects (8 pages) bouncing new users to a 4-screen wizard | Single username-only gate in `(tabs)/layout.tsx`; optional setup deferred to the contextual walkthrough | This phase (v1.1) | Users land in the real app immediately (ONB-01/02). |
| `onboarding_complete` boolean as the "setup done" flag | Server-side `onboarding_progress` row + pure completion probes derived from real state | Phases 1-2 (already shipped) | Phase 3 consumes this; `onboarding_complete` column is now legacy (kept, not dropped). |
| RSC self-fetching internal API routes | RSC reads DB directly, client components `fetch` routes | Established codebase convention | Hydration via direct read, not self-fetch (see Pitfall 1). |

**Deprecated/outdated (relative to this milestone, do not extend):**
- The `/onboarding/schedule` forced redirect — being removed (D-02).
- Treating `onboarding_complete` as the gate — replaced by username-only + walkthrough.
- (Reference) `react-joyride v2`/`react-tour` legacy — irrelevant here; tour library is a Phase 4
  decision and must NOT be introduced in Phase 3.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The plan should hydrate via a direct request-cached DB read rather than the literal "fetch GET /api/… server-side" wording of D-04 | Summary / Pitfall 1 | If the user truly wants a self-fetch, the plan needs absolute-URL + cookie-forwarding handling. Recommend confirming in planning; the direct read satisfies the same observable contract (pre-hydrated, no flash) and matches the named `initialGymCount` analog, so risk is low but it is a deviation from literal prose. |
| A2 | `deriveCurrentStep` may use empty/neutral probe state in Phase 3 since no coachmark renders and full auto-skip UX is deferred to Phase 6 | Code Examples (note) | If success criterion 3 ("resumes at the same point") is interpreted to require probe-accurate auto-skip in Phase 3, the layout must also pass `rest_days` + gym count into the provider. Flag for planner to decide; both options are cheap. |
| A3 | The `onboarding_complete` column and its SELECT in `getViewerProfile` should be left untouched in Phase 3 | Runtime State Inventory | Dropping the SELECT could break other readers; ROADMAP assigns legacy-route/`onboarding_complete` cleanup to Phase 6. Leaving it is the conservative, in-scope choice. |

## Open Questions

1. **Probe inputs for `currentStepId` in Phase 3 (A2).**
   - What we know: probes need `gymCount` + `restDays`, not present in the progress row.
   - What's unclear: whether Phase 3's "resume at same point" requires probe-accurate auto-skip now,
     or only `completed_steps`/`dismissed`-based resume (full auto-skip UX is Phase 6).
   - Recommendation: implement resume from `completed_steps` + `dismissed`; keep `deriveCurrentStep`
     pure and probe-aware so Phase 6 needs no refactor. Planner confirms whether to also thread
     `rest_days`/gym count from the layout.

2. **Self-fetch vs direct read for hydration (A1).**
   - What we know: codebase convention is direct read; CONTEXT prose says "fetch GET … server-side."
   - What's unclear: whether the prose is prescriptive or descriptive.
   - Recommendation: direct request-cached read (`getOnboardingProgress`). Note the deviation in the
     plan so the reviewer sees it is intentional and contract-equivalent.

## Environment Availability

> No new external dependencies. This phase is code-only (gate narrowing + provider wiring) against
> already-provisioned Supabase infrastructure. The `onboarding_progress` table, RLS, trigger, and
> `/api/onboarding-progress` route are live (Phase 1). Section otherwise N/A.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase `onboarding_progress` table + RLS + trigger | Hydration read & PATCH writes | ✓ (Phase 1, migration 0030) | — | — |
| `GET`/`PATCH /api/onboarding-progress` | dismiss/advance writes | ✓ (Phase 1) | — | — |
| `lib/onboarding/steps.ts` + `completion.ts` | `currentStepId` derivation | ✓ (Phase 2) | — | — |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None.

## Validation Architecture

> `workflow.nyquist_validation` not found disabled in config — section included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.7 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run src/lib/onboarding/current-step.test.ts` |
| Full suite command | `npm test` (runs vitest with the threads pool per the npm script) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ONB-01 | New user with only a username lands in the app (no wizard) | manual / UAT | n/a (RSC redirect behavior — verified via UAT) | ❌ manual |
| ONB-02 | Gate redirects only on missing/auto username; no `onboarding_complete` bounce | manual / UAT + static check | grep confirms `onboarding_complete` redirect removed from all 8 pages | ❌ manual |
| ONB-04 | Dismiss persists; reload does not re-prompt | unit (derivation) + UAT | `deriveCurrentStep([...], dismissed=true, …)` returns `null` → `npx vitest run src/lib/onboarding/current-step.test.ts` | ❌ Wave 0 |
| ONB-04 | `currentStepId` resumes at first pending step after reload | unit (derivation) | same command | ❌ Wave 0 |

*Gate redirects and provider rendering are RSC/component behavior — per project convention (route
handlers and components untested), these are validated via UAT, not automated tests. The pure
`deriveCurrentStep` logic is the unit-testable seam.*

### Sampling Rate
- **Per task commit:** `npx vitest run src/lib/onboarding/current-step.test.ts` (if the pure helper
  is created)
- **Per wave merge:** `npm test` (full pure-logic suite — steps/completion/merge already covered)
- **Phase gate:** `npm test` green + `tsc --noEmit` (strict) + manual UAT of the 4 success criteria
  before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `src/lib/onboarding/current-step.test.ts` — covers ONB-04 resume/dismiss derivation (only if
      `deriveCurrentStep` is extracted as a pure helper — recommended).
- [ ] No framework install needed — Vitest is configured and in use.

*If the plan inlines derivation inside the provider instead of a pure helper, there is no
automated-test seam and ONB-04 falls back to UAT-only — extracting the pure helper is the
recommended path so the resume/dismiss logic is unit-covered.*

## Security Domain

> `security_enforcement` not disabled in config — section included. This phase adds no new attack
> surface; persistence already enforces the controls below (Phase 1).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Layout gate + route handlers call `supabase.auth.getUser()`; unauthenticated → `/login` (layout) or 401 (route). |
| V3 Session Management | yes | Session cookie refreshed in `middleware.ts` on every request (unchanged). |
| V4 Access Control | yes | **Owner-only RLS** on `onboarding_progress` (migration 0030: select/insert/update/delete all `auth.uid() = user_id`). The hydration read uses the admin client strictly scoped to `auth.user.id` (same justified pattern as `getViewerProfile`). |
| V5 Input Validation | yes | `PatchBody` Zod schema (`.strict()`, `STEP_KEY_REGEX`) on every PATCH — already enforced (Phase 1). `advance()`/`dismiss()` send only validated shapes. |
| V6 Cryptography | no | No crypto in this phase. |

### Known Threat Patterns for Next.js RSC + Supabase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Client forging another user's progress | Tampering / Elevation | RLS pins writes to `auth.uid()`; route ignores any client-sent `user_id` and pins to `auth.user.id`. Already in place. |
| Smuggling extra columns via PATCH | Tampering | `PatchBody.strict()` rejects unknown fields (Phase 1). |
| Admin-client read leaking other users' rows | Information Disclosure | Read is `.eq("user_id", user.id)` — scoped to the authenticated user only (mirrors `getViewerProfile`). Do NOT widen the filter. |
| Gate bypass leaving a user wizard-trapped or in a half-set state | (functional, not security) | Single layout gate (D-01); no per-page divergence (D-03). |

**Note:** Because the layout's hydration read uses the **service-role admin client** (to read its
own row past the post-0029 column lockdown, same as `getViewerProfile`), the `getOnboardingProgress`
filter MUST remain strictly `.eq("user_id", user.id)`. This is the single security-critical line in
the phase — call it out in the plan's verification.

## Sources

### Primary (HIGH confidence)
- `src/app/(tabs)/layout.tsx` — current gate/Suspense structure; must become async [VERIFIED: read]
- `src/app/api/onboarding-progress/route.ts` — GET/PATCH shape, auth, server-authoritative merge [VERIFIED: read]
- `src/lib/onboarding-progress.ts` — `ProgressRow`, `PatchBody`, `mergeProgress`, `defaultProgress` [VERIFIED: read]
- `src/lib/onboarding/steps.ts` + `completion.ts` — registry, `TEACHING_KEYS`, pure probes [VERIFIED: read]
- `src/lib/supabase/rsc.ts` — `getViewerProfile`/`getAuthUser` request-cached admin-read pattern [VERIFIED: read]
- `supabase/migrations/0030_onboarding_progress.sql` — table, owner-only RLS, backfill, trigger [VERIFIED: read]
- `src/app/onboarding/gym/{page,client}.tsx` + `components/onboarding/gym-surface.tsx` — `initialGymCount` hydration analog [VERIFIED: read]
- `src/app/(tabs)/{dashboard,cycle,u/me,...}/page.tsx` — exact per-page redirects to remove [VERIFIED: grep, 8 pages confirmed]
- `vitest.config.ts` — `include: src/**/*.test.ts` (`.ts` only) [VERIFIED: read]
- Grep: zero `createContext`/`useContext` in `src/` [VERIFIED: grep — TourProvider is the first context]
- Grep: all `fetch("/api/...")` calls are client-side [VERIFIED: grep — no RSC self-fetch precedent]

### Secondary (MEDIUM confidence)
- 03-CONTEXT.md, 03-UI-SPEC.md, 03-DISCUSSION-LOG.md — locked decisions and interaction contract [CITED]

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all dependencies verified present in package.json/CLAUDE.md.
- Architecture: HIGH — every pattern verified against existing read code; the one deviation (direct
  read vs self-fetch) is explicitly flagged with rationale.
- Pitfalls: HIGH — derived directly from the actual layout/page/config code (async conversion, cycle
  gender redirect, vitest `.ts`-only, admin-client scoping).

**Research date:** 2026-06-17
**Valid until:** 2026-07-17 (stable — internal codebase wiring; no fast-moving external deps).
