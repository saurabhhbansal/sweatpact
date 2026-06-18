# Phase 5: Cross-Route Walkthrough & Teaching Content - Context

**Gathered:** 2026-06-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the full walkthrough end-to-end: navigate the coachmark engine across tabs using a route-aware STEPS registry, embed real setup surfaces (gym, schedule, shortcut) inline inside the expanding coachmark card, teach all four points through real in-context actions, handle both entry paths (self-starter and invited), surface the "getting started" checklist and empty-state CTA, and ship brand-voiced copy across all five steps.

**Delivers:**
- `route` field added to STEPS registry entries; `CoachmarkRenderer` owns navigate-then-reveal (dual-gate: pathname match + anchor present)
- `data-tour` anchor attributes added to target elements on `/dashboard`, `/groups`, `/notifications`, and `/shortcut`
- `CoachmarkCard` extended to render an optional inline surface slot (max-height, scrollable) between body and buttons; surface `onComplete` = `advance(stepId)`
- Real GymSurface, ScheduleSurface, and ShortcutSurface embedded in respective steps; challenge and money steps are teaching-only (no embedded surface)
- Practice check-in: pure UI simulation inside the shortcut card — no API call; brief animation then `advance('shortcut_viewed')` fires
- Both entry paths: invited users (pendingCount > 0 on /groups) route the challenge step to `/notifications`; self-starters route to `/groups`
- 4-item "getting started" checklist on dashboard (UX-01); "Start your first pact" empty-state CTA (UX-02); outcome-framed brand-voiced copy across all steps (UX-04)

**Requirements:** TOUR-05, ONB-03, TEACH-01, TEACH-02, TEACH-03, TEACH-04, TEACH-05, SETUP-02, UX-01, UX-02, UX-04

**Not this phase:** replay from Settings (Phase 6), auto-skip from real app state at tour start (Phase 6 hardening), "pact is live" completion moment (Phase 6), per-step drop-off analytics (v1.x/v2).

</domain>

<decisions>
## Implementation Decisions

### Embedded setup surfaces

- **D-01: Surfaces appear inline inside the coachmark card.** When the walkthrough reaches a step with a `surface` (gym, schedule, shortcut_viewed), `CoachmarkCard` renders the corresponding shared surface component in an optional slot between the body text and the buttons. The card expands to contain the surface.

- **D-02: Card height is bounded — scrolls internally.** The card has a fixed `max-height` (e.g., `80vh`) with `overflow-y: auto` on the surface slot. Gym search results and schedule pickers scroll inside the card. The card as a whole never overflows the viewport (safe-area insets applied per Phase 4 TOUR-03).

- **D-03: Surface `onComplete` is the only advance trigger on surface steps.** When a surface is embedded, there is no standalone "Next →" button. The surface's own "Continue" / "Skip for now" buttons call `advance(stepId)`. "Skip tour" remains as a text link below the surface (ONB-04). This makes the real action the primary CTA.

- **D-04: ShortcutSurface is embedded on the shortcut_viewed step** (same pattern as gym/schedule). ShortcutSurface already handles the `shortcut_viewed` write via `PATCH /api/onboarding-progress`. Its `onComplete` = `advance('shortcut_viewed')`.

### Practice check-in

- **D-05: Pure UI simulation — no API call.** The "try a check-in" moment in the shortcut step is cosmetic only: a clearly-labeled "Practice check-in" button triggers a brief animation/spinner, then calls `advance('shortcut_viewed')` directly. Zero contact with `/api/checkin`. No risk of touching financial-critical tables. The card copy makes clear this is a practice run, not real.

### Cross-route navigation

- **D-06: STEPS registry gets an optional `route` field per step.** Each step entry gets `route?: string` pointing to the tab route where its anchor lives. `CoachmarkRenderer` owns navigate-then-reveal: when `advance()` fires, it reads the NEXT step's route, compares to `usePathname()`, and calls `router.push(nextRoute)` if they differ. The existing `MutationObserver` anchor-gate already handles "wait for anchor after navigation" — no new polling needed.

- **D-07: Route mapping for the 5 steps:**
  - `schedule` → `/dashboard` (weekly goal card already has `data-tour="schedule"`)
  - `gym` → `/dashboard` (gym empty-state CTA or gym card)
  - `challenge` → `/groups` (start CTA) — OR `/notifications` for invited users (see D-09)
  - `money` → `/groups` (financial summary / stakes area)
  - `shortcut_viewed` → `/shortcut` (existing Shortcut settings page)

- **D-08: TourProvider stays frozen.** The `TourValue` type is not extended. All navigation logic lives in `CoachmarkRenderer`, which already imports `useRouter` and `usePathname` as a client component.

### Invited-path variant (ONB-03)

- **D-09: Runtime pendingCount check determines variant — no registry fork.** When `CoachmarkRenderer` is on `/groups` or about to navigate there for the challenge step, it checks whether the user has a pending challenge invitation (pendingCount > 0). This can be read from the DOM (the `/groups` page already renders `pendingCount`) via a `data-pending-count` attribute, or via a lightweight client-side fetch to the existing groups API.

