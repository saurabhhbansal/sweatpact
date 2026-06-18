---
phase: 05-cross-route-walkthrough-teaching-content
plan: 04
subsystem: ui
tags: [next-navigation, react, tour, coachmark, onboarding, react-joyride]

# Dependency graph
requires:
  - phase: 05-cross-route-walkthrough-teaching-content (Plan 01)
    provides: STEPS `route?` field + CoachmarkCard inline `surface` slot
  - phase: 05-cross-route-walkthrough-teaching-content (Plan 02)
    provides: cross-route data-tour anchors + data-pending-count on /groups
  - phase: 05-cross-route-walkthrough-teaching-content (Plan 03)
    provides: dashboard gym anchor + getting-started checklist + empty-state CTA
  - phase: 04-coachmark-engine
    provides: CoachmarkRenderer (joyride wiring, anchor-gate observer, Radix pause, a11y, safe-area)
provides:
  - Navigate-then-reveal cross-route sequencing (dual-gated on pathname + anchor mount)
  - Invited-path challenge route swap (/groups → /notifications when pendingCount>0)
  - Inline-embedded gym/schedule setup surfaces with onComplete=advance
  - Pure-UI practice check-in (zero API calls, never touches /api/checkin)
  - Per-step brand-voiced teaching copy for all five steps incl. invited variant
affects: [phase-06-skip-on-complete-replay-completion-hardening]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "navigate-then-reveal: useEffect keyed on currentStepId pushes the next step's effective route; the reused Phase-4 anchor-gate observer reveals once the new page mounts the anchor"
    - "invited-path detection via non-authoritative DOM read of data-pending-count (route choice only, grants no authority)"
    - "surface embedding: real Phase-2 surfaces mounted in the card surface slot with onComplete wired to handleAdvance"
    - "co-located cosmetic-only practice control auditable in a single file (HARD SAFETY grep gate)"

key-files:
  created: []
  modified:
    - src/components/tour/coachmark-renderer.tsx

key-decisions:
  - "TourValue NOT extended (D-08) — all cross-route navigation lives in the client renderer"
  - "TOUR_VERSION not bumped — no add/remove/reorder/rename of steps"
  - "challenge route stays /groups in the registry; /notifications swap resolved at runtime via data-pending-count (D-09/D-10)"
  - "Practice check-in is cosmetic only: zero fetch, zero /api/checkin, zero geo/submission_id — the only side effect is handleAdvance() which routes through TourProvider's existing complete_step PATCH (D-05/TEACH-05)"
  - "Reused the single Phase-4 anchor-gate MutationObserver for reveal; no second navigation observer or polling added"

patterns-established:
  - "navigate-then-reveal: drive router.push off a currentStepId-keyed effect, guarded by route-differs-from-pathname to prevent re-render loops"
  - "financial-safety auditability: keep the practice control co-located so the no-network guarantee is verifiable by one grep over one file"

requirements-completed: [TOUR-05, ONB-03, TEACH-01, TEACH-02, TEACH-03, TEACH-04, TEACH-05, SETUP-02, UX-04]

# Metrics
duration: ~25min
completed: 2026-06-18
status: complete
---

# Phase 5 Plan 04: Cross-Route Teaching Engine Summary

**CoachmarkRenderer extended into the full cross-route walkthrough — navigate-then-reveal sequencing, inline-embedded gym/schedule surfaces, invited-path route swap to /notifications, a zero-API-call practice check-in, and brand-voiced per-step copy.**

## Performance

- **Duration:** ~25 min (3 of 4 tasks; checkpoint deferred)
- **Tasks:** 3 of 4 completed (Task 4 human-verify checkpoint deferred to production)
- **Files modified:** 1

## Accomplishments

- Navigate-then-reveal cross-route sequencing: the renderer pushes the next step's effective route on advance (only when it differs from the current pathname) and reveals via the reused Phase-4 anchor-gate observer once the new page mounts its anchor — dual-gated on pathname + anchor (TOUR-05).
- Invited-path challenge route swap: a non-authoritative DOM read of `data-pending-count` routes the challenge step to `/notifications` with invited copy when pendingCount>0, else stays on `/groups` with self-starter copy (ONB-03/D-09/D-10).
- Inline surface embedding: GymSurface and ScheduleSurface render inside the coachmark card with `onComplete=handleAdvance`; challenge and money stay teaching-only with the "Next →" button (D-01/D-03/SETUP-02/TEACH-01).
- Pure-UI practice check-in: a clearly-labeled "Practice check-in" control runs a ≤400ms reduced-motion-safe pulse then advances the tour, making ZERO API calls (TEACH-05/D-05).
- Brand-voiced per-step teaching copy for all five steps including the invited variant; PLACEHOLDER_BODY removed (UX-04).

