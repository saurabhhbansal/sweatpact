---
phase: 9
slug: admin-dashboard
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-28
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.7 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm run test` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~10 seconds |

No React Testing Library / component-render harness. Verification targets pure functions only; component/visual checks are manual (UAT).

---

## Sampling Rate

- **After every task commit:** `npm run test` + `npm run typecheck`
- **After every plan wave:** `npm run test` + `npm run lint`
- **Before `/gsd-verify-work`:** Full suite green + `npm run build`
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 9-01-01 | 01 | 0 | ADMIN-01 | T-9-01 | `parseAdminUserIds()` returns [] on empty/unset env | unit | `vitest run src/lib/admin-auth.test.ts` | ❌ Wave 0 | ⬜ pending |
| 9-01-02 | 01 | 0 | ADMIN-01 | T-9-01 | `requireOwner()` calls `notFound()` for non-listed user | unit | `vitest run src/lib/admin-auth.test.ts` | ❌ Wave 0 | ⬜ pending |
| 9-02-01 | 02 | 0 | DASH-01 | — | `settlementRate()` handles 0 total → 0; valid ratios | unit | `vitest run src/lib/admin-metrics.test.ts` | ❌ Wave 0 | ⬜ pending |
| 9-02-02 | 02 | 0 | DASH-02 | — | `bucketCheckinsByWeek()` + Zod `?range` enum validation | unit | `vitest run src/lib/admin-metrics.test.ts` | ❌ Wave 0 | ⬜ pending |
| 9-03-01 | 03 | 1 | DASH-04 | — | HogQL response Zod schema maps rows→typed metrics; null on bad shape | unit | `vitest run src/lib/admin-posthog.test.ts` | ❌ Wave 0 | ⬜ pending |
| 9-03-02 | 03 | 1 | DASH-05/06 | — | PostHog parsers for adoption + retention panels | unit | `vitest run src/lib/admin-posthog.test.ts` | ❌ Wave 0 | ⬜ pending |
| 9-04-01 | 04 | 2 | ADMIN-02 | — | `/admin` layout renders brand tokens, no tab nav | manual (UAT) | — | n/a | ⬜ pending |
| 9-04-02 | 04 | 2 | all panels | — | Dashboard panels render, empty states display correctly | manual (UAT) | — | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/admin-auth.test.ts` — stubs for ADMIN-01 (parseAdminUserIds + requireOwner branches)
- [ ] `src/lib/admin-metrics.test.ts` — stubs for DASH-01 (settlementRate) and DASH-02 (range/bucket helpers)
- [ ] `src/lib/admin-posthog.test.ts` — stubs for DASH-04/05/06 (HogQL response parsing)
- [ ] Extract pure logic from RSC components into `admin-auth.ts` / `admin-metrics.ts` / `admin-posthog.ts` (keep components thin)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `/admin` layout: brand tokens, no tab nav, no TourProvider | ADMIN-02 | No RTL in repo | Navigate to `/admin` as owner; verify layout matches UI-SPEC (brand tokens, data-dense, distinct from tab shell) |
| Non-owner 404 | ADMIN-01 | Auth state required | Navigate to `/admin` as non-admin user; verify 404 page renders |
| Financial, check-in, user overview data | DASH-01/02/03 | DB state required | Open admin dashboard; verify all four financial metrics + check-in trend chart + user counts display real values |
| PostHog panels render | DASH-04/05/06 | PostHog connection required | Verify onboarding funnel, feature adoption, engagement/retention panels show data or graceful empty state |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