- **D-10: Invited users route the challenge step to `/notifications`.** If pendingCount > 0, the challenge step's effective route becomes `/notifications` (where `accept` / `decline` buttons already exist and the `respond()` flow is implemented). The anchor for the invited variant targets the pending challenge notification card. Self-starters stay on `/groups`. Same step ID `challenge` — no TOUR_VERSION bump needed.

### Claude's Discretion

- **`data-tour` anchor placement on each route:** Claude picks which specific element to anchor on `/groups` (the new-challenge search CTA vs. the "No challenges yet" empty state), `/notifications` (the first pending challenge card), `/shortcut` (the webhook URL section or the iOS button). Must be unconditionally mounted — never inside a loading/streaming slot.
- **`data-pending-count` attribute vs. fetch:** Claude decides whether to read pending invite count from a DOM attribute set by the `/groups` page server component, or via a client-side fetch. DOM attribute is simpler and zero-latency; fetch is more explicit. Both are acceptable.
- **Getting started checklist position on dashboard:** Claude places it above or below the daily view based on visual weight and what makes sense in the existing dashboard layout. It should derive from `useTour()` `completedSteps` client-side — no extra fetch.
- **Teaching copy for challenge and money steps:** Claude writes brand-voiced, outcome-framed copy (consequence-first, "stakes not stats") per UX-04. Challenge copy: "Start a challenge with your gym partner. Real money on the line — if you skip, you owe." Money copy anchors to the earned/owed/penalties summary visible on the groups page.
- **"Start your first pact" empty-state CTA (UX-02):** Claude determines the condition (no active challenges), placement on the dashboard, and CTA copy. Should match the brand voice.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/ROADMAP.md` §"Phase 5: Cross-Route Walkthrough & Teaching Content" — goal + 5 success criteria (TOUR-05, ONB-03, TEACH-01..05, SETUP-02, UX-01..02, UX-04)
- `.planning/REQUIREMENTS.md` — full requirement bodies for all 11 Phase 5 requirements (TOUR-05, ONB-03, TEACH-01 through TEACH-05, SETUP-02, UX-01, UX-02, UX-04)

### Phase 4 engine contracts (this phase builds directly on these)
- `.planning/phases/04-coachmark-engine-single-route/04-CONTEXT.md` — all D-01..D-08 decisions; frozen `TourValue` type; card structure (D-05); Radix dialog pause (D-04); z-index (COACHMARK_Z_INDEX = 110, above InstallGate z-[100])
- `src/components/tour-provider.tsx` — frozen `TourValue` type (`currentStepId`, `isActive`, `advance()`, `dismiss()`). DO NOT extend in Phase 5.
- `src/components/tour/coachmark-renderer.tsx` — the Phase 4 renderer. Phase 5 extends this file to add route-aware navigation. Read in full before modifying.
- `src/components/tour/coachmark-card.tsx` — the Phase 4 card component. Phase 5 adds the surface slot.

### Step registry and completion logic
- `src/lib/onboarding/steps.ts` — `STEPS` registry, `TOUR_VERSION`, `TEACHING_KEYS`, `OnboardingStep` type. Phase 5 adds `route?: string` to the type and populates it. DO NOT bump `TOUR_VERSION` unless the step set/order/id changes.
- `src/lib/onboarding/current-step.ts` — `deriveCurrentStep()`. Phase 5 reads this but does not modify it.
- `src/lib/onboarding/completion.ts` — completion probes (`isGymDone`, `isScheduleDone`, `isShortcutDone`, `isTourComplete`).

### Shared setup surfaces (Phase 2 output — reuse without modification)
- `src/components/onboarding/gym-surface.tsx` — `GymSurface({ initialGymCount, onComplete })`. Phase 5 embeds this inline in the card for the gym step.
- `src/components/onboarding/schedule-surface.tsx` — `ScheduleSurface({ initialGoal, initialRestDays, onComplete })`. Phase 5 embeds for the schedule step.
- `src/components/onboarding/shortcut-surface.tsx` — `ShortcutSurface({ onComplete })`. Phase 5 embeds for the shortcut_viewed step. Already writes `complete_step: "shortcut_viewed"` to `PATCH /api/onboarding-progress`.

### Existing route pages (where data-tour anchors will be added)
- `src/app/(tabs)/dashboard/page.tsx` — already has `data-tour="schedule"` on the weekly goal section (line 119). Phase 5 adds `data-tour="gym"` anchor.
- `src/app/(tabs)/groups/page.tsx` — challenge + money anchors go here. Renders `pendingCount` (pending invitations). Phase 5 adds `data-tour="challenge"` and `data-tour="money"` anchors.
- `src/app/(tabs)/notifications/client.tsx` — invited-path challenge anchor goes here. Already renders pending challenge invitation cards with accept/decline buttons. Phase 5 adds `data-tour="challenge"` on the first pending challenge card.
- `src/app/(tabs)/shortcut/page.tsx` — shortcut_viewed anchor goes here.

### Z-index and overlay (carried from Phase 4)
- `.planning/codebase/CONCERNS.md` — z-index collision risks. TopNav z-40, MobileNav/Radix Dialog z-50, InstallGate z-[100]. Coachmark overlay stays at z-110.

### Codebase conventions
- `.planning/codebase/CONVENTIONS.md` — naming, TypeScript strict, `"use client"` placement.
- `.planning/codebase/STACK.md` — Radix UI, shadcn, Tailwind CSS 3.4, `next/dynamic` usage.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useTour()` from `src/components/tour-provider.tsx` — `currentStepId`, `isActive`, `advance(stepId)`, `dismiss()`. Phase 5 uses unchanged.
- `GymSurface`, `ScheduleSurface`, `ShortcutSurface` from `src/components/onboarding/` — Phase 2 output. Already `onComplete`-driven, no navigation logic. Embed directly in `CoachmarkCard`'s surface slot.
- `STEPS`, `TEACHING_KEYS`, `OnboardingStep` from `src/lib/onboarding/steps.ts` — Phase 5 adds `route?: string` to the type; populates it for all 5 steps.
- `MutationObserver` anchor-gate in `CoachmarkRenderer` — already handles "wait for `data-tour` anchor to mount." After `router.push()`, this observer fires naturally when the new page mounts the anchor. No polling needed.
- `pendingCount` on `/groups` page — already derived from `challenge_invitations` select (groups/page.tsx:60). Phase 5 exposes this as a `data-pending-count` attribute or makes it readable for the invited-path detection.

