# SECURITY.md — Phase 2: Step Logic & Shared Setup Surfaces

**Audit date:** 2026-06-15
**Phase:** 2 — Step Logic & Shared Setup Surfaces
**ASVS Level:** 1
**Auditor:** claude-sonnet-4-6 (automated, adversarial stance)

---

## Threat Verification

| Threat ID | Category | Disposition | Status | Evidence |
|-----------|----------|-------------|--------|----------|
| T-02-01 | Tampering | mitigate | CLOSED | `steps.ts:54` — `Object.freeze([...] as const)`; `steps.test.ts:55-60` — `isFrozen` assertion + push-throws test |
| T-02-02 | Tampering | mitigate | CLOSED | `steps.test.ts:27-30` — iterates all `STEPS` ids against imported `STEP_KEY_REGEX`; every id passes |
| T-02-04 | EoP (logic) | mitigate | CLOSED | `completion.ts:49` — `isTourComplete` uses `TEACHING_KEYS.every(...)`; `completion.test.ts:54-55` — 3-of-4 partial case explicitly tested and returns false |
| T-02-05 | EoP | mitigate | CLOSED | `shortcut-surface.tsx`: 0 functional writes of `onboarding_complete` (line 12 is comment only); writes only `complete_step: "shortcut_viewed"` (line 19); `shortcut/client.tsx:17` — sole `onboarding_complete: true` write lives in the shell |
| T-02-06 | Tampering | mitigate | CLOSED | Surfaces reference only pre-existing endpoints (`/api/profile`, `/api/gyms`, `/api/places/search`, `/api/places/details`, `/api/onboarding-progress` — all confirmed present); gym shell (`gym/client.tsx`) and schedule shell (`schedule/client.tsx`) contain zero `fetch(` calls — no duplicated save logic |
| T-02-03 | — | accept | CLOSED | Accepted: probes contain no secrets, no DB access |
| T-02-07 | — | accept | CLOSED | Accepted: client-side error surfaces same non-sensitive codes as before |
| T-02-08 | — | accept | CLOSED | Accepted: no financial/stakes path touched in this phase |
| T-02-SC | — | n/a | CLOSED | N/A: no package installs in this phase |

---

## Unregistered Flags

None. No new attack surface was identified in implementation beyond the threat register.

---

## Accepted Risks Log

| Risk ID | Description | Accepted by |
|---------|-------------|-------------|
| T-02-03 | Completion probes (`isGymDone`, `isScheduleDone`, `isShortcutDone`) are pure functions over caller-supplied state with no DB access or secrets exposure | Plan (register_authored_at_plan_time) |
| T-02-07 | Client-side error display propagates non-sensitive server error codes (`data.error` strings) identical to pre-existing patterns | Plan (register_authored_at_plan_time) |
| T-02-08 | Phase 2 does not touch financial enforcement, penalty computation, or settlement paths | Plan (register_authored_at_plan_time) |

---

## Threats Open

None. All mitigated threats are CLOSED.
