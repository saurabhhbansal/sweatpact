# Phase 6: Skip-on-Complete, Replay & Completion Hardening - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-18
**Phase:** 06-skip-on-complete-replay-completion-hardening
**Areas discussed:** Completion moment, Replay semantics, Legacy /onboarding cleanup

---

## Completion moment (UX-03)

**Q1: What triggers the "pact is live" completion moment?**

| Option | Description | Selected |
|--------|-------------|----------|
| Tour complete (all 4 keys done) | Fires when isTourComplete() flips true — gym + challenge + money + shortcut all done. Captures the "you learned the app" moment. | |
| First active challenge exists | Fires when the user has their first real challenge. Captures the "pact is live" — money actually on the line. | ✓ |
| Both — but prefer challenge | Tour completion shows a lighter moment; first active challenge fires the bigger "pact is live" celebration. | |

**User's choice:** First active challenge exists
**Notes:** The emotional peak is the challenge going live — real money on the line — not just completing the tutorial.

---

**Q2: What form does the "pact is live" moment take?**

| Option | Description | Selected |
|--------|-------------|----------|
| Full-screen overlay / modal | Covers the whole screen with a branded message and a single dismiss CTA. High impact, hard to miss. Dismissed once, never shown again. | ✓ |
| Inline banner on /groups | A persistent top-of-page banner on the groups screen. Less intrusive. | |
| Toast + stay in flow | A branded toast notification. Minimal friction but easy to miss. | |

**User's choice:** Full-screen overlay / modal
**Notes:** This is the biggest moment in the product — deserves full-screen treatment.

---

**Q3: When does the "pact is live" overlay appear?**

| Option | Description | Selected |
|--------|-------------|----------|
| On /groups page load when first active challenge detected | RSC already reads challenge data — pass a flag down, zero extra fetch. Shows once. | ✓ |
| Immediately after challenge creation/acceptance action | More immediate but requires overlay inside the action handler — harder to guarantee for both paths. | |
| You decide | Claude picks the triggering moment. | |

**User's choice:** On /groups page load when first active challenge detected
**Notes:** Works for both self-starters (created challenge) and invited users (accepted challenge) since both land on /groups.

---

## Replay semantics (PROG-03)

**Q1: When the user hits "Replay walkthrough" in Settings, what happens to their completed_steps?**

| Option | Description | Selected |
|--------|-------------|----------|
| Reset server-side — fresh start | PATCH clears completed_steps to []. User walks through all 5 steps including already-done ones. True replay. | |
| Keep server state — auto-skip applies | completed_steps stays intact. deriveCurrentStep() skips done steps. Replay fast-forwards past done steps. | ✓ |

**User's choice:** Keep server state — auto-skip applies
**Notes:** Replay = re-enter the tour and skip what's already done. Smart replay, not a full reset.

---

**Q2: Where in Settings does the replay entry point live?**

| Option | Description | Selected |
|--------|-------------|----------|
| New "Walkthrough" section at the bottom of SettingsForm | Dedicated section with a brief label. Clean separation. | |
| Inside existing content, near onboarding-related settings | Tucked near gym or schedule sections. Contextually related. | ✓ |
| You decide | Claude places it logically. | |

**User's choice:** Inside existing content, near the onboarding-related settings
**Notes:** Contextual placement feels more natural than a standalone section.

---

**Q3: Does replay need any API endpoint work?**

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse existing PATCH — send complete_step: "replay" or similar signal | Extend existing endpoint minimally. Zero new handlers. | ✓ |
| New endpoint — POST /api/onboarding-progress/replay | Explicit separate route. More code to maintain. | |
| You decide | Claude picks the cleanest integration. | |

**User's choice:** Reuse existing PATCH — send complete_step: "replay" or similar signal
**Notes:** Keep the API surface minimal. Phase 1 PATCH is the right home for this.

---

## Legacy /onboarding cleanup

**Q1: What happens to the old wizard pages?**

| Option | Description | Selected |
|--------|-------------|----------|
| Delete them entirely | Dead code — shared surfaces replaced these in Phase 2. No live route links to them. | ✓ |
| Redirect to /dashboard | Keep route files but add redirect(). Safer but leaves more code. | |

**User's choice:** Delete them entirely
**Notes:** Confirmed the shared surfaces are the replacement. Old wizard pages are dead code.

---

**Q2: What happens to /onboarding/username and step-indicator.tsx?**

| Option | Description | Selected |
|--------|-------------|----------|
| Keep username, delete step-indicator | /onboarding/username = mandatory-start entry point (ONB-01). step-indicator.tsx = orphaned wizard progress bar. | ✓ |
| Keep both | Leave step-indicator even if unused. | |
| You decide | Claude audits references and deletes orphaned files. | |

**User's choice:** Keep username, delete step-indicator (Recommended)
**Notes:** Username page is load-bearing. step-indicator.tsx has no live references.

---

## Claude's Discretion

- "Pact is live" seen-tracking mechanism: `completed_steps` entry vs. localStorage — Claude picks
- Replay API extension: minimal Zod schema addition — Claude designs
- Skip-on-complete data flow path: layout RSC prop vs. TourProvider init — Claude determines
- "Pact is live" overlay copy: brand-voiced, consequence-first tone (UX-04)
- Orphaned import audit: Claude greps before deleting any file

## Deferred Ideas

- Per-step drop-off analytics (ANL-01) — v1.x/v2
- Money coachmark anchored to user's live numbers (TEACH-07) — v2
- Adaptive step ordering (ONB-05) — v1.x/v2
- Re-engagement nudge (ANL-02) — v1.x/v2