### Established Patterns
- `usePathname()` + `useRouter()` from `next/navigation` — already available in `CoachmarkRenderer` (it's a `"use client"` component). Add these hooks for navigation logic.
- `MutationObserver` on `document.body` — already used in `CoachmarkRenderer` for anchor readiness (TOUR-01) and Radix dialog detection (D-04). Same pattern for post-navigation anchor wait.
- `data-tour="<step-id>"` attributes — Phase 4 established this naming. Phase 5 adds more anchors on other routes following the same pattern.
- Phase 2 surface `onComplete` pattern — all three surfaces already have `onComplete` props that call `advance()` equivalent; Phase 5 wires `onComplete` to `useTour().advance(stepId)`.

### Integration Points
- `CoachmarkRenderer` (extend, don't replace) — add `usePathname()`, `useRouter()`, and a `nextStepRoute()` helper that reads the next unstarted step's `route` from `STEPS`. Navigation fires in the `handleAdvance` callback before the anchor-gate check for the new step.
- `CoachmarkCard` (extend surface slot) — add `surface?: React.ReactNode` prop. Render it in a `max-h-[calc(80vh-8rem)] overflow-y-auto` container between body and buttons when present. Remove the "Next →" button when `surface` is provided (D-03).
- `/groups` page server component — add `data-pending-count={pendingCount}` attribute to a container element so `CoachmarkRenderer` can read it without a fetch.
- 4-item checklist component — new component reading `useTour()` `completedSteps` client-side. Each item maps to one TEACHING_KEY. Render on dashboard.

</code_context>

<specifics>
## Specific Ideas

- **Practice check-in animation:** brief pulse or checkmark animation (tailwindcss-animate already installed) on the "Practice check-in" button before `advance('shortcut_viewed')` fires. 400ms max, respects reduced-motion.
- **Invited-path copy:** challenge card variant for invited users: "Your partner challenged you — this is where you respond." Anchor on the pending invite card in notifications.
- **Money step teaching:** "This is the scoreboard that matters — what you've earned, what you owe." Anchor to the earned/owed summary section in the groups page (already rendered as financial data). No surface needed — presented-only step.
- **"Getting started" checklist:** 4 items tracking gym, challenge, money, shortcut_viewed. Read from `useTour()` `completedSteps`. Each item shows a checkmark when its key is in `completedSteps`. Placed above the daily check-in strip on the dashboard. Disappears when all 4 keys are in `completedSteps` (tour complete).
- **Empty-state CTA (UX-02):** "Start your first pact" shown on the dashboard when `groupCount === 0`. Brand-voiced — not a generic "Get started." Consequence-first framing: "No stakes yet. Your partner is waiting."

</specifics>

<deferred>
## Deferred Ideas

- **Auto-skip from real app state at tour start** (gym set, schedule set, shortcut viewed) — Phase 6. Phase 5 passes neutral probe values as Phase 3/4 did.
- **Replay from Settings** (PROG-03) — Phase 6.
- **"Pact is live" completion moment** (UX-03) — Phase 6.
- **Portal-within-portal** (coachmark inside a Radix dialog) — deferred beyond Phase 5 per Phase 4 D-04.
- **Per-step drop-off analytics** (ANL-01) — v1.x/v2.
- **Money coachmark anchored to user's own live numbers** (TEACH-07) — v2 polish.

</deferred>

---

*Phase: 05-cross-route-walkthrough-teaching-content*
*Context gathered: 2026-06-18*
