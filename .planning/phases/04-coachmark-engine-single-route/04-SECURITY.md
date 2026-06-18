---
phase: 04-coachmark-engine-single-route
audited_by: gsd-secure-phase
audit_date: 2026-06-18
asvs_level: 1
threats_total: 8
threats_closed: 8
threats_open: 0
block_on: open
result: SECURED
---

# Security Audit — Phase 04: Coachmark Engine Single Route

## Summary

All 8 declared threats verified closed. No unregistered flags. No implementation gaps found.

One notable operational note: T-04-05 (click-through overlay) and T-04-07 (Radix dialog focus coexistence) were declared as `mitigate` with their mitigation plan calling for confirmation via a blocking human-verify checkpoint (Plan 03 Task 2). That checkpoint was **skipped by the user**. The mitigations are present in code and verified by grep; the runtime/interaction confirmation that would have been provided by the checkpoint was not performed. This is recorded as an accepted gap in the runtime verification note below — it does not change the CLOSED status of either threat (the code evidence is sufficient), but it should be exercised before Phase 5 depends on the engine in production.

---

## Threat Verification

| Threat ID | Category | Disposition | Component | Evidence |
|-----------|----------|-------------|-----------|----------|
| T-04-SC | Tampering | mitigate | npm install of react-joyride | `package.json:27` — `"react-joyride": "^3.1.0"` (caret-ranged to vetted 3.1.x line). Plan 01 Task 1 was a `checkpoint:human-verify` gate marked pre-approved by human before install ran. 04-01-SUMMARY.md §Task Commits records the legitimacy gate was passed. |
| T-04-01 | Tampering | accept | `data-tour` anchor attribute | `src/app/(tabs)/dashboard/page.tsx:119` — `data-tour="schedule"` is a static HTML attribute on the `<section>` element. No user input, no privilege. Accepted: inert DOM hook with no auth surface. |
| T-04-02 | Information Disclosure | accept | `#tour-root` portal div | `src/app/layout.tsx:48` — `<div id="tour-root" />` is an empty, static portal target sibling of `<InstallGate>`. No data crosses it at rest. Accepted: client-only overlay target with no server data. |
| T-04-03 | Tampering | accept | CoachmarkCard `title`/`body` rendering | `src/components/tour/coachmark-card.tsx:59,62` — title rendered as `{title}` inside `<h2>`, body as `{body}` inside `<p>`. No `dangerouslySetInnerHTML` present (grep returns no matches). Accepted: plain React text nodes (auto-escaped), static placeholder copy from registry, no user input in Phase 4. |
| T-04-04 | Denial of Service | mitigate | `deriveDotStates` with unknown stepId | `src/lib/onboarding/coachmark-progress.ts:27` — `STEPS.findIndex(...)` returns `-1` for null/unknown. Line 33: `currentIndex !== -1 && index < currentIndex` guard means all dots fall through to `"future"` when index is -1. No throw. Phantom stepId cannot crash the card render. |
| T-04-05 | Denial of Service | mitigate | Click-through overlay | `src/components/tour/coachmark-renderer.tsx:268` — `overlay: { pointerEvents: "none" }` in joyride `styles`. Additionally `options.overlayClickAction: false` (line 247) and `options.blockTargetInteraction: false` (line 248). `disableFocusTrap: true` (line 253) ensures no focus trap. The `showing` predicate (line 127) returns `null` at the mount gate when not active, providing silent degrade. |
| T-04-06 | Denial of Service | mitigate | Anchor gating on unmounted target | `src/components/tour/coachmark-renderer.tsx:62` — `anchorReady` state initialized `false`. Lines 85-95: `useEffect` sets `anchorReady` only when `document.querySelector(selector) !== null`, observed via `MutationObserver` on `document.body`. Line 211-214: `if (!showing || !selector) return null` — renders nothing until anchor is confirmed mounted. `options.targetWaitTimeout: 0` (line 259) is a secondary safety net. |
| T-04-07 | Elevation of Privilege | mitigate | Radix dialog focus coexistence | `src/components/tour/coachmark-renderer.tsx:28` — `anyDialogOpen()` queries `[role="dialog"][data-state="open"]`. Lines 99-114: `MutationObserver` on `document.body` watching `data-state` and `role` attribute changes toggles `dialogOpen` state; observer cleaned up on unmount (line 113). Line 127: `showing = isActive && anchorReady && !dialogOpen` — engine renders `null` while dialog is open. Keyboard handler (line 135) also bails on `anyDialogOpen()`. `disableFocusTrap: true` (line 253) prevents coachmark from blocking modal dismissal. |
| T-04-08 | Tampering | accept | `useTour()` contract | `src/components/tour/coachmark-renderer.tsx:57` — destructures only `{ currentStepId, isActive, advance, dismiss }`. No `isComplete` or `progress` accessed. The renderer writes nothing directly to persistence; all authority stays in `TourProvider` and the owner-RLS PATCH route (Phase 1/3). Accepted: frozen 4-member TourValue consumed unchanged. |

---

## Unregistered Flags

None. The `## Threat Flags` sections of 04-01-SUMMARY.md, 04-02-SUMMARY.md, and 04-03-SUMMARY.md report no new attack surface beyond the declared threat register. The pre-existing 7 npm audit vulnerabilities noted in 04-01-SUMMARY.md §Issues Encountered are not introduced by this phase and are out of scope.

---

## Accepted Risks Log

| Threat ID | Risk | Rationale |
|-----------|------|-----------|
| T-04-01 | Inert `data-tour` DOM attribute | Static string, no user input, no privilege surface. No mitigation needed. |
| T-04-02 | Empty `#tour-root` portal div | Empty static container; no data crosses it server-side. No mitigation needed. |
| T-04-03 | CoachmarkCard renders `title`/`body` props | Props sourced from static step registry (Phase 4); React auto-escapes text nodes; no `dangerouslySetInnerHTML`. No mitigation needed. |
| T-04-08 | `useTour()` consumed by renderer | Renderer reads state only; no direct writes to persistence or auth surface. No mitigation needed. |

---

## Runtime Verification Note

T-04-05 and T-04-07 mitigations are verified by static code analysis. The blocking human-verify checkpoint in Plan 03 Task 2 (which would have provided interactive confirmation of click-through behavior, Radix-dialog pause, keyboard operability, focus management, reduced-motion, and PWA safe-area insets) was **skipped by the user**. The behavioral guarantees of these threats rest on code review and automated typecheck/build only. This interactive confirmation should be performed before Phase 5 depends on the engine in a production context.
