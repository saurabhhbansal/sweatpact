# Stack Research

**Domain:** Interactive in-app onboarding / contextual coachmark walkthrough (spotlight tooltips anchored to live UI) for a Next.js 14 App Router + React 18 PWA
**Researched:** 2026-06-14
**Confidence:** HIGH (library versions, licenses, and App Router compatibility verified against npm + official docs, 2026; persistence pattern is standard Postgres/Supabase practice)

## TL;DR Recommendation

Use **`react-joyride` v3** as the coachmark/tour engine. It is the only actively-maintained, MIT-licensed, React-native option whose v3 rewrite (Mar–Apr 2026) supports React 18/19, renders via a **configurable portal** (coexists with Radix portals), positions with **Floating UI**, ships a **per-step focus trap**, and — critically for this milestone — lets each step render an **arbitrary custom React component** as the tooltip. That last property is what makes "do the setup step as a real in-context action" (Google Places gym search, schedule form, Shortcut setup) possible *inside* the coachmark rather than bolted on beside it.

Persist tour progress in a **dedicated `tour_progress` table** (one row per user, RLS-protected) holding a small JSONB state blob plus a couple of scalar columns — not a JSONB column bolted onto `profiles`. Reuse the **existing** profile completion flags (gym/schedule/shortcut already set) to drive "skip already-completed steps." Orchestrate steps with **local component state + the `useJoyride()` hook**; no new global state library is warranted.

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `react-joyride` | `^3.1.0` | Coachmark/tour engine: spotlight overlay, anchored tooltips, step sequencing, controlled stepping | Only actively-maintained (last publish Apr 2026), **MIT-licensed**, **React-native** tour lib. v3 supports React 16.8–19, renders all UI through a **React portal with a configurable `portalElement`**, uses **Floating UI** for anchoring (re-measures dynamically-rendered DOM), provides a **`useJoyride()` hook + controlled `stepIndex`** for resume/replay, **async before/after step hooks**, and **custom tooltip components**. The custom-component capability is the decisive feature: setup actions (gym/schedule/Shortcut) render as real React forms inside the step. ~34 KB gzipped — acceptable, and it can be `dynamic()`-imported so it never enters the initial bundle. |
| Supabase Postgres (existing) | n/a | Server-side persistence of per-user tour progress (resume + replay) | Already the system of record with RLS. A dedicated `tour_progress` table fits the existing privilege-scoped-client + RLS model with zero new infrastructure. |
| Local React state + `useJoyride()` (built-in) | n/a | Step orchestration / "which step am I on" | The tour is a single bounded flow living under the `(tabs)` client tree. A controlled `stepIndex` in a small `OnboardingTour` client component (hydrated from the server on mount, persisted on change) is sufficient. No Zustand/Redux/Jotai needed. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `next/dynamic` (built-in) | n/a | Lazy-load `react-joyride` client-side only (`ssr: false`) | Always — keeps tour JS out of the initial/RSC payload and guarantees the lib only runs where `document` exists. |
| `zod` (existing `^3.23.8`) | existing | Validate the tour-progress write payload at the `/api/onboarding/progress` boundary | Always — matches the project's "Zod at every API boundary" rule. |
| Existing Radix/shadcn primitives | existing | Build the *content* of custom tooltip steps (buttons, inputs, the gym/schedule forms) | For every interactive step — reuse the app's own components inside `react-joyride`'s custom tooltip so coachmarks match product styling and accessibility. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Vitest (existing) | Unit-test the step-selection / skip-already-completed logic | Keep orchestration logic (which steps apply given profile flags, next-step resolution) in a **pure `src/lib/onboarding/` module** and test it there — same pattern as the rest of the domain layer. Do not test the Joyride DOM itself. |
| `data-tour="..."` attribute convention | Stable anchor targets for steps | Anchor steps to `[data-tour="checkin-button"]`-style attributes, **not** Tailwind/utility classes (which churn) or text. This is the single most important reliability practice — see Pitfalls below. |

## Installation

```bash
# Core
npm install react-joyride@^3.1.0

# Supporting — none new; next/dynamic, zod, Radix/shadcn already present
```

No dev dependencies required beyond the existing toolchain.

## App Router / RSC / Radix Integration Notes

These are the load-bearing integration facts for the roadmap:

