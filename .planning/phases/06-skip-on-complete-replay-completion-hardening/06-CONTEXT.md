# Phase 6: Skip-on-Complete, Replay & Completion Hardening - Context

**Gathered:** 2026-06-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Self-heal the walkthrough around already-done state, add replay from Settings, land the "pact is live" completion moment, and delete the dead onboarding wizard — closing the v1.1 milestone.

**Delivers:**
- Skip-on-complete wired: `deriveCurrentStep()` receives real probe data (`gymCount`, `restDays`, `completedSteps`) from the layout/RSC level so steps whose work is already done are bypassed automatically at tour start
- Replay from Settings: a secondary button placed near the gym/schedule section in the existing `SettingsForm` that triggers a PATCH to `/api/onboarding-progress` using the existing endpoint (reactivates the tour without clearing `completed_steps`; auto-skip applies on replay, so already-done steps are fast-forwarded)
- "Pact is live" full-screen overlay: fires on `/groups` page load when the user has their first active challenge; dismissed once and never shown again; gated so it works for both self-starter and invited paths
- Legacy wizard cleanup: delete `/onboarding/gym`, `/onboarding/schedule`, `/onboarding/shortcut` pages and `step-indicator.tsx`; keep `/onboarding/username` (mandatory-start entry point, ONB-01)

**Requirements:** PROG-03, UX-03

**Not this phase:** per-step drop-off analytics (v1.x/v2), money coachmark anchored to user's live numbers (v2), TOUR-01..04 coachmark accessibility hardening (Phase 4 scope).

</domain>

<decisions>
## Implementation Decisions

### "Pact is live" completion moment (UX-03)

- **D-01: Trigger is first active challenge, not tour completion.** The overlay fires when the user has their first real challenge (real money on the line), not when `isTourComplete()` flips. This is the "pact is live" — the consequence moment. Tour completion is not the emotional peak; challenge activation is.

- **D-02: Full-screen overlay / modal form.** High-impact, brand-voiced, full-screen. User must dismiss it. Matches the weight of the moment — not a toast or banner.

- **D-03: Fires on /groups page load when first active challenge detected.** The `/groups` RSC already reads challenge data; passing a `showPactLive` flag (or similar) to the client component avoids an extra fetch. Shown once — track "seen" via a `completed_steps` entry (e.g., `pact_live_seen`) or a local flag; Claude picks the cleanest approach. Must work for both self-starters (created challenge) and invited users (accepted challenge) since both land on `/groups`.

### Replay from Settings (PROG-03)

- **D-04: Replay keeps server-side completed_steps intact — auto-skip applies.** No reset of `completed_steps`. The replay action reactivates `isActive = true` in the tour state so `deriveCurrentStep()` picks up where the user left off (skipping already-done setup steps). Replay = "re-enter the tour from the first non-done step."

- **D-05: Replay entry point is inside existing SettingsForm, near onboarding-related settings.** Not a separate section — placed contextually near wherever gym or schedule content appears in the current `SettingsForm`. A secondary/ghost button labeled "Replay app tour" or similar.

- **D-06: Reuse existing PATCH /api/onboarding-progress.** No new endpoint. The Phase 1 PATCH handler accepts semantic `complete_step` keys; Claude extends or reuses the endpoint to accept a replay signal (e.g., a body flag like `{ replay: true }`) that sets the tour back to active without touching `completed_steps`. Claude picks the cleanest API extension that keeps the existing Zod schema valid.

### Skip-on-Complete wiring (PROG-02 hardening)

- **D-07: Real probe data flows from the layout/RSC level.** Phase 5 passed neutral probe values. Phase 6 wires actual `gymCount`, `restDays[]`, and `completedSteps[]` into `deriveCurrentStep()` at tour initialization. The layout RSC already fetches profile data; the completion probes (`isGymDone`, `isScheduleDone`, `isShortcutDone`) in `src/lib/onboarding/completion.ts` are called with real values. Claude determines the exact data flow path (layout prop, TourProvider init, or completion.ts wrapper).

