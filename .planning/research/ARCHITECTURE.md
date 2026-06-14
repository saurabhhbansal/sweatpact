# Architecture Research

**Domain:** Interactive in-app onboarding / coachmark walkthrough on Next.js 14 App Router (brownfield SweatPact)
**Researched:** 2026-06-14
**Confidence:** HIGH (existing codebase grounded; coachmark-library landscape MEDIUM-HIGH)

## Standard Architecture

The walkthrough is a **client-side overlay layer** that sits on top of the already-server-rendered `(tabs)` UI, driven by a **single tour context provider** mounted in the `(tabs)` layout, backed by a **server-persisted progress record** and a thin **read/update API**. It does not replace any existing flow — it orchestrates the *real* setup actions the current `onboarding/` wizard already performs.

```
┌──────────────────────────────────────────────────────────────────────┐
│  (tabs) LAYOUT  (server)  — fetches viewer profile + tour progress     │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐  │
│   │  <TourProvider>  ("use client")   ← tour state lives here       │  │
│   │   - current stepId / index, running, version, dismissed         │  │
│   │   - hydrated from server progress (props), persists on change   │  │
│   │                                                                  │  │
│   │   ┌─────────────────┐   ┌──────────────────┐                    │  │
│   │   │ CoachmarkRenderer│   │  Step Registry   │  (static config)  │  │
│   │   │ (spotlight+card) │◄──│ id→{route,anchor,│                    │  │
│   │   │  portal overlay  │   │  teach,action}   │                    │  │
│   │   └────────┬─────────┘   └──────────────────┘                    │  │
│   │            │ anchors via data-tour="<id>" on live UI            │  │
│   │   ┌────────▼──────────────────────────────────────────────────┐ │  │
│   │   │   server-rendered tab pages (dashboard/groups/cycle/...)  │ │  │
│   │   │   real action surfaces: GymPicker, SchedulePicker,        │ │  │
│   │   │   ShortcutSecret  (reused from onboarding refactor)       │ │  │
│   │   └───────────────────────────────────────────────────────────┘ │  │
│   └──────────────────────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────────────┤
│  API  /api/onboarding-progress  (GET read · PATCH upsert step/dismiss) │
├──────────────────────────────────────────────────────────────────────┤
│  Postgres  onboarding_progress (per-user, RLS self-only)  +  derived   │
│  completion probes (user_gyms count, weekly_goal, profile_secrets)     │
└──────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| **TourProvider** (new) | Owns live tour state (running, current step, version, dismissed); hydrates from server; debounced-persists changes; exposes `start/next/back/skip/replay` | `"use client"` React context in `(tabs)` layout |
| **Step Registry** (new) | Declarative list of steps: `id`, target `route`, anchor selector, teaching copy, optional `action`, optional `isComplete(probe)` skip predicate, `tourVersion` | Pure TS module `src/lib/onboarding/steps.ts` (unit-testable) |
| **CoachmarkRenderer** (new) | Renders spotlight + tooltip card for the active step, anchored to the live DOM element; handles "element not yet in DOM" waiting | Library-backed (Onborda / react-joyride) wrapped in a SweatPact-styled card |
| **Cross-route navigator** (new) | When the next step lives on another route, push the route, wait for the anchor, then advance | `next/navigation` `useRouter().push` + anchor-ready callback |
| **Persistence API** (new) | Read + update the per-user progress row | `src/app/api/onboarding-progress/route.ts` (GET/PATCH, Zod) |
| **Completion probes** (new) | Derive "already done" from real data (gym set? goal set? secret viewed?) so the tour auto-skips | Pure fns in `src/lib/onboarding/completion.ts` over profile + `user_gyms` |
| **Action surfaces** (refactor) | The gym/schedule/shortcut UIs, extracted from `onboarding/*/client.tsx` so both the wizard and the coachmark can mount them | Shared components in `src/components/onboarding/` |

## Recommended Project Structure

```
src/
├── app/
│   ├── (tabs)/
│   │   ├── layout.tsx                # MODIFIED: wrap children in <TourProvider> (client), pass server progress
│   │   ├── settings/
│   │   │   └── client.tsx            # MODIFIED: add "Replay walkthrough" action
│   │   └── ... (dashboard/groups/cycle/shortcut)   # MODIFIED: add data-tour="<id>" anchors only
│   ├── onboarding/
│   │   ├── username/                 # KEPT: mandatory minimal start (identity)
│   │   ├── schedule|gym|shortcut/    # REFACTORED: page shells thin; logic moves to shared components
│   │   └── ...
│   └── api/
│       └── onboarding-progress/
│           └── route.ts              # NEW: GET read / PATCH upsert step + dismissed + version
├── components/
│   ├── onboarding/                   # NEW: extracted, reusable action surfaces
│   │   ├── gym-picker.tsx            #   (Google Places search + /api/gyms POST)
│   │   ├── schedule-picker.tsx       #   (weekly_goal + rest_days → /api/profile PATCH)
│   │   └── shortcut-secret.tsx       #   (User ID + secret copy fields)
│   └── tour/                         # NEW: the walkthrough machinery
│       ├── tour-provider.tsx         #   ("use client") context + persistence
│       ├── coachmark-renderer.tsx    #   spotlight + styled tooltip card
│       └── coachmark-card.tsx        #   SweatPact-styled tooltip (Tailwind/glass-card)
└── lib/
    └── onboarding/                   # NEW: pure, testable logic
        ├── steps.ts                  #   step registry + TOUR_VERSION constant
        ├── completion.ts             #   isStepComplete(stepId, probe) skip predicates
        └── completion.test.ts        #   co-located vitest
supabase/migrations/
└── 0030_onboarding_progress.sql      # NEW: per-user tour progress table + RLS
```

### Structure Rationale

- **`components/onboarding/` (shared action surfaces):** The single most important refactor. The gym/schedule/shortcut logic currently lives *inside* `app/onboarding/*/client.tsx` and is coupled to `router.push("/onboarding/next")`. Extracting it into wizard-agnostic components (props for "what to do on success" instead of hard-coded navigation) lets both the legacy wizard **and** the coachmark mount the identical real action. This is what makes the walkthrough "complete real setup in-context" rather than fake it.
- **`lib/onboarding/` (pure logic):** Matches the codebase's `src/lib/*` + co-located `*.test.ts` convention. The step registry and completion predicates are the parts most likely to change and most valuable to unit-test (skip logic must be correct or the tour shows redundant steps).
- **`components/tour/` (machinery):** Isolates the chosen library so it can be swapped. Only `coachmark-renderer.tsx` imports the library directly.
- **One new API folder** mirrors the "one folder per resource" route convention.

## Architectural Patterns

### Pattern 1: Server-hydrated client tour state

**What:** Tour progress is the source of truth in Postgres, but the *live* tour (which step is showing, is it running) is client state. The `(tabs)` server layout reads the progress row once (alongside the existing `getViewerProfile()` request-cache) and passes it as the provider's initial props. The provider never re-fetches on mount — it hydrates from props and persists forward.

**When to use:** Whenever an interactive overlay must survive reloads and resume mid-tour.

**Trade-offs:** Keeps RSC/client boundary clean (no client-side data fetch on first paint, no flash); cost is that "resume" granularity is whatever you persist (recommend persisting `last_step_id` on every advance, debounced).

```tsx
// (tabs)/layout.tsx  (server)
const [profile, progress] = await Promise.all([getViewerProfile(), getTourProgress()]);
return <TourProvider initialProgress={progress} viewer={{ hasGym, hasGoal, ... }}>{children}</TourProvider>;
```

### Pattern 2: Anchor-by-attribute, not by ref

**What:** Live tab pages are mostly Server Components; you cannot pass React refs into them from the client provider. Instead, anchor each step to a **stable `data-tour="<step-id>"` attribute** placed on the real UI element. The renderer queries the DOM (`[data-tour="set-gym"]`) when a step activates.

**When to use:** Any coachmark over server-rendered or deeply-nested UI you don't want to rewire.

**Trade-offs:** Decouples tour from component internals (only attributes change in tab pages — minimal, low-risk diffs). The renderer must tolerate "anchor not yet mounted" (wait/poll with timeout — both react-joyride `targetWaitTimeout` and Onborda handle this).

### Pattern 3: Cross-route step sequencing via navigate-then-wait

**What:** Steps carry a target `route`. On `next()`, if the next step's route differs from the current pathname, the provider `router.push(route)`, then waits for the step's anchor to appear before showing the coachmark. Tour state lives in the layout-level provider, which stays mounted across `(tabs)` client navigations (same reason the nav bar persists — see existing `(tabs)/layout.tsx`), so state survives the route change.

**When to use:** Multi-tab walkthroughs (dashboard → groups → cycle → shortcut).

**Trade-offs:** Requires controlled-index orchestration. Confirmed by react-joyride's own guidance: multi-route tours need controlled mode where you stop, change `stepIndex`, and restart after the target mounts. Onborda/NextStep bake route transitions into the step config, removing most of this glue — a strong reason to prefer them here.

```ts
// steps.ts
export const TOUR_VERSION = 1;
export const STEPS = [
  { id: "set-gym",   route: "/dashboard", anchor: "set-gym",  teach: "...", action: "gym" },
  { id: "stakes",    route: "/groups",    anchor: "new-challenge", teach: "..." },
  { id: "money",     route: "/groups",    anchor: "ledger",   teach: "..." },
  { id: "shortcut",  route: "/shortcut",  anchor: "secret",   teach: "...", action: "shortcut" },
] as const;
```

### Pattern 4: Real-action coachmarks (in-context completion)

**What:** A step with an `action` doesn't just point at UI — it mounts the extracted action surface (`<GymPicker>`, `<SchedulePicker>`, `<ShortcutSecret>`) inside or beside the coachmark card and calls the *same* APIs the wizard uses (`POST /api/gyms`, `PATCH /api/profile`, read `profile_secrets`). On success the surface reports completion; the provider marks the step done and advances.

**When to use:** The differentiator for this milestone — teach + do in one place.

**Trade-offs:** Demands the Pattern-from-structure refactor (shared surfaces). Pays off because there is exactly one code path per setup action, so the wizard and tour can never drift.

## Data Flow

### Request Flow (advance a step that performs a real action)

```
[User taps "Set my gym" in coachmark]
    ↓
<GymPicker> (shared) → POST /api/gyms (existing handler, unchanged)
    ↓                                    ↓
onSuccess() → TourProvider.markDone("set-gym")        user_gyms row inserted
    ↓
PATCH /api/onboarding-progress { stepId:"set-gym", done:true }   (debounced)
    ↓                                    ↓
advance to next step                 onboarding_progress upserted (RLS self)
    ↓
if next.route !== pathname → router.push(next.route) → wait for anchor → show coachmark
```

### State Management

```
Postgres onboarding_progress ──(server read, once)──► TourProvider initialProgress
                                                            │
   live: running, stepIndex, dismissed  ◄── user actions ──┤
                                                            ▼
                              PATCH /api/onboarding-progress (debounced persist)
```

### Key Data Flows

1. **Resume:** On any `(tabs)` load, server reads progress; if `mandatory_done && !dismissed && !fully_complete && version === TOUR_VERSION`, provider auto-starts at `last_step_id`.
2. **Auto-skip already-done steps:** Before showing a step, the provider checks `isStepComplete(stepId, probe)` where `probe = { hasGym, hasWeeklyGoal, hasViewedSecret }` derived server-side from `user_gyms` count, `profiles.weekly_goal`, and a `shortcut_viewed` flag. If complete, it advances without rendering — so a user who already set a gym never sees the gym step.
3. **Replay:** Settings action PATCHes `dismissed=false` and resets `last_step_id` to the first step (keeps per-step "done" flags so replayed steps that are genuinely done still skip, unless replay is "force show all").
4. **Version bump for replay:** Incrementing `TOUR_VERSION` (new teaching content) makes resume logic treat the persisted progress as stale and re-offer the tour.

## Migration Shape

```sql
-- 0030_onboarding_progress.sql
create table if not exists public.onboarding_progress (
  user_id        uuid primary key references public.profiles(id) on delete cascade,
  mandatory_done boolean not null default false,   -- minimal identity start completed
  tour_version   integer not null default 0,       -- version of tour content last seen
  last_step_id   text,                              -- resume point
  completed_steps jsonb not null default '[]'::jsonb, -- per-step completion ids
  dismissed      boolean not null default false,    -- user skipped the walkthrough
  completed_at   timestamptz,                       -- tour fully finished
  updated_at     timestamptz not null default now()
);

alter table public.onboarding_progress enable row level security;

create policy "onboarding_progress_select_own" on public.onboarding_progress
  for select using (auth.uid() = user_id);
create policy "onboarding_progress_insert_own" on public.onboarding_progress
  for insert with check (auth.uid() = user_id);
create policy "onboarding_progress_update_own" on public.onboarding_progress
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

**Schema notes:**
- **`mandatory_done`** replaces the semantic of the existing `profiles.onboarding_complete` for the *minimal start*. Recommendation: keep `profiles.onboarding_complete` as-is (it still gates dashboard redirect today) and have the minimal-start username step set it; let `onboarding_progress` own the *walkthrough* lifecycle. Avoids a risky rewrite of the existing redirect chain in `dashboard/page.tsx`.
- **`completed_steps` as jsonb array** is the simplest per-step model; a child `onboarding_step_completions(user_id, step_id, completed_at)` table is the normalized alternative if you later need per-step timestamps/analytics. jsonb is sufficient for MVP and matches the codebase's preference for fewer tables.
- **`tour_version`** vs the code `TOUR_VERSION` constant drives replay: `progress.tour_version < TOUR_VERSION` ⇒ re-offer.
- A `shortcut_viewed boolean` on `profiles` (or in `completed_steps`) is needed because viewing the secret has no other observable side-effect to probe.

## API Surface

```
GET   /api/onboarding-progress      → { mandatory_done, tour_version, last_step_id,
                                         completed_steps, dismissed, completed_at }
PATCH /api/onboarding-progress      body (Zod, all optional):
        { stepDone?: string, lastStepId?: string, dismissed?: boolean,
          tourVersion?: number, completed?: boolean, mandatoryDone?: boolean }
        → upsert (insert-on-first-write), returns updated row
```

- Node runtime, `dynamic = "force-dynamic"`, `supabase.auth.getUser()` gate, Zod body — identical shape to existing `/api/profile`.
- Upsert via the authenticated server client (RLS-scoped, no admin needed since it's self-only and no locked columns).
- The actual setup actions reuse **existing** endpoints untouched: `POST /api/gyms` (gym), `PATCH /api/profile` (weekly_goal/rest_days), and `profile_secrets` read (shortcut). No new endpoints for those.

## Refactor: mandatory vs deferred split

| Step | Today | After |
|------|-------|-------|
| **username** | `/onboarding/username` (step 0/4) | **Mandatory** — kept as the minimal start; on submit sets `mandatory_done` and lands user in `/dashboard` |
| **schedule** | `/onboarding/schedule` (1/4) | **Deferred** — logic → `<SchedulePicker>`, surfaced as a coachmark on dashboard/profile |
| **gym** | `/onboarding/gym` (2/4) | **Deferred** — logic → `<GymPicker>`, surfaced as a coachmark on dashboard |
| **shortcut** | `/onboarding/shortcut` (3/4) | **Deferred** — logic → `<ShortcutSecret>`, surfaced as a coachmark on the shortcut tab |

The redirect chain in `dashboard/page.tsx` (`!username → /onboarding/username`, `!onboarding_complete → /onboarding/schedule`) must change: only the **username** gate remains a hard redirect; the `!onboarding_complete → schedule` redirect is **removed** so users enter the app immediately, and the walkthrough (not a redirect) handles the deferred steps. The legacy `/onboarding/schedule|gym|shortcut` pages can remain as thin shells over the shared components (graceful fallback / direct links) or be deleted once the tour covers them.

## Completion-probe detection ("step already done")

| Step | Probe (server-derived, no new query cost beyond one count) | Skip when |
|------|------------------------------------------------------------|-----------|
| set-gym | `count(user_gyms where user_id = me) > 0` | ≥ 1 gym exists |
| schedule | `profiles.weekly_goal is set` (and/or non-default `rest_days`) | goal already chosen |
| shortcut | `shortcut_viewed` flag (no side-effect to probe otherwise) | flag true |

Probe values are computed in the `(tabs)` layout (cheap, alongside `getViewerProfile`) and passed to the provider, so skip decisions are made before any coachmark paints — no flicker of a step the user already finished.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-1k users | Single `onboarding_progress` row per user, jsonb steps — trivial. No concerns. |
| 1k-100k users | Still trivial: one indexed PK lookup per session, one debounced write per advance. The provider read piggybacks on the existing per-request profile fetch. |
| 100k+ users | Unchanged; if per-step analytics become a product need, migrate `completed_steps` jsonb → normalized completion table for queryability. |

### Scaling Priorities

1. **First (non-)bottleneck:** Progress write volume is bounded by tour length (~4 steps) per user lifetime — negligible. Debounce advances to avoid a write per click.
2. **Second:** None at this layer. The known codebase ceilings (enforcement cron, no transactions) are unrelated to onboarding.

## Anti-Patterns

### Anti-Pattern 1: Tour state in a route or URL param

**What people do:** Encode the current step in the pathname (`/onboarding/tour/3`) or wrap tabs in a new route group.
**Why it's wrong:** Fights the requirement that the user is in the *real live app* immediately; breaks deep links and the existing `(tabs)` layout/nav persistence.
**Do this instead:** Keep the user on real routes; hold step state in the layout-level client provider; persist to the DB, not the URL.

### Anti-Pattern 2: Faking the setup actions inside the tour

**What people do:** Build tour-only gym/schedule inputs that write through a new "tour" endpoint.
**Why it's wrong:** Duplicates business logic, drifts from the wizard, and risks the financial/verification invariants (gym geo data).
**Do this instead:** Extract the existing action UIs into shared components that call the existing `/api/gyms` and `/api/profile` endpoints — one code path.

### Anti-Pattern 3: Driving `stepIndex` from a `useEffect` reacting to app state

**What people do:** Sync the library's controlled index off a `useEffect` watching route/state.
**Why it's wrong:** Documented react-joyride failure mode — desyncs the overlay lifecycle and breaks keyboard/overlay handlers.
**Do this instead:** Use the library's async before/after-step hooks (Onborda/NextStep route config, or joyride callback) to perform navigation, then advance.

### Anti-Pattern 4: Anchoring coachmarks with React refs into Server Components

**What people do:** Try to forward refs from the client provider into server-rendered tab pages.
**Why it's wrong:** Server Components can't receive client refs; forces converting pages to client components.
**Do this instead:** `data-tour="<id>"` attributes + DOM query at activation (Pattern 2).

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Google Places | Reuse `/api/places/search` + `/api/places/details` via `<GymPicker>` | No change; already proxied/rate-limited |
| Coachmark library | Single import inside `coachmark-renderer.tsx` | Prefer App-Router-native (Onborda/NextStep) for built-in routing + `"use client"` provider pattern; react-joyride is the mature fallback but needs hand-rolled cross-route controlled mode and is React-18-only (fine here, but not React-19-ready) |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| TourProvider ↔ tab pages | DOM `data-tour` attributes (one-way anchor) | Tab page diffs are attribute-only, low risk |
| TourProvider ↔ action surfaces | props/callbacks (`onComplete`) | Surfaces are wizard-agnostic; same components power legacy `/onboarding/*` |
| TourProvider ↔ persistence | `/api/onboarding-progress` (debounced PATCH) | RLS self-only; no admin client needed |
| Action surfaces ↔ existing APIs | `POST /api/gyms`, `PATCH /api/profile`, `profile_secrets` read | Unchanged endpoints — guarantees no logic drift |

## Suggested Build Order (dependencies)

1. **Migration `0030_onboarding_progress` + `/api/onboarding-progress` (GET/PATCH).** Foundation; nothing depends on UI. Add `shortcut_viewed` (and decide `mandatory_done` vs reusing `onboarding_complete`).
2. **`lib/onboarding/steps.ts` + `completion.ts` (+ tests).** Pure, no UI deps; defines the contract everything else consumes.
3. **Extract shared action surfaces** (`components/onboarding/gym-picker|schedule-picker|shortcut-secret`) and re-point the legacy `onboarding/*` pages at them. Independently shippable, de-risks the refactor before the tour exists.
4. **`TourProvider` + persistence wiring**, mounted in `(tabs)/layout.tsx`, hydrated from server progress + probes. No coachmarks yet — verify state/resume/persist.
5. **`CoachmarkRenderer` + `CoachmarkCard`** (library integration), single-route steps first.
6. **Cross-route sequencing** (navigate-then-wait) once single-route works.
7. **Add `data-tour` anchors** to dashboard/groups/cycle/shortcut and the four teaching steps; wire action steps to the shared surfaces.
8. **Skip-on-complete + minimal-start redirect change** (remove `!onboarding_complete → /onboarding/schedule`).
9. **Replay from Settings + version bump path.**

Steps 1-3 are parallelizable and unblock the rest; 4 gates 5-9.

## Sources

- [Evaluating tour libraries for React — Sandro Roth](https://sandroroth.com/blog/evaluating-tour-libraries/) (MEDIUM)
- [React Joyride vs Shepherd vs Driver.js vs Intro.js 2026 benchmark — usertourkit](https://usertourkit.com/blog/react-tour-library-benchmark-2026) (MEDIUM)
- [react-joyride: How It Works (controlled mode)](https://react-joyride.com/docs/how-it-works) (HIGH)
- [react-joyride multi-route tour discussion #1000 / #756](https://github.com/gilbarbara/react-joyride/discussions/1000) (HIGH)
- [Onborda — App Router docs (provider in layout, routing integration)](https://www.onborda.dev/docs/app-router) (HIGH)
- [NextStep — lightweight Next.js onboarding library](https://nextstepjs.com/docs/v1) (MEDIUM)
- [What product tour tool works with Next.js App Router — userTourKit](https://usertourkit.com/blog/product-tool-nextjs-app-router) (MEDIUM)
- Existing codebase (HIGH): `(tabs)/layout.tsx`, `onboarding/*/client.tsx`, `api/profile/route.ts`, `lib/supabase/rsc.ts`, `migrations/0012_user_gyms.sql`, `0014_onboarding_complete.sql`

---
*Architecture research for: in-app coachmark walkthrough on Next.js App Router (SweatPact v1.1)*
*Researched: 2026-06-14*
