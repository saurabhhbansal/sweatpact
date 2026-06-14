# SweatPact

## What This Is

SweatPact is a full-stack Next.js PWA that pairs two people in a gym-accountability challenge with real money on the line. Members commit to a weekly workout goal, verify check-ins by location (iOS Shortcut or manual), and settle up financially based on who actually showed up. A cycle-tracking layer adds a second competitive vector for users who opt in. It's for competitive fitness pairs — friends, partners, gym duos — who want social accountability backed by financial stakes, not just another logging tool.

## Core Value

Make showing up have a consequence: if you skip, you owe your partner — the head-to-head financial stake is the one thing that must work.

## Requirements

### Validated

<!-- Captured from the existing codebase as the project baseline (2026-06-14). -->

**Authentication & Identity**
- ✓ Email magic-link sign-in via Supabase Auth — existing
- ✓ Session refresh on every request via middleware — existing
- ✓ Per-user `webhook_secret` for iOS Shortcut API access — existing
- ✓ Account deletion — existing

**Onboarding & Profile**
- ✓ Onboarding flow (username, gym, schedule, shortcut steps) — existing
- ✓ Username selection with availability check — existing
- ✓ Profile with display name, bio, avatar (browser-side crop + Supabase Storage) — existing
- ✓ View other users' profiles — existing

**Check-ins**
- ✓ Check in via iOS Shortcut webhook (GPS + secret auth) — existing
- ✓ Manual check-in from UI — existing
- ✓ Server-side geo-verification against gym location (Haversine) — existing
- ✓ Idempotent day/week reconciliation deriving status from raw rows — existing
- ✓ Timezone-aware (IANA) local-day math for all period logic — existing
- ✓ Audit trail (IP + User-Agent) on every check-in attempt — existing

**Groups & Challenges**
- ✓ Create / join / leave groups; invite members — existing
- ✓ Group settings, member roles, remove member — existing
- ✓ Per-member penalty config — existing
- ✓ 1v1 head-to-head challenges (invite, respond, cancel) — existing
- ✓ Reverse check-ins (admin/correction path) — existing

**Enforcement & Money**
- ✓ Daily Vercel Cron enforcement (19:00 UTC) closing periods — existing
- ✓ Missed-goal penalty computation and settlement records — existing
- ✓ Weekly stakes / obligation tracking — existing
- ✓ Dispute raise + manager resolution (uphold/void) — existing
- ✓ Period records and settlement views — existing

**Cycle Tracking**
- ✓ Apple Health period-sync webhook → `cycle_events` — existing
- ✓ Period prediction / cycle stats with rest-day handling — existing

**Notifications**
- ✓ Web Push (VAPID) for check-ins, invites, period/rest-day reminders — existing
- ✓ Push subscription management + expired-endpoint cleanup — existing
- ✓ In-app notification log with preferences — existing

**Platform & Security**
- ✓ Gym/location search via Google Places (server-proxied key) — existing
- ✓ Postgres RLS on all user-facing tables — existing
- ✓ Privilege-scoped Supabase clients (browser / server / rsc / admin) — existing
- ✓ Zod validation at API boundaries — existing
- ✓ Postgres-backed rate limiting on webhook/search endpoints — existing
- ✓ PWA shell (manifest, icons, service worker) — existing

### Active

<!-- No active scope. This document is a baseline snapshot of the current app. -->

(None — baseline snapshot only. Add via `/gsd-new-milestone` when starting new work.)

### Out of Scope

- Generic fitness logging / calorie tracking — anti-reference; SweatPact is a stakes-and-competition product, not a tracker
- Logo-heavy / brand-athlete aesthetic (Nike Run Club, Under Armour) — conflicts with the sharp, consequence-first product identity
- Corporate SaaS dashboard UX (gray sidebar, metric-card grids) — zero personality, against design principles

## Context

- **Stage:** Mature, deployed brownfield app (32 API routes, ~29 SQL migrations, unit-tested domain libs). Codebase map lives in `.planning/codebase/`.
- **Architecture:** Layered server-driven monolith — thin UI, domain logic in pure `src/lib/` modules, Supabase/Postgres data layer with RLS.
- **Deployment:** Vercel auto-deploy on push to `main`; Vercel Cron for enforcement; Supabase cloud (DB, auth, storage).
- **Known risk areas** (from `.planning/codebase/CONCERNS.md`):
  - No cross-table transactional guarantees — multi-step financial ops (check-in → penalty → obligation) can partially fail and orphan records.
  - Enforcement cron scans up to 10k profiles sequentially with no pagination — a scaling ceiling.
  - Authorization re-implemented per route with no shared middleware and no automated auth tests.
  - `as any` casts and untyped complex client state in several large components.
  - No background job queue; heavy work (push, period sync) runs inline in request handlers.

## Constraints

- **Tech stack**: Next.js 14 (App Router), React 18, TypeScript strict, Tailwind + shadcn/Radix — established; new work should match.
- **Data layer**: Supabase Postgres with RLS as the primary authorization mechanism; admin (service-role) client is server-only.
- **Validation**: Zod at every API boundary; financial correctness is server-authoritative (clients cannot forge verified status).
- **Verification**: Check-ins must be geo-verified server-side; timestamps accepted only for local today/yesterday.
- **Platform**: Node.js runtime required for routes using the Supabase admin client (not Edge-compatible).
- **Testing**: Vitest; domain rule changes in `src/lib/*` require updating co-located `*.test.ts`.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Server-driven monolith, domain logic in `src/lib/` | Keep financial/business rules pure and unit-testable, UI thin | ✓ Good |
| Postgres RLS as primary authorization | Defense-in-depth at the data layer regardless of route bugs | ✓ Good |
| Privilege-scoped Supabase client factories | Make the privilege choice explicit per call site; reserve admin for trusted paths | ✓ Good |
| Email magic-link auth (passwordless) | Lower friction, no password storage | ✓ Good |
| iOS Shortcut + per-user webhook secret for check-ins | Frictionless location check-in without a native app | ✓ Good |
| Daily Vercel Cron for enforcement | Simple scheduled settlement without a job queue | ⚠️ Revisit — sequential 10k-profile scan limits scaling |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-14 after initialization (baseline snapshot of existing app)*