### Legacy /onboarding/* cleanup

- **D-08: Delete /onboarding/gym, /onboarding/schedule, /onboarding/shortcut entirely.** Dead code — the shared surfaces (GymSurface, ScheduleSurface, ShortcutSurface) replaced these in Phase 2. No routes in the live app link to them.

- **D-09: Delete step-indicator.tsx.** Was the wizard progress bar. Orphaned — nothing references it now that the old wizard is replaced.

- **D-10: Keep /onboarding/username.** Still the mandatory-start entry point (ONB-01, Phase 3). Do not touch.

### Claude's Discretion

- **"Pact is live" seen-tracking mechanism:** Claude picks between adding `pact_live_seen` to `completed_steps` (reuses existing PATCH endpoint) vs. a client-side localStorage flag. Prefer `completed_steps` if it fits the existing schema cleanly — persistent across devices.
- **Replay API extension:** Claude designs the minimal Zod schema addition to the existing PATCH handler body to accept a replay signal without breaking existing callers.
- **Skip-on-complete data flow path:** Claude determines whether real probe data is passed as props from the layout RSC, set in TourProvider init, or resolved inside `deriveCurrentStep()`. Must not add a new client-side fetch.
- **"Pact is live" overlay copy:** Claude writes brand-voiced, consequence-first copy. Reference: "Real money on the line. Show up or pay up." style per UX-04. The overlay should feel like a moment, not a notification.
- **Audit for other orphaned onboarding references:** Claude checks for any imports or links to the deleted wizard pages and cleans them up. Use grep before deleting.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/ROADMAP.md` §"Phase 6: Skip-on-Complete, Replay & Completion Hardening" — goal + 4 success criteria (PROG-03, UX-03, auto-skip end-to-end, legacy cleanup)
- `.planning/REQUIREMENTS.md` — full requirement bodies for PROG-03 and UX-03

### Completion logic and step registry (this phase wires real data into these)
- `src/lib/onboarding/completion.ts` — `isGymDone()`, `isScheduleDone()`, `isShortcutDone()`, `isTourComplete()`. Phase 6 calls these with real app state.
- `src/lib/onboarding/steps.ts` — `STEPS` registry, `TOUR_VERSION`, `TEACHING_KEYS`, `OnboardingStep` type. Read before modifying — TOUR_VERSION bump rules documented in the file header.
- `src/lib/onboarding/current-step.ts` — `deriveCurrentStep()`. Phase 6 wires real probe values into this function at initialization.

### Phase 1 API contract (replay reuses this)
- `src/app/api/onboarding-progress/route.ts` — existing PATCH handler. Phase 6 extends the Zod body schema minimally to accept a replay signal. Read before modifying.
- `.planning/phases/01-onboarding-data-foundation/01-CONTEXT.md` — D-03 (onboarding_progress is the runtime source of truth), D-04 (PATCH accepts semantic complete_step keys, dedupe-appended server-side; client never sends full array).

### Tour engine contracts (Phase 4 + 5 output — Phase 6 reads, does not modify these)
- `src/components/tour-provider.tsx` — frozen `TourValue` type. Do NOT extend.
- `src/components/tour/coachmark-renderer.tsx` — Phase 5 output. Read before any modification.
- `.planning/phases/05-cross-route-walkthrough-teaching-content/05-CONTEXT.md` — all Phase 5 decisions; D-05 (practice check-in cosmetic only); D-08 (TourValue frozen); D-09/D-10 (invited-path runtime swap).
- `.planning/phases/04-coachmark-engine-single-route/04-CONTEXT.md` — Phase 4 engine decisions; frozen card structure; z-index (COACHMARK_Z_INDEX = 110).

### Settings page (where replay entry point goes)
- `src/app/(tabs)/settings/page.tsx` — Settings RSC. Read before adding the replay entry.
- `src/app/(tabs)/settings/client.tsx` — `SettingsForm`. Read before adding the replay button.

### Groups page (where "pact is live" overlay fires)
- `src/app/(tabs)/groups/page.tsx` — reads challenge data. Phase 6 derives `hasActiveChallenge` flag here and passes to client.

### Legacy wizard files to DELETE
- `src/app/onboarding/gym/` (page.tsx + client.tsx)
- `src/app/onboarding/schedule/` (page.tsx + client.tsx)
- `src/app/onboarding/shortcut/` (page.tsx + client.tsx)
- `src/app/onboarding/step-indicator.tsx`

### Codebase conventions
- `.planning/codebase/CONVENTIONS.md` — naming, TypeScript strict, "use client" placement.
- `.planning/codebase/STACK.md` — Radix UI, shadcn, Tailwind CSS 3.4.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `isTourComplete(completedSteps)` from `src/lib/onboarding/completion.ts` — use for overlay trigger check; already accounts for TEACHING_KEYS. Not the trigger (D-01 uses challenge check), but useful for suppressing the overlay if somehow tour is marked complete without a challenge.
- `isGymDone(gymCount)`, `isScheduleDone(restDays)`, `isShortcutDone(completedSteps)` from `src/lib/onboarding/completion.ts` — wire these into `deriveCurrentStep()` with real data for skip-on-complete.
- `PATCH /api/onboarding-progress` — Phase 1's dedupe-append handler. Replay signal will extend this.
- `SettingsForm` (`src/app/(tabs)/settings/client.tsx`) — existing client component with profile/gym/schedule sections. Replay button goes here without restructuring.

### Established Patterns
- `data-pending-count` DOM attribute pattern (Phase 5) — same approach can be used to pass `hasActiveChallenge` from RSC to client overlay without extra fetch.
- Phase 2 surface `onComplete` pattern — reuse for any new completion callback wiring.
- Radix Dialog — for the full-screen overlay; already used throughout the app. `Dialog.Root` + `Dialog.Portal` + `Dialog.Content` is the established pattern. Coachmark z-index is 110; overlay must go above.
- `tailwindcss-animate` — already installed; use for entrance animation on the overlay.

### Integration Points
- `/groups/page.tsx` RSC → derive `hasActiveChallenge` (challenge_members select, challenge status check) → pass as prop to client component → overlay fires + marks seen
- `src/app/layout.tsx` or tab group layout → fetch real onboarding probe data (`gymCount`, `restDays`, `completedSteps`) → pass into TourProvider initialization for skip-on-complete
- `SettingsForm` client component → add replay button → call PATCH endpoint with replay signal → TourProvider reactivates

</code_context>

<specifics>
## Specific Ideas

- **"Pact is live" copy tone:** consequence-first, brand-voiced per UX-04. Something like "Your pact is live. Show up or pay up." — sharp, not celebratory-generic. This is not a confetti moment, it's a stakes moment.
- **Overlay dismiss:** single "Let's go →" CTA that dismisses and stays on /groups so the user can see their new challenge immediately.
- **Replay button label:** "Replay app tour" as secondary/ghost button — not "Restart", not "Tutorial". Short and action-clear.
- **Skip-on-complete visual behavior:** steps that are auto-skipped should feel instant (no flash of the step UI). Claude ensures `deriveCurrentStep()` fires with real data before the first step renders.

</specifics>

<deferred>
## Deferred Ideas

- **Per-step drop-off analytics (ANL-01)** — v1.x/v2.
- **Money coachmark anchored to user's live numbers (TEACH-07)** — v2 polish.
- **Adaptive step ordering by entry path (ONB-05)** — v1.x/v2.
- **Re-engagement nudge for non-converters (ANL-02)** — v1.x/v2.

</deferred>

---

*Phase: 06-skip-on-complete-replay-completion-hardening*
*Context gathered: 2026-06-18*
