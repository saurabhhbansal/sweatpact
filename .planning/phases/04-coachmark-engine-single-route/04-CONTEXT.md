# Phase 4: Coachmark Engine (single-route) - Context

**Gathered:** 2026-06-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the coachmark rendering engine — the visual layer that takes `currentStepId` from `useTour()` and shows a spotlight + tooltip on screen. The Phase 3 `TourProvider` is wired and ready; Phase 4 makes something actually appear.

**Delivers:**
- react-joyride v3.1 integrated as the spotlight/positioning engine, loaded via `next/dynamic({ssr:false})`, isolated from Radix portals via a dedicated `#tour-root` portal element
- `CoachmarkCard` — a fully custom React component passed to joyride's `tooltipComponent` prop; handles all visual UI (joyride owns positioning only)
- `CoachmarkRenderer` — the `"use client"` wrapper that reads `useTour()`, passes `currentStepId` to joyride, and handles advance/dismiss calls
- Click-through cutout overlay (pointer-events: none dim layer), coexisting with the z-40/z-50 nav stack and z-[100] InstallGate
- Pause/hide behavior when any Radix dialog is open
- PWA safe-area aware positioning (`env(safe-area-inset-*)`)
- Keyboard-operable: advance (Enter/Space), dismiss (Escape), and focus management
- Reduced-motion support and `aria-live` announcements
- `data-tour` anchor attributes on at least one route to prove the system end-to-end

**Requirements:** TOUR-01, TOUR-02, TOUR-03, TOUR-04.

**Not this phase:** cross-route navigate-then-reveal (Phase 5), coachmark teaching copy and embedded action surfaces (Phase 5), replay Settings entry (Phase 6), step auto-skip from real app state (Phase 6 hardening). Phase 4 proves the engine works on a single route; content rides on it in Phase 5.

</domain>

<decisions>
## Implementation Decisions

### Library choice

- **D-01: react-joyride v3.1 as the rendering engine.** MIT license, React 18/19 ready, controlled step index (`stepIndex` prop driven by `currentStepId`), renders a fully custom React component per step via `tooltipComponent`, positions via Floating UI, and isolates from Radix portals via `portalElement` pointed at a dedicated `<div id="tour-root">` in the DOM. Import via `next/dynamic({ ssr: false })` into a `"use client"` wrapper (`CoachmarkRenderer`). This is the library the research recommended; Phase 4 confirms it works before Phase 5 builds on it.

- **D-02: Fully custom React component via `tooltipComponent` prop.** A `CoachmarkCard` component is passed to joyride's `tooltipComponent` prop — joyride provides positioning and the spotlight effect; `CoachmarkCard` owns all visual UI, all copy, all buttons. This is the interface Phase 5 will extend to embed gym/schedule action surfaces inside the card. No joyride built-in tooltip styling is used.

- **D-03: Load via `next/dynamic({ ssr: false })`.** The `CoachmarkRenderer` (which mounts joyride) is dynamically imported with `ssr: false` so it never runs on the server and never blocks RSC hydration.

### Radix dialog handling

- **D-04: Pause/hide the coachmark when any Radix dialog is open.** When a Radix dialog opens (`[data-state="open"]` on any `[role="dialog"]`), the coachmark is hidden. It re-appears when the dialog closes. Detection via `MutationObserver` watching for Radix `data-state` attribute changes, or by subscribing to dialog open/close events if a simpler mechanism is available. This is sufficient for Phase 4's single-route scope; portal-within-portal (coachmark inside a dialog) is deferred beyond Phase 5.

### Coachmark card visual design

- **D-05: Card structure — title + body text + Next button + Skip link.** Each step shows: a step title at the top, 1-2 sentences of instructional body text, a primary "Next →" button to call `advance()`, and a "Skip tour" text link below the button to call `dismiss()`. Phase 5 will add an optional embedded action surface between the body text and the buttons (no structural change needed at that point — just insert the surface slot).

- **D-06: Dismiss affordance — "Skip tour" text link below the Next button.** Not a header X button. The "Skip tour" link is visually secondary (smaller, muted color) so advance remains the primary call-to-action. Calls `dismiss()` from `useTour()`.

