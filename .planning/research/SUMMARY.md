# Project Research Summary

**Project:** SweatPact — v1.1 Guided Onboarding Walkthrough
**Domain:** Interactive in-app coachmark / product-tour layer on Next.js 14 App Router + React 18 PWA (Supabase Postgres, Radix/shadcn, installable PWA)
**Researched:** 2026-06-14
**Confidence:** HIGH

## Executive Summary

SweatPact v1.1 replaces a front-loaded four-screen setup wizard with a contextual coachmark walkthrough that keeps users in the real app from the moment they complete a bare identity step (username only). Research across all four domains converges on the same north star: the activation event must equal the aha moment, which for SweatPact is the first live stakes challenge created or accepted. Everything in the tour — gym setup, schedule, Shortcut — should be surfaced just-in-time as a prerequisite of that challenge, not as standalone busywork. The recommended engine is `react-joyride` v3.1.0 (MIT, React-18/19-ready, custom-tooltip components, Floating UI positioning, controlled step index), backed by a dedicated `onboarding_progress` Postgres table with RLS. The "skip already-done" invariant must be derived from real app state (`user_gyms` count, `weekly_goal`, `shortcut_viewed` flag), not from a duplicate onboarding flag, to prevent drift and re-teaching completed steps.

The architecture is a single client-side `TourProvider` mounted in the persistent `(tabs)` layout (server-hydrated on first paint, debounced-persisted on each advance), a pure testable step registry in `src/lib/onboarding/`, and extracted shared action surfaces (`GymPicker`, `SchedulePicker`, `ShortcutSecret`) decoupled from their current hard-coded `router.push("/onboarding/next")` wiring. The coachmark renderer wraps `react-joyride` behind a thin boundary so the library can be swapped. Steps anchor via stable `data-tour="<step-id>"` attributes, not Tailwind classes or text.

The critical risks are all technical: (1) spotlight targeting Suspense-streamed / conditional content before it mounts — requires ref/anchor-presence gating; (2) z-index collisions with the existing z-40/z-50 nav stack, Radix dialog portals, and the z-[100] InstallGate — requires a click-through cutout overlay and pausing while a Radix dialog is open; (3) PWA safe-area positioning; (4) progress write races — idempotent additive append of semantic string keys. Two open questions need a short spike before the coachmark engine phase: final library pick (react-joyride v3 vs Onborda/NextStep) and anchoring to content inside a Radix dialog.

## Key Findings

### Recommended Stack

`react-joyride` v3.1.0 (MIT, published Apr 2026) — only actively-maintained, React-native tour library supporting React 16.8–19, rendering via a configurable portal (isolated from Radix via `portalElement`/`#tour-root`), positioning with Floating UI, and rendering an arbitrary custom React component per step tooltip. That property lets the gym picker, schedule form, and Shortcut setup run as real in-context actions inside the coachmark. Import via `next/dynamic(..., { ssr: false })` into a `"use client"` wrapper. Viable alternative: Onborda/NextStep (App Router-native route config, less cross-route glue) — resolve in a one-session spike before the engine phase. Avoid intro.js and shepherd.js (both AGPL-3.0).

Tour progress → dedicated `onboarding_progress` table (not a JSONB column on `profiles`): `mandatory_done`, `tour_version`, `last_step_id` (semantic string key), `completed_steps` (JSONB array of key strings), `dismissed`, `completed_at`, RLS-restricted to owner. Write path: `GET/PATCH /api/onboarding-progress`, Zod-validated, idempotent additive append. Read path: single server fetch in `(tabs)` layout RSC alongside `getViewerProfile()` so the provider hydrates from props (no first-paint client fetch).

**Core technologies:** `react-joyride@^3.1.0`; `next/dynamic` (ssr:false); Supabase `onboarding_progress` table + RLS; `zod` (existing); existing Radix/shadcn primitives for coachmark content; `data-tour="<step-id>"` anchor convention.

### Expected Features

