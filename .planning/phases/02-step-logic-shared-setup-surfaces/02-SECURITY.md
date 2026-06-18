---
phase: 2
slug: 02-step-logic-shared-setup-surfaces
status: verified
threats_open: 0
asvs_level: 1
created: 2026-06-15
---

# Phase 2 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| caller state → probe | Probes consume arbitrary caller-supplied arrays/numbers (gymCount, restDays, completedSteps). Pure functions; no privilege, no DB, no secrets. Risk is purely logical: wrong derivation could wrongly mark the tour complete. | Non-sensitive scalars/arrays |
| registry → persistence (downstream) | Step ids produced here become `complete_step` keys Phase 1 persists. A malformed id (failing STEP_KEY_REGEX) would be rejected at the Phase-1 PATCH boundary. | Step id strings |
| client surface → existing API routes | Each surface calls existing authenticated endpoints. All Zod validation, RLS, and rate limiting live server-side — this phase adds NO new endpoint. | gym count, schedule prefs, shortcut completion |
| surface vs shell write authority | SURFACE may write `shortcut_viewed` (benign progress key); only the LEGACY SHELL may write `onboarding_complete: true`. Prevents future walkthrough mount from ending onboarding early. | onboarding flags |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-02-01 | Tampering | `steps.ts` STEPS array | mitigate | `Object.freeze()` at `steps.ts:54`; immutability asserted in `steps.test.ts:55-60` | closed |
| T-02-02 | Tampering | step id → `complete_step` contract | mitigate | `steps.test.ts:27-30` iterates every STEPS id against `STEP_KEY_REGEX` imported from Phase-1 | closed |
| T-02-03 | Information disclosure | probe purity | accept | Probes contain no secrets and touch no DB; operate only on caller-supplied scalars/arrays. No PII or credential reachable. | closed |
| T-02-04 | Elevation of privilege (logic) | `isTourComplete` four-key rule | mitigate | `completion.ts:49` delegates to `TEACHING_KEYS.every(...)` (single source of truth); 3-of-4 partial case asserted false in `completion.test.ts:54-55` | closed |
| T-02-05 | Elevation of privilege | ShortcutSurface write path | mitigate | `shortcut-surface.tsx` writes only `{ complete_step: "shortcut_viewed" }` (line 19); 0 functional `onboarding_complete` writes in surface; `shortcut/client.tsx:17` is the only location of the flip | closed |
| T-02-06 | Tampering | extracted save logic vs endpoints | mitigate | Verbatim extraction; surfaces reference only pre-existing endpoint strings; `gym/client.tsx` and `schedule/client.tsx` contain zero `fetch(` calls | closed |
| T-02-07 | Information disclosure | client-side fetch error handling | accept | Surfaces expose the same non-sensitive error codes the existing routes already returned; no new disclosure surface | closed |
| T-02-08 | Spoofing / forged completion | financial-stakes adjacency | accept | Phase touches no check-in/penalty/settlement path; `onboarding_complete` and `shortcut_viewed` have no financial authority; RLS scopes both writes to the caller's own row | closed |
| T-02-SC | Tampering | npm package installs | n/a | No package-manager installs in either plan; all imports use existing deps | closed |

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-02-01 | T-02-03 | Probes are pure functions with no DB access, secrets, or PII — no meaningful disclosure surface | Plan-time design | 2026-06-15 |
| AR-02-02 | T-02-07 | Error strings are the same non-sensitive API error codes the existing routes already returned to these same components pre-extraction | Plan-time design | 2026-06-15 |
| AR-02-03 | T-02-08 | No financial stakes path touched; all writes are scoped by Postgres RLS to the caller's own row/profile | Plan-time design | 2026-06-15 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-06-15 | 9 | 9 | 0 | gsd-security-auditor (automated) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-06-15
