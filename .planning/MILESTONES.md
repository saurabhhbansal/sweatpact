# Milestones: SweatPact

## v1.1 — Guided Onboarding Walkthrough

**Shipped:** 2026-06-19
**Phases:** 6 (Phases 1–6)
**Plans:** 18 | **Files changed:** 171 | **Lines:** +19,298 / -512
**Timeline:** 2026-06-14 → 2026-06-19 (5 days)

### Delivered

Replaced the front-loaded four-screen setup wizard with a contextual coachmark walkthrough — new users reach the real app via username-only entry, and the walkthrough teaches gym setup, stakes challenges, the money model, and iOS Shortcut check-ins through real in-context actions across all tabs.

### Key Accomplishments

1. New user enters real app via username-only mandatory start — no wizard forced (ONB-01)
2. Server-side `onboarding_progress` table with owner-only RLS persists tour state across devices (PROG-01)
3. react-joyride v3.1 coachmark engine: click-through overlay, a11y, safe-area, Radix-dialog pause (TOUR-01..04)
4. Cross-route navigate-then-reveal walkthrough sequences across 3+ tabs for both entry paths (TOUR-05, ONB-03)
5. Practice check-in: zero `/api/checkin` calls — financial safety proven by hard grep gate (TEACH-05)
6. Already-done steps auto-skip from real app state; "pact is live" overlay lands on first active challenge (PROG-02, UX-03)

### Known Deferred Items at Close

4 items acknowledged and deferred at close (2026-06-19):

| Category | Item | Status |
|----------|------|--------|
| uat | Phase 03 UAT partial — tests skipped by user | deferred |
| uat | Phase 04 UAT flagged partial by audit tool | deferred |
| uat | Phase 06 UAT partial — 10 items skipped by user | deferred |
| verification | Phase 05 human_needed — navigate-then-reveal, invited-path, practice check-in Network-tab proof (all explicitly deferred to production by user) | deferred |

### Archives

- `.planning/milestones/v1.1-ROADMAP.md` — full phase details
- `.planning/milestones/v1.1-REQUIREMENTS.md` — all 25/25 requirements marked complete

---

*To add a new milestone entry, run /gsd-new-milestone*