Model: checklist-backed, empty-state-anchored, contextual-coachmark composite. Teaching sequence: identity (mandatory) → gym (just-in-time prerequisite) → start a stakes challenge (aha/activation) → money model (anchored to live stake, post-challenge) → iOS Shortcut (conditional, manual fallback).

**Table stakes:** minimal mandatory start (username only); always-visible one-tap Skip on every step; server-persisted progress (resume/cross-device); skip-already-completed via derived real state; one-at-a-time contextual coachmarks on the four teaching points; every setup step tied to a real in-context action; outcome-framed brand-voiced copy; 4-item progress checklist + replay-from-settings; iOS Shortcut conditional with manual check-in fallback; dashboard empty-state CTA ("Start your first pact").

**Differentiators:** activation = first real stakes challenge as the single north star; setup-as-side-effect just-in-time prerequisites; brand-voiced consequence microcopy; self-healing skip-already-done; sharp "pact is live" completion moment.

**Defer (v2+):** adaptive ordering by entry path (invited vs self-starter); per-step drop-off analytics; money coachmark anchored to user's own live numbers; re-engagement nudges.

**Hard anti-features (do NOT build):** front-loaded multi-screen wizard; "maybe later" nag loop; demo/sandbox/fake-stakes mode (contradicts consequence-first brand); blocking modal trapping the user; gamified completion badges.

### Architecture Approach

Client-side overlay layer on existing `(tabs)` UI — not a new wizard route group. Single `TourProvider` in the persistent `(tabs)` layout, server-hydrated from a parallel `getTourProgress()` fetch, completion probes (`hasGym`, `hasWeeklyGoal`, `hasViewedSecret`) derived from the same profile fetch. Load-bearing refactor: extract gym/schedule/shortcut action UIs from `app/onboarding/*/client.tsx` into wizard-agnostic shared components (`onComplete` callback instead of hard-coded navigation) so both legacy wizard and coachmark mount identical UI hitting identical endpoints.

**Components:** TourProvider (`components/tour/tour-provider.tsx`); Step Registry (`lib/onboarding/steps.ts`, `TOUR_VERSION`); Completion Probes (`lib/onboarding/completion.ts`, pure + unit-tested); CoachmarkRenderer (`components/tour/coachmark-renderer.tsx`, all library coupling isolated, spotlight + anchor gating + Radix-modal pause); CoachmarkCard (`components/tour/coachmark-card.tsx`); Shared Action Surfaces (`components/onboarding/{gym-picker,schedule-picker,shortcut-secret}.tsx`); Persistence API (`app/api/onboarding-progress/route.ts`); `data-tour` anchors on tab pages.

`(tabs)` redirect gate changes: only the `!username` hard-redirect remains; the `!onboarding_complete → /onboarding/schedule` redirect is removed so users enter the app immediately.

### Critical Pitfalls

1. **Spotlight targeting unmounted / Suspense-streamed content** — dashboard awaits a 5-query `Promise.all`; cycle tab is gender-conditional; ledger card renders only when debts exist. Prevention: gate each step on anchor presence before showing; never measure eagerly; declare conditionally-absent targets skippable.
2. **z-index collision** — TopNav z-40, MobileNav/Radix Dialog z-50, InstallGate z-[100]. Prevention: cutout-overlay (SVG mask / box-shadow ring, `pointer-events:none` dim layer, click-through); pause while any Radix dialog open; never run while InstallGate visible; verify `<body>` interactive after each transition (app already uses `modal={false}` for this reason).
3. **PWA safe-area & viewport** — compute placement against `100dvh` + `env(safe-area-inset-*)`; reserve fixed top/bottom bar zones; scroll target into view before spotlighting; verify on-device standalone on a notched phone.
4. **Progress write races / orphaned flags** — store `completed_steps` as semantic string keys with idempotent additive append; derive completion from real state where possible; Zod-validate PATCH.
5. **Blocking tour / no skip / teach-instead-of-act** — Skip is first-class on every step; each teaching step completes via a real action, not a "Next" tap; core loop usable regardless of tour state.
6. **Tour-version drift on replay** — `last_step_id` semantic string; `TOUR_VERSION` constant + `tour_version` column; re-offer when persisted version < current; derive completion at replay time.