- **D-07: Progress indicator — dot indicators.** Five dots displayed below the card body (one per step in the STEPS registry). The current step's dot is filled/highlighted; past steps' dots are partially filled or a secondary color; future steps' dots are dim/empty. This shows the user where they are without text like "2 of 5."

- **D-08: Visual style — brand dark card.** Dark background (consistent with SweatPact's consequence-first identity, not the standard shadcn light card). White body text, step title in white/light. The "Next →" button uses the app's accent color. "Skip tour" link is muted (lower contrast gray). The card should feel like it belongs to the brand, not like a generic onboarding tooltip.

### Claude's Discretion

- **Spotlight cutout style:** box-shadow ring (`box-shadow: 0 0 0 9999px rgba(0,0,0,0.5)`) on the highlighted element is the recommended approach — it's simpler, scroll-safe, and doesn't require SVG masks. If the element shape benefits from rounded corners matching the element, `border-radius` is added. Claude picks the exact implementation that passes TOUR-02 (click-through, no input trapping).
- **Proof-of-concept anchor:** which specific route and `data-tour` attribute(s) to add in Phase 4. Dashboard + a step from the registry is the expected target (e.g., `data-tour="challenge"` on the CTA, or `data-tour="schedule"` on the weekly goal card). Claude picks based on what's actually mounted unconditionally on the dashboard route.
- **"Next →" button label:** "Next →" as the default; Claude may use step-specific phrasing ("Got it →") if it reads better in context. Must be ≤ 20 chars.
- **Card width + arrow/pointer:** standard tooltip arrow pointing toward the anchored element; card width ~280-320px on desktop, full-width with margin on mobile. Claude decides exact values.
- **`#tour-root` div placement:** Claude places it in the root layout or `(tabs)` layout as appropriate for portal isolation.
- **Keyboard focus trap:** coachmark should NOT trap focus inside the card (the rest of the page stays interactive per TOUR-02). Tab navigates through the card buttons only when focus is explicitly moved there.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/ROADMAP.md` §"Phase 4: Coachmark Engine (single-route)" — goal + 4 success criteria (TOUR-01 through TOUR-04).
- `.planning/REQUIREMENTS.md` — TOUR-01 (mounted-element targeting, skip absent), TOUR-02 (click-through cutout, z-index, Radix dialog coexistence), TOUR-03 (PWA safe-area on notched device), TOUR-04 (keyboard, focus, reduced-motion, aria-live).

### Research (library analysis + pitfalls)
- `.planning/research/SUMMARY.md` — Recommended Stack section (react-joyride v3.1 details), Critical Pitfalls (spotlight targeting unmounted content, z-index collision, PWA safe-area), Architecture Approach.

### Prior-phase contracts this phase builds on
- `.planning/phases/03-minimal-start-tourprovider-wiring/03-CONTEXT.md` — TourProvider API (D-07: `currentStepId`, `isActive`, `advance()`, `dismiss()`), D-05 (TourProvider wraps children in `(tabs)` layout), D-08 (TourProvider owns persistence writes).
- `src/components/tour-provider.tsx` — TourProvider + `useTour()` hook (Phase 3 output). Read the frozen `TourValue` type before extending the context API.
- `src/lib/onboarding/steps.ts` — `STEPS` registry (5 steps: schedule, gym, challenge, money, shortcut_viewed), `TOUR_VERSION`, `TEACHING_KEYS`. Phase 4 reads this to know step count for dot indicators and valid step ids.
- `src/lib/onboarding/completion.ts` — completion probes (for any auto-skip logic Phase 4 may wire).

### Z-index and overlay context
- `.planning/codebase/CONCERNS.md` — z-index collision risks documented here. TopNav z-40, MobileNav/Radix Dialog z-50, InstallGate z-[100]. Coachmark overlay must be above all of these.

### Codebase conventions
- `.planning/codebase/CONVENTIONS.md` — naming, TypeScript strict, `"use client"` placement.
- `.planning/codebase/STACK.md` — Radix UI, shadcn, Tailwind CSS 3.4, next/dynamic usage.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/tour-provider.tsx` `useTour()` — exposes `currentStepId`, `isActive`, `advance(stepId)`, `dismiss()`. `CoachmarkRenderer` calls these directly; no new state management needed.
- `src/lib/onboarding/steps.ts` `STEPS` — length is the dot-count for the progress indicator. Step order determines which dot is "current."
- `react-easy-crop` in package.json — confirms `next/dynamic({ssr:false})` pattern is already used in the codebase for client-only components; match that import style.
- Tailwind CSS `tailwindcss-animate` — existing package; use for card enter/exit animation and spotlight fade.

### Established Patterns
- `"use client"` directive at top of all client components (CONVENTIONS.md).
- `next/dynamic({ ssr: false })` for browser-only modules (react-easy-crop is current example).
- Radix Dialog `data-state` attribute — Radix sets `data-state="open"` on `[role="dialog"]` elements; MutationObserver on `document.body` watching for `[role="dialog"][data-state="open"]` is the cleanest detection mechanism for D-04.
- Tailwind utility classes for dark backgrounds: `bg-gray-900`, `bg-zinc-900`, or CSS variable — check `tailwind.config.ts` for the project's dark token before picking a class.

### Integration Points
- `CoachmarkRenderer` mounts inside the `(tabs)` layout below `TourProvider` (TourProvider is already the outermost wrapper). `CoachmarkRenderer` calls `useTour()` to read `currentStepId`.
- `#tour-root` div — a portal target div injected into the layout (or root layout) to isolate joyride's portal from the Radix portal layer. Must render at the same level as `<Toaster>` / other portals.
- `data-tour="<step-id>"` attributes — added to elements in the target route's page component. Phase 4 adds at least one such attribute to prove the anchor system works.
- `src/app/(tabs)/layout.tsx` — already renders `<TourProvider>`. `CoachmarkRenderer` (a sibling or child inside the provider) is added here.

</code_context>

<specifics>
## Specific Ideas

- Dark card visual identity: dark background (near-black, e.g., `bg-zinc-900` or the Tailwind dark token from `tailwind.config.ts`), white/near-white body text, accent-colored "Next →" button matching the app's primary action color.
- "Skip tour" placed below the primary button as a subtle gray link — visually secondary so advance remains the dominant action.
- Dot indicators: 5 dots (one per STEPS entry), horizontally centered below the card body. Current dot: filled accent color. Past dots: partially filled or secondary color. Future dots: dim.
- react-joyride `portalElement` prop: point at `document.getElementById("tour-root")` so joyride's overlay never conflicts with Radix portal DOM hierarchy.
- joyride `disableScrollParentFix: true` is often needed in Next.js App Router to prevent joyride from scroll-locking the body incorrectly — worth trying by default.
- Reduced-motion: wrap joyride's `floaterProps.disableAnimation` and the card's own CSS transitions behind `window.matchMedia("(prefers-reduced-motion: reduce)")`.

</specifics>

<deferred>
## Deferred Ideas

- **Cross-route navigate-then-reveal** — Phase 5. Phase 4 proves the engine on one route; multi-route sequencing is Phase 5's problem.
- **Coachmark teaching copy and data-tour content** — Phase 5. Phase 4 may use placeholder copy to prove the card renders; final step copy is Phase 5.
- **Embedded action surfaces inside the card** (gym picker, schedule picker, shortcut) — Phase 5. Card structure (D-05) is designed to accommodate a surface slot, but surfaces aren't wired in Phase 4.
- **Portal-within-portal (coachmark inside a Radix dialog)** — deferred beyond Phase 5. D-04 (pause/hide) is sufficient for Phase 4; if Phase 5 needs a step that targets content inside a dialog, revisit then.
- **Replay Settings entry** — Phase 6.
- **Auto-skip from real app state (gym set, schedule set, shortcut viewed)** — Phase 6 hardening. Phase 4 may pass neutral probe values like Phase 3 did.
- **`isComplete` / `progress` expansion of TourValue** — Phase 5+ when the coachmark card needs to know about completion state. Still deferred per Phase 3 D-07.

</deferred>

---

*Phase: 04-coachmark-engine-single-route*
*Context gathered: 2026-06-18*
