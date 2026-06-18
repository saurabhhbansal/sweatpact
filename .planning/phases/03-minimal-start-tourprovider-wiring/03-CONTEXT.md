# Phase 3: Minimal Start & TourProvider Wiring - Context

**Gathered:** 2026-06-15
**Status:** Ready for planning

<domain>
## Phase Boundary

A new user sets only a username and lands directly in the real app. A server-hydrated
`TourProvider` mounts in the `(tabs)` layout, tracks/persists progress against the
Phase-1 `onboarding_progress` table, and can be resumed — all before any coachmark renders.

**Delivers:**
- Centralized username-only gate in `(tabs)/layout.tsx` (removes old `onboarding_complete` wizard-forcing redirect from all tab pages).
- `TourProvider` client component wrapping `{children}` in the layout, receiving `initialProgress` from a server-side `GET /api/onboarding-progress` fetch (no client-side refetch flash).
- `useTour()` context hook exposing `{ currentStepId, isActive, advance, dismiss }`.
- Dismiss persists `dismissed=true` via PATCH; replayable from Settings in Phase 6.
- Resume on reload: TourProvider derives `currentStepId` from the Phase-2 completion probes + step registry.

**Requirements:** ONB-01, ONB-02, ONB-04.

**Not this phase:** coachmark/spotlight UI (Phase 4), cross-route navigate-then-reveal (Phase 5),
replay Settings entry + version-drift hardening (Phase 6). TourProvider mounts and tracks state;
nothing renders a coachmark yet.

</domain>

<decisions>
## Implementation Decisions

### Gate cleanup strategy

- **D-01: Centralize gate in `(tabs)/layout.tsx`.** The layout adds an explicit async gate
  (awaited before Suspense slots render) that calls `getViewerProfile()` (request-cached — zero
  extra round trip). If the profile is missing or the username is auto-generated (`/^user_[a-f0-9]{8}$/`),
  redirect to `/onboarding/username`. This is the ONLY username redirect gate going forward.

- **D-02: Remove `onboarding_complete` check entirely.** The `!profile.onboarding_complete →
  redirect("/onboarding/schedule")` lines are deleted from all tab pages. Users with optional
  setup incomplete land in the real app — the walkthrough handles that contextually.

- **D-03: Trust the layout — remove per-page redirects.** All per-page username AND
  `onboarding_complete` redirects are removed from `dashboard`, `groups`, `groups/[id]`, `cycle`,
  `notifications`, `settings`, `u/me`, `u/[username]`. The layout gate is the single source
  of truth. No per-page safety net.

### Server hydration wiring

- **D-04: Layout fetches progress server-side, passes as `initialProgress` prop.** The `(tabs)/layout.tsx`
  (RSC) calls `GET /api/onboarding-progress` server-side and renders
  `<TourProvider initialProgress={data}>`. Consumers receive pre-hydrated state — no `useEffect`
  fetch, no flash. Matches the `initialGymCount` pattern in `GymOnboarding`.

- **D-05: TourProvider wraps `{children}` in the layout.** Mounted between the nav shell and
  page content so all tab routes can call `useTour()`.

- **D-06: Fetch failure → silent no-op.** If the server-side fetch fails (network error, 401,
  null response), `initialProgress` is passed as `null`; TourProvider treats this as a blank slate
  (`dismissed: false`, `completed_steps: []`). The tour simply never activates. The app remains
  fully usable.

### TourProvider context API

- **D-07: Minimal surface (extensible in Phase 4+).** `useTour()` returns:
  - `currentStepId: string | null` — next uncompleted, non-skippable step; `null` when complete or dismissed.
  - `isActive: boolean` — `true` when there is a `currentStepId` (tour is running).
  - `advance(stepId: string): Promise<void>` — marks step complete, derives next `currentStepId`, persists via PATCH internally.
  - `dismiss(): Promise<void>` — sets `dismissed: true` via PATCH, sets `isActive` to `false`.

- **D-08: TourProvider owns persistence writes.** `advance()` and `dismiss()` call
  `PATCH /api/onboarding-progress` internally with optimistic state update. Consumers
  call the function with no knowledge of the API.

- **D-09: currentStepId derived from Phase-2 probes.** On init and after each `advance()`,
  TourProvider calls the pure completion probes from `lib/onboarding/completion.ts` and walks
  the ordered step registry from `lib/onboarding/steps.ts` to find the first step that is
  not in `completed_steps` and not auto-skippable. This is the single source of truth —
  same probes Phase 6 replay will use.

### Skip / dismiss semantics

- **D-10: One exit action — `dismiss()`.** There is no step-level skip in Phase 3. The single
  affordance ("skip" or "X" button — copy decided in Phase 4) calls `dismiss()`, which PATCHes
  `dismissed: true`. The tour hides immediately; the app keeps working.