## Implications for Roadmap

Suggested 8 phases (dependency-ordered):

1. **Data Foundation** — migration `0030_onboarding_progress` + RLS + `GET/PATCH /api/onboarding-progress` (Zod); semantic keys + `tour_version`; `shortcut_viewed` flag decision. Addresses server-persisted progress, Pitfalls 4 & 6.
2. **Pure Logic Layer** — `lib/onboarding/steps.ts` (STEPS, `TOUR_VERSION`) + `completion.ts` predicates + Vitest. Addresses skip-already-done, Pitfalls 6 & 8. Standard patterns.
3. **Shared Action Surface Extraction** — `components/onboarding/{gym-picker,schedule-picker,shortcut-secret}.tsx` (`onComplete` callback); refactor legacy wizard to thin shells, still working. Addresses act-don't-teach. Standard patterns.
4. **TourProvider + Persistence Wiring (no coachmarks)** — provider in `(tabs)/layout.tsx`, server-hydrate, verify resume/persist; remove `!onboarding_complete` redirect (username-only gate); Settings "Replay" stub. Standard patterns.
5. **Coachmark Engine (single-route, no content)** — library integration, spotlight, cutout overlay, z-index reconciliation, safe-area, a11y (focus trap, aria-live, reduced-motion, keyboard); verified on-device. Addresses Pitfalls 1, 2, 3. **NEEDS RESEARCH SPIKE: library pick + Radix-dialog-internal anchoring before this phase.**
6. **Cross-Route Sequencing** — navigate-then-wait logic; pathname + anchor dual-gate; full gym → challenge → money → shortcut path across tabs. Addresses Pitfall 2.
7. **Teaching Content + data-tour Anchors** — four `data-tour` attributes, four teaching steps with brand-voiced copy + real completion signals, embedded action surfaces, iOS conditional + manual fallback, checklist UI, dashboard empty-state CTA.
8. **Skip-on-Complete + Minimal Start + Replay Hardening** — end-to-end skip-already-done; replay from settings; `tour_version` bump path; clean legacy `/onboarding/*` redirect chain; verify PITFALLS "looks done but isn't" checklist.

**Phase ordering rationale:** data → pure logic → UI; extract before embed; state before rendering; single-route before cross-route; engine before content; hardening last.

**Research flags:** Phase 5 needs a spike (react-joyride v3 vs Onborda/NextStep; Radix-dialog anchoring). Phases 1,2,3,4,6,7,8 are standard patterns.

## Open Questions (carry into requirements)

1. **Library pick:** react-joyride v3 (mature, needs cross-route glue) vs Onborda/NextStep (App Router-native routing). Spike before Phase 5.
2. **Invited-path tour variant:** if a user arrives via a partner's invite, aha = "accept" not "start." Scope to v1.1 or defer? Affects step registry branching.
3. **"Tour complete" definition:** first challenge live (recommended, activation-aligned) vs all four steps taught? Affects Phase 1 schema (`completed_at`/status).
4. **Radix-dialog-internal anchoring:** pause-and-resume during dialog lifetime vs portal-within-portal.
5. **`shortcut_viewed` flag placement:** `profiles` column vs `completed_steps` JSONB entry.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | react-joyride v3 registry/docs/license verified 2026-06-14; Supabase RLS is existing standard |
| Features | HIGH (table stakes) / MEDIUM (SweatPact-specific) | UX patterns well-sourced; no direct real-money-gym-pact onboarding teardown exists |
| Architecture | HIGH | Grounded in actual codebase files and existing conventions |
| Pitfalls | HIGH (codebase-grounded) / MEDIUM (general UX) | Critical pitfalls tied to specific files + CONCERNS.md |

**Overall confidence:** HIGH

---
*Research synthesized: 2026-06-14*