## Task Commits

Each task was committed atomically:

1. **Task 1: navigate-then-reveal cross-route sequencing + invited-path route swap** - `0332420` (feat)
2. **Task 2: embed real surfaces inline + brand-voiced per-step teaching copy** - `eb6785a` (feat)
3. **Task 3: pure-UI practice check-in (zero API calls)** - `ecbbdd1` (feat)

**Task 4 (human-verify checkpoint):** SKIPPED — deferred to production verification (see Deviations).

## Files Created/Modified

- `src/components/tour/coachmark-renderer.tsx` - Extended with `usePathname`/`useRouter` wiring, `effectiveRoute(stepId)` helper (invited-path swap), navigation effect keyed on currentStepId, `STEP_COPY` per-step brand-voiced lookup, GymSurface/ScheduleSurface embedding, and the co-located cosmetic-only practice check-in UI.

## Decisions Made

- **TourValue not extended (D-08):** all cross-route navigation lives in the client renderer, keeping the provider contract frozen.
- **TOUR_VERSION not bumped:** the changes add no/remove no steps, so replay version detection is unaffected.
- **Practice check-in is cosmetic only (D-05/TEACH-05):** no `fetch`, no `/api/checkin`, no geo read, no submission_id. The only side effect is `handleAdvance()`, which routes through TourProvider's existing best-effort `complete_step` PATCH — the tour-completion write, never a check-in.
- **Reused the Phase-4 anchor-gate observer:** reveal rides on the existing single MutationObserver; no second navigation observer or polling was added (count remains 2: anchor gate + dialog pause).

## Deviations from Plan

### Checkpoint Deferred

**1. Task 4 (checkpoint:human-verify) — deferred to production deployment**
- **Found during:** Task 4 (human verification checkpoint)
- **Issue:** The blocking human checkpoint requires running the live app to confirm the end-to-end cross-route flow, both entry paths, and (most importantly) that clicking the practice check-in issues zero `/api/checkin` network requests in the browser. The user can only perform this verification when the app is live/deployed.
- **Decision:** User explicitly chose to skip the checkpoint and defer verification to production. Tasks 1–3 (all implementation) are complete and committed.
- **Residual risk:** The financial-safety guarantee (TEACH-05/D-05) is asserted at the source level by the HARD SAFETY grep gate (`grep -v '^//' src/components/tour/coachmark-renderer.tsx | grep -c 'api/checkin'` returns 0) and the practice control's co-located single-file auditability. The remaining unverified item is the runtime Network-tab confirmation, which only the live app can provide.
- **Carry-forward:** When the app is next deployed/run, the user should complete the Task 4 verification steps — especially Step 2 (DevTools Network filter "checkin" → click Practice check-in → confirm zero requests).

---

**Total deviations:** 1 (checkpoint deferred to production, by user choice)
**Impact on plan:** No implementation scope changed. All three implementation tasks executed exactly as written; only the human runtime verification is outstanding.

## Safety Verification

**HARD SAFETY GATE (TEACH-05/D-05) — PASSED:**

- `grep -v '^//' src/components/tour/coachmark-renderer.tsx | grep -c 'api/checkin'` = **0** — the renderer makes no reference to the check-in endpoint in executable code.
- `grep -c 'new MutationObserver' src/components/tour/coachmark-renderer.tsx` = **2** — unchanged (anchor gate + dialog pause); no second observer added.
- `npx tsc --noEmit` passes.
- ESLint clean.

The practice check-in can never forge a verified check-in, alter stakes/penalties/stats, or contact `/api/checkin` — the financial-safety boundary is held at the source level.

## Issues Encountered

None — implementation tasks executed as planned.

## Next Phase Readiness

- The full cross-route walkthrough engine is in place; Phase 6 (skip-on-complete, replay, completion hardening) can build on it.
- **Outstanding:** the Task 4 production runtime verification (cross-route flow, both entry paths, and the zero-`/api/checkin` Network-tab confirmation) should be completed once the app is live.

## Self-Check: PASSED

- FOUND: `.planning/phases/05-cross-route-walkthrough-teaching-content/05-04-SUMMARY.md`
- FOUND: `src/components/tour/coachmark-renderer.tsx`
- Commits verified: `0332420`, `eb6785a`, `ecbbdd1`, `463d934`

---
*Phase: 05-cross-route-walkthrough-teaching-content*
*Completed: 2026-06-18*