1. **Client-only, dynamically imported.** `react-joyride` touches `document` and must be a Client Component. Wrap it in a thin `"use client"` `OnboardingTour` component and import that via `next/dynamic(() => import(...), { ssr: false })`. This keeps it out of every RSC payload and avoids any hydration/SSR concern (v3 docs do not promise SSR support — don't rely on it).
2. **Anchors must exist in the DOM when a step activates.** Because the `(tabs)` screens render their interactive UI in Client Components, target elements are present after hydration. Use `react-joyride`'s async **`before` step hook** to wait for / scroll to a target, and its **separate scroll vs spotlight targets** for elements inside scroll containers. For elements that only appear after navigation, drive `stepIndex` forward only once the destination route's anchor is mounted.
3. **Portal coexistence with Radix.** Radix Dialogs/Dropdowns render in their own portals on `document.body`. `react-joyride` v3 renders through its own portal and accepts a **`portalElement`** prop — mount its portal into a dedicated top-level `<div id="tour-root">` in the root layout so its overlay/z-index is controlled independently of Radix layers. Avoid running a coachmark step that targets content *inside* an open Radix modal unless that step's tooltip is also portalled above the modal; prefer anchoring to triggers, not modal internals.
4. **Custom tooltip = the in-context action.** Implement each interactive step's tooltip as a custom component that embeds the existing setup UI (Google Places gym search, weekly-schedule form, iOS-Shortcut instructions). On successful submit, advance `stepIndex` and persist progress. This satisfies "each optional setup done as a real in-context action."
5. **Accessibility.** v3 provides a built-in **per-step focus trap with focus restoration** and ARIA on its controls — a genuine advantage over driver.js (which does *not* trap focus and uses non-semantic `<a>` controls). Still verify keyboard flow (Tab/Shift-Tab, Esc-to-skip) per step and respect `prefers-reduced-motion`.

## Persistence Recommendation (tour progress)

**Use a dedicated table, not a JSONB column on `profiles`.** Tour UI state is volatile, write-heavy during onboarding, and conceptually separate from canonical profile data. Keeping it off `profiles` avoids row-bloat/write-contention on a hot table and keeps the "sensitive profile columns locked down" RLS surface clean.

Recommended shape:

```sql
create table public.tour_progress (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  status       text not null default 'in_progress'
               check (status in ('in_progress','completed','skipped')),
  current_step text,                 -- step id, for resume
  state        jsonb not null default '{}'::jsonb,  -- per-step seen/skipped map, replay flags
  completed_at timestamptz,
  updated_at   timestamptz not null default now()
);

alter table public.tour_progress enable row level security;

create policy "own tour row select" on public.tour_progress
  for select using (auth.uid() = user_id);
create policy "own tour row upsert" on public.tour_progress
  for insert with check (auth.uid() = user_id);
create policy "own tour row update" on public.tour_progress
  for update using (auth.uid() = user_id);
```

Design rules:
- **One row per user**, `user_id` PK — cheap upsert on each step transition.
- **`current_step` as a string id** (e.g. `'set-gym'`), not a numeric index, so step reordering doesn't corrupt saved progress.
- **`state` JSONB** holds the small/evolving bits: which steps were seen, which were explicitly skipped, and a replay marker. JSONB (not `json`) per Supabase guidance.
- **"Skip already-completed steps" reuses existing profile signals.** Do *not* duplicate gym/schedule/shortcut completion into `tour_progress`. Derive each setup step's applicability from the existing `profiles` fields (gym set? schedule set? shortcut secret used?) at tour-build time in the pure `src/lib/onboarding/` module. `tour_progress` only records *tutorial* progress (resume point, replay), not setup truth.
- **Write path:** a `POST /api/onboarding/progress` Route Handler, Zod-validated, using the cookie-bound server client (RLS-enforced) — no admin client needed since users only ever write their own row.
- **Read path:** load the row in the RSC that renders the `(tabs)` shell and pass `initialStep`/`status` into the client `OnboardingTour` so resume/replay is server-driven and flicker-free.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `react-joyride` v3 | `driver.js` `^1.4.0` (MIT, ~5 KB) | Choose driver.js **only** if the feature were purely passive highlight-and-read tooltips with no React forms inside them. It is smaller and framework-agnostic, but renders **plain-DOM popovers** (embedding the gym/schedule React forms is awkward), **does not trap keyboard focus**, and uses non-semantic controls — wrong fit for *interactive in-context setup actions* and weaker on a11y. Good fallback if Joyride's bundle/complexity proves unjustified for a later, simpler tour. |
| `react-joyride` v3 | `@reactour/tour` `^3.8.0` (MIT) | Viable React-native alternative with custom-content support and smaller API surface; less actively maintained than Joyride v3 (last publish May 2025 vs Apr 2026) and a smaller ecosystem. Reasonable if you hit a specific Joyride limitation, but Joyride's controlled-stepping, async step hooks, and 2026 React-19-ready maintenance make it the safer primary. |
| Dedicated `tour_progress` table | JSONB `tour_state` column on `profiles` | Acceptable for an absolutely minimal one-flag "has seen tour" need. Not recommended here because the milestone requires resumable + replayable multi-step state with frequent writes; keep that churn off `profiles`. |
| Local state + `useJoyride()` | Zustand/Jotai store | Only if tour state must be read/mutated from many disconnected parts of the tree. For a single bounded flow it's over-engineering. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `intro.js` (`8.3.2`) | **AGPL-3.0** license — copyleft, legally hazardous for a closed-source commercial SaaS unless you buy a commercial license. Also not React-native (imperative DOM API), weaker fit for embedding React setup forms. | `react-joyride` (MIT) |
| `shepherd.js` (`15.2.2`) | **AGPL-3.0** (same licensing hazard). React wrapper is thin; negligible npm download traction. | `react-joyride` (MIT) |
| `react-joyride` v2.x | Depends on React APIs **removed in React 19** (`unmountComponentAtNode`, `unstable_renderSubtreeIntoContainer`); blocks any future React 19 upgrade. v3 is a clean rewrite. | `react-joyride` `^3.1.0` |
| Anchoring steps to Tailwind/utility classes or visible text | Utility classes are reordered/purged by the build; text is i18n/copy-fragile → brittle, silently-breaking anchors. | Stable `data-tour="..."` attributes on target elements |
| Running tour steps from a Server Component, or importing Joyride without `ssr: false` | Joyride needs `document`; SSR import causes hydration/`window is not defined` errors. v3 docs don't guarantee SSR. | `"use client"` wrapper + `next/dynamic(..., { ssr: false })` |
| Persisting tour state only in `localStorage` | Milestone explicitly requires **server-side** persistence for cross-device resume + replay-from-settings; localStorage alone fails that. | `tour_progress` table (localStorage optional as a fast-path cache only) |

## Stack Patterns by Variant

**If a step must collect input (gym, schedule, Shortcut):**
- Render a **custom tooltip component** embedding the existing Radix/shadcn form; advance `stepIndex` and `POST` progress on submit success.
- Because completion truth lives in `profiles`, re-deriving applicability means the step auto-skips on replay if already done.

**If a step spans a route change (e.g. navigate to a different tab to highlight something):**
- Persist `current_step` before navigation; on the destination route's mount, hydrate Joyride at that step once the `[data-tour]` anchor exists. Use the async `before` hook to await the anchor.

**If you later want a second, lightweight, read-only tour (e.g. a single feature callout):**
- `driver.js` (~5 KB) is a reasonable per-feature add for non-interactive highlights without pulling the whole flow through Joyride.

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `react-joyride@^3.1.0` | React 16.8 – 19 | Confirmed React 18.3.1 (current app) supported. v3 dropped the React-19-incompatible APIs that broke v2. Uses Floating UI internally (no Popper peer dep to manage). |
| `react-joyride@^3.1.0` | Next.js 14.2 App Router | Works as a Client Component; **must** be `dynamic()`-imported with `ssr: false`. No App Router-specific incompatibility. |
| `react-joyride` portal | Radix UI portals | Coexists; isolate via dedicated `portalElement` / `#tour-root` and explicit z-index. |
| `tour_progress` table | `@supabase/ssr` 0.5.2 cookie-bound client | Standard RLS read/write; no admin client required (self-owned rows only). |

## Sources

- npm registry (`npm view`) — versions/licenses verified 2026-06-14: `react-joyride@3.1.0` (MIT, published 2026-04-29), `driver.js@1.4.0` (MIT), `@reactour/tour@3.8.0` (MIT), `shepherd.js@15.2.2` (AGPL-3.0), `intro.js@8.3.2` (AGPL-3.0). — HIGH
- [react-joyride.com — New in V3](https://react-joyride.com/docs/new-in-v3) — verified custom tooltip components, `useJoyride()` hook, controlled `stepIndex`, configurable `portalElement`, Floating UI positioning, per-step focus trap, React 16.8–19 support. — HIGH
- [gilbarbara/react-joyride — V3 discussion & React 19 issues #1122/#1130/#1196](https://github.com/gilbarbara/react-joyride/discussions/1196) — v3 rewrite (Mar–Apr 2026), React 19 compatibility, v2 incompatibility cause. — HIGH
- [usertourkit.com — React tour library benchmark 2026](https://usertourkit.com/blog/react-tour-library-benchmark-2026) — bundle sizes (~34 KB Joyride vs ~5 KB driver.js), maintenance, AGPL flag on intro.js/shepherd.js. — MEDIUM (cross-checked vs npm for licenses/versions)
- [GitHub — kamranahmedse/driver.js issue #24 (Accessibility)](https://github.com/kamranahmedse/driver.js/issues/24) — driver.js does not trap keyboard focus; non-semantic `<a>` controls. — HIGH
- [Supabase Docs — Managing JSON and unstructured data](https://supabase.com/docs/guides/database/json) — JSONB over json; don't overuse JSONB for queryable structured data → favors dedicated table. — HIGH
- [Next.js Docs — App Router / use client](https://nextjs.org/docs/app) — Client Component + dynamic import requirement for DOM-touching libs. — HIGH

---
*Stack research for: interactive coachmark/product-tour layer (Next.js 14 App Router + React 18 PWA, Supabase Postgres persistence)*
*Researched: 2026-06-14*