- **D-11: Dismissal is replayable.** `dismissed: true` hides the walkthrough until explicitly
  reset. Phase 6 adds a Settings entry that calls PATCH to reset `dismissed: false` and
  `last_step_id: null`, enabling replay. Phase 3 only needs to persist `dismissed: true`
  correctly.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/ROADMAP.md` §"Phase 3: Minimal Start & TourProvider Wiring" — goal + 4 success criteria.
- `.planning/REQUIREMENTS.md` — ONB-01 (username-only mandatory start), ONB-02 (redirect gate username-only), ONB-04 (TourProvider, server hydration, resume, dismiss persistence).

### Prior-phase contracts this phase builds on
- `.planning/phases/01-onboarding-data-foundation/01-CONTEXT.md` — `onboarding_progress` schema (D-04 PATCH shape: `{ complete_step, dismissed, last_step_id }`), D-04 idempotent PATCH, D-05 `shortcut_viewed` in `completed_steps`.
- `.planning/phases/02-step-logic-shared-setup-surfaces/02-CONTEXT.md` — step registry shape (D-04: `{ id, title, surface?, probe? }`), completion probe contract (D-02: pure functions over passed-in state), `TOUR_VERSION`, `TEACHING_KEYS`.
- `src/lib/onboarding/steps.ts` — ordered step registry + `TOUR_VERSION` (produced by Phase 2).
- `src/lib/onboarding/completion.ts` — pure completion/skip probes (produced by Phase 2).
- `src/app/api/onboarding-progress/route.ts` — GET/PATCH endpoint (produced by Phase 1).

### Files to modify
- `src/app/(tabs)/layout.tsx` — add gate + server fetch + TourProvider mount.
- `src/app/(tabs)/dashboard/page.tsx` — remove per-page redirects.
- `src/app/(tabs)/groups/page.tsx` — remove per-page redirects.
- `src/app/(tabs)/groups/[id]/page.tsx` — remove per-page redirects.
- `src/app/(tabs)/cycle/page.tsx` — remove per-page redirects.
- `src/app/(tabs)/notifications/page.tsx` — remove per-page redirects.
- `src/app/(tabs)/settings/page.tsx` — remove per-page redirects.
- `src/app/(tabs)/u/me/page.tsx` — remove per-page redirects.
- `src/app/(tabs)/u/[username]/page.tsx` — remove per-page redirects.

### Codebase conventions
- `.planning/codebase/CONVENTIONS.md`, `.planning/codebase/STRUCTURE.md`, `.planning/codebase/STACK.md` — naming, RSC patterns, TypeScript strict mode.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/supabase/rsc.ts` `getViewerProfile()` — request-cached RSC profile fetch; already called by `TopBar`/`BottomBar` in layout. Use the same function for the gate (zero extra DB round trip).
- `src/app/onboarding/username/page.tsx` `isAutoUsername()` helper — `!u || /^user_[a-f0-9]{8}$/.test(u)` — extract or copy for the layout gate.
- `src/lib/onboarding/steps.ts` + `src/lib/onboarding/completion.ts` — pure logic; TourProvider imports these to derive `currentStepId`.

### Established Patterns
- RSC passes initial data as prop to a client component: `GymOnboarding({ initialGymCount })` in Phase 2 is the direct analog for `TourProvider({ initialProgress })`.
- `"use client"` directive at top of client components; client context providers follow this pattern throughout (see Radix wrappers in `components/ui/`).
- `src/app/api/onboarding-progress/route.ts` `GET` handler returns the full `onboarding_progress` row — pass this shape as `initialProgress`.

### Integration Points
- New file: `src/components/tour-provider.tsx` — `"use client"` context provider + `useTour()` hook.
- `src/app/(tabs)/layout.tsx` — modify RSC layout: add gate + server fetch + render `<TourProvider initialProgress={...}>{children}</TourProvider>`.
- Phase 4 coachmarks will call `useTour()` from any tab route without needing to know where TourProvider lives.

</code_context>

<specifics>
## Specific Ideas

- The gate in the layout renders before Suspense slots so nav never flashes for unauthenticated users.
- `initialProgress` type mirrors the `onboarding_progress` row shape from Phase 1: `{ mandatory_done, tour_version, last_step_id, completed_steps, dismissed, completed_at }`.
- `advance(stepId)` calls PATCH with `{ complete_step: stepId, last_step_id: stepId }`, then re-derives `currentStepId` from probes client-side (no re-fetch needed — probes are pure).
- `dismiss()` calls PATCH with `{ dismissed: true }`, sets `currentStepId = null` and `isActive = false` optimistically.

</specifics>

<deferred>
## Deferred Ideas

- **Coachmark/spotlight UI** — Phase 4. TourProvider is wired; nothing renders yet.
- **Cross-route navigate-then-reveal** — Phase 5.
- **Replay Settings entry** — Phase 6. Phase 3 only persists `dismissed: true`; the reset path is Phase 6's problem.
- **`tour_version` drift handling on replay** — Phase 6.
- **Skip-already-done auto-skip in TourProvider** — Phase 3 wires the probes (`completion.ts`) into `currentStepId` derivation but the end-to-end auto-skip UX (showing the user they're being skipped) is Phase 6 hardening.
- **`isComplete` and `progress` shape in context** — deliberately deferred to Phase 4+ to avoid premature API lock before coachmark library is picked.

None of the above is scope creep — all are downstream phases already on the roadmap.

</deferred>

---

*Phase: 3-minimal-start-tourprovider-wiring*
*Context gathered: 2026-06-15*
