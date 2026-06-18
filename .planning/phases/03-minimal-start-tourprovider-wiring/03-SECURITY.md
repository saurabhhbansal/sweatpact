---
phase: 03-minimal-start-tourprovider-wiring
asvs_level: 1
block_on: high
threats_total: 8
threats_closed: 8
threats_open: 0
register_authored_at_plan_time: true
audited: 2026-06-18
status: SECURED
---

# Phase 03 — Security Audit (Minimal Start & TourProvider Wiring)

Retroactive verification that every declared threat mitigation in the Phase 3
plan threat models is present in implemented code. Implementation files were
treated as read-only; only this artifact was written.

## Verdict: SECURED — 8/8 threats closed

All declared mitigations were located in code by grep/line evidence. One
non-security functional cleanup deviation was found (a residual per-page
`/onboarding/username` redirect in `u/me/page.tsx`); it tightens rather than
weakens access control and does not affect any declared threat disposition.
Logged below as an informational flag.

## Threat Verification

| Threat ID | Category | Disposition | Status | Evidence |
|-----------|----------|-------------|--------|----------|
| T-03-IDOR | Information Disclosure | mitigate | CLOSED | `src/lib/supabase/rsc.ts:56` — `.eq("user_id", user.id)` is the sole filter on the admin-client `onboarding_progress` read; `getAuthUser()` (line 48) supplies the request-cached owner id; `.maybeSingle()` (line 57) yields null not a throw. Filter is not widened anywhere. |
| T-03-ELEV | Elevation of Privilege | mitigate | CLOSED | `src/lib/supabase/rsc.ts:48-49` — `const user = await getAuthUser(); if (!user) return null;` Unauthenticated caller receives null (blank slate), never another user's row. Mirrors `getViewerProfile`. |
| T-03-FORGE | Tampering / EoP | mitigate | CLOSED | Route pins identity: `src/app/api/onboarding-progress/route.ts:42-45` (`auth.user` checked, 401 if absent), `:47` (`PatchBody.safeParse`), `:70-73` (server-authoritative `mergeProgress`), `:77` (`upsert({ user_id: auth.user.id, ...merged })` — user_id pinned, never client-supplied). Provider sends only `complete_step`/`last_step_id` (`tour-provider.tsx:86`) and `dismissed` (`:100`); `completed_steps` never sent. `mergeProgress` dedupe-appends server-side (`onboarding-progress.ts:72-89`). |
| T-03-SMUGGLE | Tampering | mitigate | CLOSED | `src/lib/onboarding-progress.ts:17-29` — `PatchBody = z.object({...}).strict()`; `.strict()` rejects unknown fields. Route rejects with 400 on parse failure (`route.ts:48-53`). Provider bodies contain only allowed keys (`tour-provider.tsx:86,100`). |
| T-03-GATE | Functional | mitigate | CLOSED | `src/app/(tabs)/layout.tsx:59-62` — single async layout gate: `getViewerProfile()` → `redirect("/login")` when null → `redirect("/onboarding/username")` when `isAutoUsername(profile.username)`. NO `onboarding_complete` check (D-02 comment line 62). Confirmed zero `onboarding_complete` / `redirect("/onboarding/schedule")` across all 8 `(tabs)/**/page.tsx`. |
| T-03-GATEBYPASS | Elevation of Privilege | mitigate | CLOSED | Plan 03-03 is `wave: 3, depends_on: ["03-02"]` (03-03-PLAN.md frontmatter) — sequenced after the layout gate landed. `if (!profile) redirect("/login")` preserved on all 8 pages: dashboard:26, groups:34, groups/[id]:46, cycle:16, notifications:14, settings:11, u/me:8, u/[username]:44 (`if (!viewerProfile) redirect("/login")`). Layout gate (`layout.tsx:59-61`) runs before any page RSC renders. |
| T-03-CYCLE | Functional | mitigate | CLOSED | `src/app/(tabs)/cycle/page.tsx:18-20` — `if (profile.gender !== "female") { redirect("/dashboard"); }` preserved; deletion was scoped to onboarding redirects only. Gender gate intact. |
| T-03-SC | Supply Chain | accept | CLOSED | Accepted risk logged below. `tech_stack.added: []` in all three plan SUMMARYs (03-01, 03-02, 03-03). No `package.json`/lockfile changes attributable to this phase. No package installs — supply-chain surface unchanged from shipped baseline. |

## Accepted Risks Log

| Threat ID | Category | Disposition | Rationale | Owner |
|-----------|----------|-------------|-----------|-------|
| T-03-SC | Supply Chain (npm/pip/cargo installs) | accept | Phase 3 is pure wiring against infrastructure already shipped in Phases 1-2; zero new packages added (`added: []` across all three plan summaries). Supply-chain attack surface is unchanged from the existing baseline. No new dependency to vet. | Phase owner (accepted at plan time) |

## Unregistered Flags

The `## Threat Flags` sections of all three SUMMARYs (03-01 has none; 03-02 and
03-03 both report "no new security surface beyond the plan threat model"). No new
attack surface mapped to an unregistered threat. **No unregistered flags.**

## Informational — non-blocking deviation

- **Residual per-page username redirect in `src/app/(tabs)/u/me/page.tsx:9`** —
  `if (!profile.username) redirect("/onboarding/username");` was NOT deleted, though
  plan 03-03 intended all per-page `/onboarding/username` redirects removed, and the
  03-03 SUMMARY asserts `grep redirect("/onboarding/username")` returned "0 matches"
  (inaccurate — one match remains).
  - **Security impact: none.** This is a narrowed defensive redirect
    (`!profile.username`, not the full auto-username regex) that tightens, not
    loosens, access control; it cannot expose a username-less user. The declared
    T-03-GATEBYPASS mitigation (wave-3 sequencing + `!profile → /login` auth guard
    on every page) is fully intact. This is a gate-centralization cleanup miss
    (two sources of truth for one redirect), not a security regression.
  - **Recommendation:** delete line 9 in a follow-up cleanup so the layout gate is
    the sole source of truth (D-03); correct the 03-03 SUMMARY's grep claim. Not a
    ship blocker under `block_on: high`.

## Files Audited

- `src/lib/supabase/rsc.ts` (T-03-IDOR, T-03-ELEV)
- `src/components/tour-provider.tsx` (T-03-FORGE, T-03-SMUGGLE)
- `src/app/api/onboarding-progress/route.ts` (T-03-FORGE, T-03-SMUGGLE)
- `src/lib/onboarding-progress.ts` (T-03-FORGE, T-03-SMUGGLE)
- `src/lib/onboarding/current-step.ts` (dismiss/resume logic supporting ONB-04)
- `src/app/(tabs)/layout.tsx` (T-03-GATE, T-03-GATEBYPASS)
- `src/app/(tabs)/dashboard/page.tsx`, `groups/page.tsx`, `groups/[id]/page.tsx`,
  `cycle/page.tsx`, `notifications/page.tsx`, `settings/page.tsx`, `u/me/page.tsx`,
  `u/[username]/page.tsx` (T-03-GATEBYPASS, T-03-CYCLE)
