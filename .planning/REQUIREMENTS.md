# Requirements: SweatPact

**Defined:** 2026-06-14
**Core Value:** Make showing up have a consequence — if you skip, you owe your partner.

> **Current milestone: v1.1 — Guided Onboarding Walkthrough.** Requirements for
> this milestone are below. The shipped v1.0 baseline is recorded at the bottom
> for reference. New work is added via `/gsd-new-milestone`.

## v1.1 Requirements — Guided Onboarding Walkthrough

Replace the front-loaded setup wizard with a minimal mandatory start plus a
contextual coachmark walkthrough that teaches the app and completes optional
setup in-context. Backed by research in `.planning/research/`.

### Onboarding Entry & Flow

- [ ] **ONB-01**: New user completes a minimal mandatory start (username only) and lands directly in the real app
- [ ] **ONB-02**: The `(tabs)` redirect gate no longer forces the full setup wizard — only a missing username redirects; optional setup is deferred into the walkthrough
- [ ] **ONB-03**: Walkthrough supports both entry paths — self-starter (start a challenge) and invited (accept a partner's challenge invite)
- [ ] **ONB-04**: User can skip the walkthrough at any step without being blocked or nagged, and keep using the app

### Coachmark Walkthrough Engine

- [ ] **TOUR-01**: Contextual coachmarks spotlight live UI elements one at a time, and only show once the target element is actually mounted (no spotlighting empty/streamed space)
- [ ] **TOUR-02**: The coachmark overlay is click-through (cutout) and coexists with the nav stack, Radix dialogs, and the install gate without trapping input or hiding behind chrome
- [ ] **TOUR-03**: Coachmarks position correctly within PWA safe-area insets on mobile standalone
- [ ] **TOUR-04**: Coachmarks are accessible — keyboard advance/skip/dismiss, focus handling, and reduced-motion support
- [ ] **TOUR-05**: The walkthrough sequences across tabs/routes (navigates, then reveals the next step once its anchor is ready)

### Teaching Steps

- [ ] **TEACH-01**: The walkthrough teaches and completes gym setup in-context (Google Places)
- [ ] **TEACH-02**: The walkthrough teaches starting (or accepting) a stakes challenge in-context
- [ ] **TEACH-03**: The walkthrough teaches the money model — earned/owed, penalties, settlement — anchored to real UI
- [ ] **TEACH-04**: The walkthrough teaches the iOS Shortcut integration, with manual check-in shown as the universal fallback for non-iOS users
- [ ] **TEACH-05**: The first walkthrough check-in is a clearly-labeled practice check-in that does NOT register as a real check-in or affect stakes, penalties, or stats
- [ ] **TEACH-06**: The walkthrough is considered complete once all four teaching points (gym, challenge, money, Shortcut) have been presented/done

### Setup-as-Action Surfaces

- [ ] **SETUP-01**: Gym, schedule, and Shortcut setup UIs are reusable surfaces callable from both the walkthrough and the legacy entry, hitting the existing endpoints (no logic fork)
- [ ] **SETUP-02**: User can set their weekly schedule / goal in-context during the walkthrough

### Progress & Persistence

- [ ] **PROG-01**: Walkthrough progress is persisted server-side per user, so it resumes after interruption and across devices
- [ ] **PROG-02**: Steps already completed are auto-skipped, derived from real app state (gym set, weekly goal set, Shortcut viewed) rather than a duplicate flag
- [ ] **PROG-03**: User can replay the walkthrough anytime from Settings
- [ ] **PROG-04**: Replay handles walkthrough version changes gracefully without breaking on stale/removed step targets

### Onboarding UX

- [ ] **UX-01**: A 4-item "getting started" checklist shows progress and completes as the real actions are done
- [ ] **UX-02**: The dashboard shows a "Start your first pact" empty-state CTA as a fallback for users who skip coachmarks
- [ ] **UX-03**: A sharp, brand-voiced "pact is live" completion moment marks walkthrough/first-challenge completion
- [ ] **UX-04**: Walkthrough copy is outcome-framed and brand-voiced (consequence-first, "stakes not stats")

## Future Requirements (v1.x / v2)

- **ANL-01**: Per-step onboarding drop-off analytics
- **ANL-02**: Re-engagement nudge for users who start onboarding but never create a challenge
- **TEACH-07**: Money coachmark anchored to the user's own live numbers (post-launch polish)
- **ONB-05**: Adaptive step ordering refinement by entry path

## Out of Scope

| Feature | Reason |
|---------|--------|
| Demo / sandbox / fake-stakes mode (beyond the single labeled practice check-in) | Contradicts the consequence-first brand; only the one labeled practice check-in is allowed |
| Front-loaded multi-screen setup wizard | This milestone explicitly replaces it |
| Gamified completion badges for finishing the tutorial | Clashes with brand — the real money scoreboard is the reward |
| Blocking modal that traps the user until the tour completes | Anti-feature; skip is a hard requirement (ONB-04) |

## Traceability

Mapped during roadmap creation (2026-06-14). Phases defined in `.planning/ROADMAP.md`.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PROG-01 | Phase 1 | Pending |
| PROG-04 | Phase 1 | Pending |
| TEACH-06 | Phase 2 | Pending |
| PROG-02 | Phase 2 | Pending |
| SETUP-01 | Phase 2 | Pending |
| ONB-01 | Phase 3 | Pending |
| ONB-02 | Phase 3 | Pending |
| ONB-04 | Phase 3 | Pending |
| TOUR-01 | Phase 4 | Pending |
| TOUR-02 | Phase 4 | Pending |
| TOUR-03 | Phase 4 | Pending |
| TOUR-04 | Phase 4 | Pending |
| TOUR-05 | Phase 5 | Pending |
| ONB-03 | Phase 5 | Pending |
| TEACH-01 | Phase 5 | Pending |
| TEACH-02 | Phase 5 | Pending |
| TEACH-03 | Phase 5 | Pending |
| TEACH-04 | Phase 5 | Pending |
| TEACH-05 | Phase 5 | Pending |
| SETUP-02 | Phase 5 | Pending |
| UX-01 | Phase 5 | Pending |
| UX-02 | Phase 5 | Pending |
| UX-04 | Phase 5 | Pending |
| PROG-03 | Phase 6 | Pending |
| UX-03 | Phase 6 | Pending |

**Coverage:**
- v1.1 requirements: 25 total
- Mapped to phases: 25 ✓
- Unmapped: 0

---

## v1.0 Requirements — Shipped Baseline (reference)

All shipped and live (status: Complete). Captured 2026-06-14 from the existing codebase.

- **Authentication:** AUTH-01..04 — magic-link sign-in, session persistence, per-user webhook secret, account deletion
- **Onboarding & Profile:** PROF-01..04 — setup flow, username availability, display name/bio/avatar, view profiles
- **Check-ins:** CHK-01..06 — Shortcut webhook, manual, server-side geo-verify, idempotent reconciliation, timezone-aware, audit log
- **Groups & Challenges:** GRP-01..06 — create/join/leave, invite + settings, roles/remove, per-member penalty, 1v1 challenges, reverse check-in
- **Enforcement & Money:** ENF-01..04 — daily cron close + penalties, weekly obligations/settlement, dispute uphold/void, period records
- **Cycle Tracking:** CYC-01..02 — Apple Health period sync, cycle stats/prediction
- **Notifications:** NTF-01..03 — Web Push, subscription management/cleanup, in-app log
- **Platform & Security:** PLT-01..06 — Google Places search, RLS, privilege-scoped clients, Zod validation, rate limiting, PWA

---
*Requirements defined: 2026-06-14*
*Last updated: 2026-06-14 after roadmap creation for v1.1 (25/25 requirements mapped across 6 phases)*
