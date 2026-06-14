# Roadmap: SweatPact

**Created:** 2026-06-14
**Mode:** Baseline snapshot — no active phases.

## Status

This roadmap was initialized as a **baseline snapshot** of the existing,
shipped SweatPact app. The current product (see `REQUIREMENTS.md` →
v1 Shipped Baseline) is treated as Milestone 0 — already delivered.

There are no active forward phases. When new work begins, run
`/gsd-new-milestone` to define the next milestone's requirements and
generate a phased roadmap here.

## Milestone 0 — Shipped Baseline ✓

**Goal:** Capture the current app as the project baseline.
**Status:** Complete (documented, not re-implemented).

Covers all 30 v1 requirements across Authentication, Onboarding & Profile,
Check-ins, Groups & Challenges, Enforcement & Money, Cycle Tracking,
Notifications, and Platform & Security. See `REQUIREMENTS.md` for the full
list and `.planning/codebase/` for the architecture map.

## Future Phases

(None defined. Use `/gsd-new-milestone` to scope the next milestone.)

Likely candidates surfaced by the codebase audit (`.planning/codebase/CONCERNS.md`),
not yet committed to scope:
- Cross-table transactional guarantees for financial operations
- Enforcement cron pagination / scaling beyond sequential 10k-profile scan
- Shared authorization middleware + automated auth tests

---
*Roadmap created: 2026-06-14 (baseline snapshot)*
